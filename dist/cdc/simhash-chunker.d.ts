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
/**
 * SimHash 类型 - 强制使用 bigint 表示 64 位无符号整数
 *
 * 范围: 0n 到 0xFFFFFFFFFFFFFFFFn (2^64 - 1)
 */
export type SimHashValue = bigint;
/**
 * SimHash Hasher 选项
 */
export interface SimHashOptions {
    /** 32 位无符号整数种子 */
    seed: number;
    /** 投影维度，默认 64 */
    dimensions?: number;
}
/**
 * SimHash Chunker 选项（文件级固定 Seed）
 */
export interface SimHashChunkerOptions {
    /**
     * 文件级固定种子 - 所有 chunk 共用此 seed
     * 修复 RISK-H-004: 防止 per-chunk seed 轮换导致漏检
     */
    seed: number;
    /** 投影维度，默认 64 */
    dimensions?: number;
}
/**
 * ChunkHashV2 结构体 - 级联哈希条目
 *
 * 内存布局 (32 bytes):
 * - simhash: 8 bytes (uint64, BigInt)
 * - md5: 16 bytes (uint128)
 * - length: 4 bytes (uint32)
 * - seed: 4 bytes (uint32) - 文件级固定 seed
 *
 * RISK-H-004 变更：seed 字段现在表示"文件级固定 seed"，而非 per-chunk seed
 */
export interface ChunkHashV2 {
    /** SimHash 64 位指纹 - 使用 bigint 全程化 */
    simhash: SimHashValue;
    /** MD5 128 位哈希 */
    md5: Buffer;
    /** 块长度 */
    length: number;
    /**
     * 文件级固定 seed（RISK-H-004 修复）
     * 此前：per-chunk 随机 seed（已废弃）
     * 现在：整个文件共用同一 seed
     */
    seed: number;
}
/**
 * @deprecated LEGACY 模式 - per-chunk seed 已废弃，仅用于向后兼容
 */
export interface LegacyChunkHashV2 extends ChunkHashV2 {
    /** @deprecated per-chunk seed 不保证跨 chunk 一致性 */
    _legacyPerChunkSeed?: boolean;
}
/** 64 位掩码 - 用于确保 bigint 在 64 位范围内 */
export declare const UINT64_MASK = 18446744073709551615n;
/** 汉明距离阈值 - 根据 MATH-001 分析，h=3 是最优选择 */
export declare const HAMMING_THRESHOLD = 3;
/** 默认文件级种子 */
export declare const DEFAULT_FILE_SEED = 539296289;
/**
 * 计算 64 位 BigInt 的汉明权重（popcount）
 *
 * 使用分段计算策略：将 64 位分成两个 32 位分别计算
 * 避免直接对 BigInt 进行位操作的性能问题
 *
 * @param value - 64 位 BigInt 值
 * @returns 1 的位数 (0-64)
 */
export declare function popcnt64(value: SimHashValue): number;
/**
 * 计算两个 SimHash 的汉明距离
 *
 * @param a - SimHash A
 * @param b - SimHash B
 * @returns 汉明距离 (0-64)
 */
export declare function hammingDistance(a: SimHashValue, b: SimHashValue): number;
/**
 * 检查两个 SimHash 是否在阈值内相似
 *
 * @param a - SimHash A
 * @param b - SimHash B
 * @param threshold - 汉明距离阈值，默认 3
 * @returns 是否相似
 */
export declare function isSimilar(a: SimHashValue, b: SimHashValue, threshold?: number): boolean;
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
export declare function serializeChunkHashV2(hash: ChunkHashV2): Buffer;
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
export declare function deserializeChunkHashV2(buf: Buffer): ChunkHashV2;
/**
 * 序列化 ChunkHashV1 (8 字节，仅 simhash)
 * 用于向后兼容
 *
 * RISK-H-007: 使用大端序确保跨平台互操作性
 *
 * @param simhash - SimHash 值
 * @returns 8 字节 Buffer
 */
export declare function serializeChunkHashV1(simhash: SimHashValue): Buffer;
/**
 * 反序列化 ChunkHashV1 (8 字节)
 *
 * RISK-H-007: 使用大端序确保跨平台互操作性
 *
 * @param buf - 8 字节 Buffer
 * @returns SimHash 值 (bigint)
 */
export declare function deserializeChunkHashV1(buf: Buffer): SimHashValue;
/**
 * SimHash Hasher - 基于文件级固定 Seed 的哈希计算器
 *
 * RISK-H-004 修复：
 * - 每个 SimHashHasher 实例绑定一个固定 seed
 * - 相同内容 + 相同 seed = 确定性相同 SimHash
 * - 禁止 per-chunk seed 轮换
 */
export declare class SimHashHasher {
    private readonly seed;
    private readonly dimensions;
    private projectionVectors;
    constructor(options: SimHashOptions);
    /**
     * 初始化投影向量（基于种子确定性生成）
     *
     * 关键：相同的 seed 总是生成相同的投影向量，确保 SimHash 的确定性
     */
    private initializeProjection;
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
    hash(content: Buffer): SimHashValue;
    /**
     * 获取当前文件级固定种子
     */
    getSeed(): number;
}
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
export declare class SimHashChunker {
    private readonly hasher;
    private readonly seed;
    private legacyMode;
    /**
     * 创建 SimHash Chunker 实例
     *
     * @param options - 配置选项
     * @param options.seed - 文件级固定 seed（32 位无符号整数）
     */
    constructor(options?: SimHashChunkerOptions);
    /**
     * 计算单个 chunk 的 SimHash
     *
     * RISK-H-004 保证：所有 chunk 使用同一 seed，确保跨 chunk 可比性
     *
     * @param content - Chunk 内容
     * @returns SimHash 值 (bigint)
     */
    hash(content: Buffer): SimHashValue;
    /**
     * 创建完整的 ChunkHashV2（包括 MD5）
     *
     * @param content - Chunk 内容
     * @returns ChunkHashV2 对象
     */
    createChunkHash(content: Buffer): ChunkHashV2;
    /**
     * 批量处理多个 chunks
     *
     * @param chunks - Chunk 内容数组
     * @returns ChunkHashV2 数组
     */
    chunk(chunks: Buffer[]): ChunkHashV2[];
    /**
     * 获取文件级固定种子
     */
    getSeed(): number;
    /**
     * 检查是否处于 LEGACY 模式（向后兼容）
     *
     * @deprecated 仅用于向后兼容检测
     */
    isLegacyMode(): boolean;
}
/**
 * 比较结果类型
 */
export type CompareResult = 'DUPLICATE' | 'UNIQUE' | 'UNCERTAIN';
/**
 * 版本能力检测
 */
export interface VersionCapabilities {
    hashType: 0x01 | 0x02 | 0x03 | 0x04;
    supportsCascade: boolean;
    supportsSeedConfig: boolean;
    maxHashSize: number;
}
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
export declare function compareChunks(a: ChunkHashV2, b: ChunkHashV2, caps: VersionCapabilities): CompareResult;
/**
 * 计算 MD5 哈希
 *
 * @param content - 内容 Buffer
 * @returns 16 字节 MD5
 */
export declare function computeMD5(content: Buffer): Buffer;
/**
 * 创建 ChunkHashV2（完整计算）
 *
 * RISK-H-004 修复：使用 SimHashChunker 确保文件级固定 seed
 *
 * @param content - 块内容
 * @param seed - 文件级固定 SimHash 种子
 * @returns ChunkHashV2 对象
 */
export declare function createChunkHashV2(content: Buffer, seed: number): ChunkHashV2;
/**
 * 生成随机 64 位 SimHash（用于测试）
 *
 * @returns 随机 SimHash (bigint)
 */
export declare function randomSimHash(): SimHashValue;
/**
 * 验证 SimHash 是否为 bigint 类型
 * 用于 CI 断言，确保没有意外的 Number 转换
 *
 * @param value - 待验证值
 * @throws 如果不是 bigint 类型
 */
export declare function assertSimHashType(value: unknown): asserts value is SimHashValue;
/**
 * 验证两个 chunk 的 seed 一致性
 * RISK-H-004：用于候选检索阶段的 seed 兼容性检查
 *
 * @param a - ChunkHashV2 A
 * @param b - ChunkHashV2 B
 * @returns seed 是否一致
 */
export declare function isSeedCompatible(a: ChunkHashV2, b: ChunkHashV2): boolean;
declare const _default: {
    SimHashHasher: typeof SimHashHasher;
    SimHashChunker: typeof SimHashChunker;
    popcnt64: typeof popcnt64;
    hammingDistance: typeof hammingDistance;
    isSimilar: typeof isSimilar;
    serializeChunkHashV2: typeof serializeChunkHashV2;
    deserializeChunkHashV2: typeof deserializeChunkHashV2;
    serializeChunkHashV1: typeof serializeChunkHashV1;
    deserializeChunkHashV1: typeof deserializeChunkHashV1;
    compareChunks: typeof compareChunks;
    createChunkHashV2: typeof createChunkHashV2;
    computeMD5: typeof computeMD5;
    randomSimHash: typeof randomSimHash;
    assertSimHashType: typeof assertSimHashType;
    isSeedCompatible: typeof isSeedCompatible;
    HAMMING_THRESHOLD: number;
    UINT64_MASK: bigint;
    DEFAULT_FILE_SEED: number;
};
export default _default;
//# sourceMappingURL=simhash-chunker.d.ts.map