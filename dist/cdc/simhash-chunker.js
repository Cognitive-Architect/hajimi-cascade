"use strict";
/**
 * SimHash Chunker - RISK-H-004 修复：文件级固定 Seed
 *
 * 修复核心问题：per-chunk seed 轮换导致同一内容在不同块中产生不同 SimHash，候选检索阶段漏检
 *
 * 核心原则：
 * 1. 文件级固定 seed：整个文件的所有 chunk 共用同一 seed
 * 2. 确定性：相同内容 + 相同 seed = 相同 SimHash
 * 3. 向后兼容：旧API（per-chunk seed）标记为 LEGACY 模式
 *
 * @module simhash-chunker
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimHashChunker = exports.SimHashHasher = exports.DEFAULT_FILE_SEED = exports.HAMMING_THRESHOLD = exports.UINT64_MASK = void 0;
exports.popcnt64 = popcnt64;
exports.hammingDistance = hammingDistance;
exports.isSimilar = isSimilar;
exports.serializeChunkHashV2 = serializeChunkHashV2;
exports.deserializeChunkHashV2 = deserializeChunkHashV2;
exports.serializeChunkHashV1 = serializeChunkHashV1;
exports.deserializeChunkHashV1 = deserializeChunkHashV1;
exports.compareChunks = compareChunks;
exports.computeMD5 = computeMD5;
exports.createChunkHashV2 = createChunkHashV2;
exports.randomSimHash = randomSimHash;
exports.assertSimHashType = assertSimHashType;
exports.isSeedCompatible = isSeedCompatible;
const crypto_1 = require("crypto");
// ============================================================================
// 常量定义
// ============================================================================
/** 64 位掩码 - 用于确保 bigint 在 64 位范围内 */
exports.UINT64_MASK = 0xffffffffffffffffn;
/** 32 位掩码 */
const UINT32_MASK = 0xffffffffn;
/** 汉明距离阈值 - 根据 MATH-001 分析，h=3 是最优选择 */
exports.HAMMING_THRESHOLD = 3;
/** 默认文件级种子 */
exports.DEFAULT_FILE_SEED = 0x20250221; // 版本发布日期作为默认 seed
// ============================================================================
// BigInt 工具函数（全程化核心）
// ============================================================================
/**
 * 计算 64 位 BigInt 的汉明权重（popcount）
 *
 * 使用分段计算策略：将 64 位分成两个 32 位分别计算
 * 避免直接对 BigInt 进行位操作的性能问题
 *
 * @param value - 64 位 BigInt 值
 * @returns 1 的位数 (0-64)
 */
function popcnt64(value) {
    // 确保值在 64 位范围内
    const v = value & exports.UINT64_MASK;
    // 分段：高 32 位和低 32 位
    const lo = Number(v & UINT32_MASK);
    const hi = Number(v >> 32n);
    return popcnt32(lo) + popcnt32(hi);
}
/**
 * 计算 32 位整数的汉明权重
 * 使用 SWAR (SIMD Within A Register) 算法
 *
 * @param x - 32 位整数
 * @returns 1 的位数 (0-32)
 */
function popcnt32(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0F0F0F0F;
    x = x + (x >> 8);
    x = x + (x >> 16);
    return x & 0x3F;
}
/**
 * 计算两个 SimHash 的汉明距离
 *
 * @param a - SimHash A
 * @param b - SimHash B
 * @returns 汉明距离 (0-64)
 */
function hammingDistance(a, b) {
    // XOR 后统计 1 的位数
    return popcnt64(a ^ b);
}
/**
 * 检查两个 SimHash 是否在阈值内相似
 *
 * @param a - SimHash A
 * @param b - SimHash B
 * @param threshold - 汉明距离阈值，默认 3
 * @returns 是否相似
 */
function isSimilar(a, b, threshold = exports.HAMMING_THRESHOLD) {
    return hammingDistance(a, b) < threshold;
}
// ============================================================================
// 序列化/反序列化（BigInt 全程化）
// ============================================================================
/**
 * 将 ChunkHashV2 序列化为 32 字节 Buffer
 *
 * 布局 (大端序/网络字节序):
 * - offset 0-7: simhash (uint64, BigInt)
 * - offset 8-23: md5 (16 bytes)
 * - offset 24-27: length (uint32)
 * - offset 28-31: seed (uint32) - 文件级固定 seed
 *
 * RISK-H-007: 统一使用大端序确保跨平台互操作性
 *
 * @param hash - ChunkHashV2 对象
 * @returns 32 字节 Buffer
 */
function serializeChunkHashV2(hash) {
    const buf = Buffer.alloc(32);
    // offset 0-7: simhash - 使用 writeBigUInt64BE，全程 BigInt，RISK-H-007: 大端序
    buf.writeBigUInt64BE(hash.simhash & exports.UINT64_MASK, 0);
    // offset 8-23: md5 (16 bytes)
    if (hash.md5.length !== 16) {
        throw new Error(`MD5 must be 16 bytes, got ${hash.md5.length}`);
    }
    buf.set(hash.md5, 8);
    // offset 24-27: length (uint32) - RISK-H-007: 大端序
    buf.writeUInt32BE(hash.length, 24);
    // offset 28-31: seed (uint32) - 文件级固定 seed，RISK-H-007: 大端序
    buf.writeUInt32BE(hash.seed >>> 0, 28);
    return buf;
}
/**
 * 从 Buffer 反序列化 ChunkHashV2
 *
 * **关键修复**: 使用 readBigUInt64BE() 直接返回 bigint，
 * **禁止**转换为 Number，避免精度丢失
 * RISK-H-007: 使用大端序确保跨平台互操作性
 *
 * @param buf - 32 字节 Buffer
 * @returns ChunkHashV2 对象
 */
function deserializeChunkHashV2(buf) {
    if (buf.length !== 32) {
        throw new Error(`Invalid ChunkHashV2 buffer size: ${buf.length}, expected 32`);
    }
    // **RISK-H-001 修复**: 全程使用 BigInt，禁止 Number() 转换
    // **RISK-H-007 修复**: 使用大端序 (BE)
    const simhash = buf.readBigUInt64BE(0);
    return {
        simhash, // bigint 类型，完整 64 位精度
        md5: Buffer.from(buf.subarray(8, 24)), // 复制一份避免外部修改
        length: buf.readUInt32BE(24), // RISK-H-007: 大端序
        seed: buf.readUInt32BE(28) // 文件级固定 seed（RISK-H-004 修复），RISK-H-007: 大端序
    };
}
/**
 * 序列化 ChunkHashV1 (8 字节，仅 simhash)
 * 用于向后兼容
 *
 * RISK-H-007: 使用大端序确保跨平台互操作性
 *
 * @param simhash - SimHash 值
 * @returns 8 字节 Buffer
 */
function serializeChunkHashV1(simhash) {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(simhash & exports.UINT64_MASK, 0); // RISK-H-007: 大端序
    return buf;
}
/**
 * 反序列化 ChunkHashV1 (8 字节)
 *
 * RISK-H-007: 使用大端序确保跨平台互操作性
 *
 * @param buf - 8 字节 Buffer
 * @returns SimHash 值 (bigint)
 */
function deserializeChunkHashV1(buf) {
    if (buf.length !== 8) {
        throw new Error(`Invalid ChunkHashV1 buffer size: ${buf.length}, expected 8`);
    }
    return buf.readBigUInt64BE(0); // RISK-H-007: 大端序
}
// ============================================================================
// SimHash 计算（RISK-H-004 修复：文件级固定 Seed）
// ============================================================================
/**
 * SimHash Hasher - 基于文件级固定 Seed 的哈希计算器
 *
 * RISK-H-004 修复：
 * - 每个 SimHashHasher 实例绑定一个固定 seed
 * - 相同内容 + 相同 seed = 确定性相同 SimHash
 * - 禁止 per-chunk seed 轮换
 */
class SimHashHasher {
    seed;
    dimensions;
    projectionVectors;
    constructor(options) {
        // 验证 seed 范围
        if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xFFFFFFFF) {
            throw new TypeError('seed must be 32-bit unsigned integer');
        }
        this.seed = options.seed;
        this.dimensions = options.dimensions ?? 64;
        this.projectionVectors = this.initializeProjection();
    }
    /**
     * 初始化投影向量（基于种子确定性生成）
     *
     * 关键：相同的 seed 总是生成相同的投影向量，确保 SimHash 的确定性
     */
    initializeProjection() {
        const vectors = [];
        // 使用种子初始化伪随机数生成器（LCG 算法）
        let state = this.seed;
        const lcg = () => {
            state = (1103515245 * state + 12345) & 0x7FFFFFFF;
            return state;
        };
        // 生成 64 个 64 位投影向量
        for (let i = 0; i < this.dimensions; i++) {
            const lo = BigInt(lcg());
            const hi = BigInt(lcg());
            vectors.push((hi << 32n) | lo);
        }
        return vectors;
    }
    /**
     * 计算内容的 SimHash
     *
     * 简化实现：使用 n-gram 特征 + 随机投影
     *
     * RISK-H-004 保证：
     * - 相同的 content + 相同的 seed = 相同的 hash
     * - 不再受 per-chunk seed 轮换影响
     *
     * @param content - 内容 Buffer
     * @returns 64 位 SimHash (bigint)
     */
    hash(content) {
        // 特征向量（64 维）
        const features = new Int32Array(this.dimensions);
        // 使用 3-gram 作为特征
        const ngramSize = 3;
        for (let i = 0; i <= content.length - ngramSize; i++) {
            // 计算 n-gram 哈希
            let gramHash = 0;
            for (let j = 0; j < ngramSize; j++) {
                gramHash = ((gramHash << 8) | content[i + j]) & 0xFFFFFF;
            }
            // 根据 n-gram 哈希值更新特征向量
            for (let d = 0; d < this.dimensions; d++) {
                // 使用投影向量决定正负
                const projection = Number(this.projectionVectors[d] >> BigInt(gramHash % 64)) & 1;
                features[d] += projection === 1 ? 1 : -1;
            }
        }
        // 二值化：正数为 1，负数为 0
        let simhash = 0n;
        for (let d = 0; d < this.dimensions; d++) {
            if (features[d] > 0) {
                simhash |= (1n << BigInt(d));
            }
        }
        return simhash & exports.UINT64_MASK;
    }
    /**
     * 获取当前文件级固定种子
     */
    getSeed() {
        return this.seed;
    }
}
exports.SimHashHasher = SimHashHasher;
// ============================================================================
// SimHash Chunker - RISK-H-004 核心修复
// ============================================================================
/**
 * SimHash Chunker - 文件级固定 Seed 的块哈希器
 *
 * RISK-H-004 修复核心：
 * - 构造函数接收 fileSeed，所有 chunk 共用此 seed
 * - 禁止 per-chunk seed 轮换
 * - 保证相同内容在不同 chunk 中产生相同 SimHash
 *
 * 使用示例：
 * ```typescript
 * // 新API（推荐）- 文件级固定 seed
 * const chunker = new SimHashChunker({ seed: 12345 });
 * const chunks = chunker.chunk(data);  // 所有块用 seed=12345
 *
 * // 旧API（向后兼容，弃用）
 * const chunker = new SimHashChunker();  // 使用默认 seed
 * ```
 */
class SimHashChunker {
    hasher;
    seed;
    legacyMode = false;
    /**
     * 创建 SimHash Chunker 实例
     *
     * @param options - 配置选项
     * @param options.seed - 文件级固定 seed（32 位无符号整数）
     */
    constructor(options) {
        if (options?.seed !== undefined) {
            // 新API：文件级固定 seed
            this.seed = options.seed >>> 0; // 确保无符号 32 位
            this.legacyMode = false;
        }
        else {
            // 旧API（向后兼容）：使用默认 seed，标记为 LEGACY
            this.seed = exports.DEFAULT_FILE_SEED;
            this.legacyMode = true;
        }
        this.hasher = new SimHashHasher({ seed: this.seed });
    }
    /**
     * 计算单个 chunk 的 SimHash
     *
     * RISK-H-004 保证：所有 chunk 使用同一 seed，确保跨 chunk 可比性
     *
     * @param content - Chunk 内容
     * @returns SimHash 值 (bigint)
     */
    hash(content) {
        return this.hasher.hash(content);
    }
    /**
     * 创建完整的 ChunkHashV2（包括 MD5）
     *
     * @param content - Chunk 内容
     * @returns ChunkHashV2 对象
     */
    createChunkHash(content) {
        return {
            simhash: this.hasher.hash(content),
            md5: computeMD5(content),
            length: content.length,
            seed: this.seed // 文件级固定 seed
        };
    }
    /**
     * 批量处理多个 chunks
     *
     * @param chunks - Chunk 内容数组
     * @returns ChunkHashV2 数组
     */
    chunk(chunks) {
        return chunks.map(content => this.createChunkHash(content));
    }
    /**
     * 获取文件级固定种子
     */
    getSeed() {
        return this.seed;
    }
    /**
     * 检查是否处于 LEGACY 模式（向后兼容）
     *
     * @deprecated 仅用于向后兼容检测
     */
    isLegacyMode() {
        return this.legacyMode;
    }
}
exports.SimHashChunker = SimHashChunker;
/**
 * 比较两个 ChunkHashV2
 *
 * 级联哈希判定逻辑：
 * 1. seed 不一致：跳过 SimHash 比较（无法直接比较）
 * 2. 汉明距离 >= 3：快速判定为 UNIQUE
 * 3. 汉明距离 < 3：进入候选集，需要 MD5 精确校验
 * 4. MD5 不匹配：UNIQUE
 * 5. MD5 匹配 + length 匹配：DUPLICATE
 *
 * RISK-H-004 新增：seed 一致性检查
 *
 * @param a - ChunkHashV2 A
 * @param b - ChunkHashV2 B
 * @param caps - 版本能力
 * @returns 比较结果
 */
function compareChunks(a, b, caps) {
    // RISK-H-004：seed 一致性检查
    // 如果 seed 不同，SimHash 不可直接比较
    if (a.seed !== b.seed) {
        // seed 不同：跳过 SimHash 层，依赖 MD5 精确比较
        if (!caps.supportsCascade) {
            return 'UNCERTAIN';
        }
        // 直接比较 MD5
        if (!a.md5.equals(b.md5)) {
            return 'UNIQUE';
        }
        if (a.length !== b.length) {
            return 'UNIQUE';
        }
        return 'DUPLICATE';
    }
    // 快速路径：汉明距离预筛选（相同 seed 下有效）
    const dist = hammingDistance(a.simhash, b.simhash);
    if (dist >= exports.HAMMING_THRESHOLD) {
        return 'UNIQUE'; // 明显不同，快速排除
    }
    // 进入候选集，需要精确校验
    if (!caps.supportsCascade) {
        // 降级模式：无 MD5 校验，标记为不确定
        return 'UNCERTAIN';
    }
    // 完整级联校验：MD5 比较
    if (!a.md5.equals(b.md5)) {
        return 'UNIQUE'; // MD5 不匹配，确认为不同
    }
    // 额外校验：length 防长度扩展攻击
    if (a.length !== b.length) {
        return 'UNIQUE'; // 保守处理，视为不同
    }
    // 最终确认：SimHash + MD5 双匹配
    return 'DUPLICATE';
}
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 计算 MD5 哈希
 *
 * @param content - 内容 Buffer
 * @returns 16 字节 MD5
 */
function computeMD5(content) {
    return (0, crypto_1.createHash)('md5').update(content).digest();
}
/**
 * 创建 ChunkHashV2（完整计算）
 *
 * RISK-H-004 修复：使用 SimHashChunker 确保文件级固定 seed
 *
 * @param content - 块内容
 * @param seed - 文件级固定 SimHash 种子
 * @returns ChunkHashV2 对象
 */
function createChunkHashV2(content, seed) {
    // 使用 SimHashChunker 确保文件级固定 seed
    const chunker = new SimHashChunker({ seed });
    return chunker.createChunkHash(content);
}
/**
 * 生成随机 64 位 SimHash（用于测试）
 *
 * @returns 随机 SimHash (bigint)
 */
function randomSimHash() {
    const lo = BigInt((0, crypto_1.randomInt)(0x100000000));
    const hi = BigInt((0, crypto_1.randomInt)(0x100000000));
    return (hi << 32n) | lo;
}
/**
 * 验证 SimHash 是否为 bigint 类型
 * 用于 CI 断言，确保没有意外的 Number 转换
 *
 * @param value - 待验证值
 * @throws 如果不是 bigint 类型
 */
function assertSimHashType(value) {
    if (typeof value !== 'bigint') {
        throw new TypeError(`RISK-H-001 VIOLATION: SimHash must be bigint, got ${typeof value}. ` +
            `Any Number() conversion is strictly prohibited.`);
    }
    // 验证范围
    const v = value;
    if (v < 0n || v > exports.UINT64_MASK) {
        throw new RangeError(`SimHash value out of uint64 range: ${v}. ` +
            `Expected: 0n <= value <= 0xFFFFFFFFFFFFFFFFn`);
    }
}
/**
 * 验证两个 chunk 的 seed 一致性
 * RISK-H-004：用于候选检索阶段的 seed 兼容性检查
 *
 * @param a - ChunkHashV2 A
 * @param b - ChunkHashV2 B
 * @returns seed 是否一致
 */
function isSeedCompatible(a, b) {
    return a.seed === b.seed;
}
// ============================================================================
// 导出模块
// ============================================================================
exports.default = {
    SimHashHasher,
    SimHashChunker,
    popcnt64,
    hammingDistance,
    isSimilar,
    serializeChunkHashV2,
    deserializeChunkHashV2,
    serializeChunkHashV1,
    deserializeChunkHashV1,
    compareChunks,
    createChunkHashV2,
    computeMD5,
    randomSimHash,
    assertSimHashType,
    isSeedCompatible,
    HAMMING_THRESHOLD: exports.HAMMING_THRESHOLD,
    UINT64_MASK: exports.UINT64_MASK,
    DEFAULT_FILE_SEED: exports.DEFAULT_FILE_SEED
};
//# sourceMappingURL=simhash-chunker.js.map