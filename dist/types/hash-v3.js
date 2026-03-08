"use strict";
/**
 * CASCADE-SHA256 类型定义 (Hash Type 0x03)
 *
 * 工单: B-08/09 UPGRADE-ROADMAP-001
 * 安全级别: 宇宙级 (2^-256 冲突率)
 *
 * @module hash-v3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIZES = exports.OFFSETS = exports.SHA256_ENTRY_SIZE = exports.CASCADE_SHA256 = void 0;
exports.createEmptyChunkHashV3 = createEmptyChunkHashV3;
exports.serializeChunkHashV3 = serializeChunkHashV3;
exports.deserializeChunkHashV3 = deserializeChunkHashV3;
exports.validateChunkHashV3 = validateChunkHashV3;
exports.chunkHashV3ToString = chunkHashV3ToString;
exports.equalChunkHashV3 = equalChunkHashV3;
// ============================================================================
// 常量定义
// ============================================================================
/**
 * CASCADE_SHA256 hash type identifier
 *
 * 0x03: SimHash-64 + SHA256-256 (48B entry)
 */
exports.CASCADE_SHA256 = 0x03;
/**
 * SHA256 entry size in bytes
 *
 * 结构: SimHash-64 (8B) + SHA256-256 (32B) + length (4B) + seed (4B) = 48B
 */
exports.SHA256_ENTRY_SIZE = 48;
/**
 * 各字段偏移量定义
 */
exports.OFFSETS = {
    SIMHASH: 0, // 0-7
    SHA256: 8, // 8-39
    LENGTH: 40, // 40-43
    SEED: 44 // 44-47
};
/**
 * 各字段大小定义
 */
exports.SIZES = {
    SIMHASH: 8, // 64 bits
    SHA256: 32, // 256 bits
    LENGTH: 4, // 32 bits
    SEED: 4 // 32 bits
};
// ============================================================================
// 序列化 / 反序列化函数
// ============================================================================
/**
 * 创建空的 ChunkHashV3 对象
 *
 * @returns 初始化为零值的 ChunkHashV3
 */
function createEmptyChunkHashV3() {
    return {
        simhash: 0n,
        sha256: Buffer.alloc(exports.SIZES.SHA256),
        length: 0,
        seed: 0
    };
}
/**
 * 序列化 ChunkHashV3 为 Buffer
 *
 * @param chunk - ChunkHashV3 对象
 * @returns 48 字节 Buffer
 */
function serializeChunkHashV3(chunk) {
    const buf = Buffer.alloc(exports.SHA256_ENTRY_SIZE);
    // offset 0-7: simhash (uint64 BE) - RISK-H-007
    buf.writeBigUInt64BE(chunk.simhash & 0xffffffffffffffffn, exports.OFFSETS.SIMHASH);
    // offset 8-39: sha256 (32 bytes)
    const sha256Buf = chunk.sha256.length === exports.SIZES.SHA256
        ? chunk.sha256
        : Buffer.concat([chunk.sha256, Buffer.alloc(exports.SIZES.SHA256 - chunk.sha256.length)]).subarray(0, exports.SIZES.SHA256);
    sha256Buf.copy(buf, exports.OFFSETS.SHA256);
    // offset 40-43: length (uint32 BE) - RISK-H-007
    buf.writeUInt32BE(chunk.length >>> 0, exports.OFFSETS.LENGTH);
    // offset 44-47: seed (uint32 BE) - RISK-H-007
    buf.writeUInt32BE(chunk.seed >>> 0, exports.OFFSETS.SEED);
    return buf;
}
/**
 * 从 Buffer 反序列化 ChunkHashV3
 *
 * @param buf - 输入缓冲区（至少 48 字节）
 * @returns ChunkHashV3 对象
 * @throws Error 如果缓冲区大小不足
 */
function deserializeChunkHashV3(buf) {
    if (buf.length < exports.SHA256_ENTRY_SIZE) {
        throw new Error(`Buffer too small for ChunkHashV3: ${buf.length} bytes, ` +
            `expected at least ${exports.SHA256_ENTRY_SIZE} bytes`);
    }
    return {
        simhash: buf.readBigUInt64BE(exports.OFFSETS.SIMHASH), // RISK-H-007: 大端序
        sha256: Buffer.from(buf.subarray(exports.OFFSETS.SHA256, exports.OFFSETS.SHA256 + exports.SIZES.SHA256)),
        length: buf.readUInt32BE(exports.OFFSETS.LENGTH), // RISK-H-007: 大端序
        seed: buf.readUInt32BE(exports.OFFSETS.SEED) // RISK-H-007: 大端序
    };
}
/**
 * 验证 ChunkHashV3 对象的有效性
 *
 * @param chunk - 待验证的对象
 * @returns 验证结果
 */
function validateChunkHashV3(chunk) {
    const errors = [];
    // 验证 simhash (bigint)
    if (typeof chunk.simhash !== 'bigint') {
        errors.push(`simhash must be bigint, got ${typeof chunk.simhash}`);
    }
    // 验证 sha256 (Buffer, 32 bytes)
    if (!Buffer.isBuffer(chunk.sha256)) {
        errors.push(`sha256 must be Buffer, got ${typeof chunk.sha256}`);
    }
    else if (chunk.sha256.length !== exports.SIZES.SHA256) {
        errors.push(`sha256 must be ${exports.SIZES.SHA256} bytes, got ${chunk.sha256.length}`);
    }
    // 验证 length (uint32)
    if (!Number.isInteger(chunk.length) || chunk.length < 0 || chunk.length > 0xFFFFFFFF) {
        errors.push(`length must be uint32, got ${chunk.length}`);
    }
    // 验证 seed (uint32)
    if (!Number.isInteger(chunk.seed) || chunk.seed < 0 || chunk.seed > 0xFFFFFFFF) {
        errors.push(`seed must be uint32, got ${chunk.seed}`);
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * 计算 ChunkHashV3 的字符串表示（用于调试）
 *
 * @param chunk - ChunkHashV3 对象
 * @returns 人类可读的字符串
 */
function chunkHashV3ToString(chunk) {
    const sha256Hex = chunk.sha256.toString('hex').substring(0, 16) + '...';
    return `ChunkHashV3{simhash=${chunk.simhash.toString(16)}, sha256=${sha256Hex}, length=${chunk.length}, seed=${chunk.seed}}`;
}
/**
 * 比较两个 ChunkHashV3 是否相等
 *
 * @param a - 第一个 ChunkHashV3
 * @param b - 第二个 ChunkHashV3
 * @returns 是否相等
 */
function equalChunkHashV3(a, b) {
    return (a.simhash === b.simhash &&
        a.sha256.equals(b.sha256) &&
        a.length === b.length &&
        a.seed === b.seed);
}
// ============================================================================
// 导出模块
// ============================================================================
exports.default = {
    CASCADE_SHA256: exports.CASCADE_SHA256,
    SHA256_ENTRY_SIZE: exports.SHA256_ENTRY_SIZE,
    OFFSETS: exports.OFFSETS,
    SIZES: exports.SIZES,
    createEmptyChunkHashV3,
    serializeChunkHashV3,
    deserializeChunkHashV3,
    validateChunkHashV3,
    chunkHashV3ToString,
    equalChunkHashV3
};
//# sourceMappingURL=hash-v3.js.map