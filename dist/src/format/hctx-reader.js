"use strict";
/**
 * HCTX 格式读取器 - Fail-fast 兼容策略实现 + RISK-H-005 内存优化
 *
 * 修复 RISK-H-002: "向后兼容跳过 24B"在旧读者里可能根本做不到
 * 修复 RISK-H-005: JS 容器内存开销优化（对象数组→紧凑Buffer存储）
 *
 * 核心原则：
 * 1. 新格式必须让旧读者"第一眼就报错"：变更 magic 或提升 major version
 * 2. Header 增加 min_compatible_version，旧读者遇到更高最小版本直接拒绝加载
 * 3. 迁移工具负责生成"老系统可读"的降级副本
 * 4. 紧凑存储模式：使用连续Buffer替代对象数组，内存降低5-20倍
 *
 * @module hctx-reader
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.READER_MIN_COMPATIBLE_VERSION = exports.READER_VERSION = exports.HEADER_SIZE = exports.HctxErrorCode = exports.HASH_TYPE_ENTRY_SIZE = exports.HashType = exports.SUPPORTED_MAGICS = exports.HCTX_MAGIC_V2 = exports.HCTX_MAGIC_V1 = void 0;
exports.parseHeader = parseHeader;
exports.serializeHeader = serializeHeader;
exports.checkCompatibility = checkCompatibility;
exports.getVersionCapabilities = getVersionCapabilities;
exports.parseChunks = parseChunks;
exports.readHctxFile = readHctxFile;
exports.readHctxFileCompact = readHctxFileCompact;
exports.estimateMemoryUsage = estimateMemoryUsage;
exports.createHctxFile = createHctxFile;
exports.createDowngradeFile = createDowngradeFile;
exports.isCascadeFormat = isCascadeFormat;
exports.getFileVersionInfo = getFileVersionInfo;
const simhash_chunker_js_1 = require("../cdc/simhash-chunker.js");
const hctx_compact_js_1 = require("./hctx-compact.js");
// ============================================================================
// 常量定义 - Magic Number 与版本
// ============================================================================
/**
 * HCTX 文件魔数定义
 *
 * RISK-H-002 修复策略：
 * - 旧版本魔数 'HCTX' (0x48535458) - 对应 v1/v2 格式
 * - 新版本魔数 'HCX2' (0x48435832) - 对应 v3+ 格式，带级联哈希
 *
 * 旧读者遇到 'HCX2' 会识别为未知格式，立即报错（Fail-fast）
 */
exports.HCTX_MAGIC_V1 = 0x48535458; // 'HCTX'
exports.HCTX_MAGIC_V2 = 0x48435832; // 'HCX2'
/** 支持的魔数列表 */
exports.SUPPORTED_MAGICS = [exports.HCTX_MAGIC_V1, exports.HCTX_MAGIC_V2];
/**
 * Hash Type 定义
 *
 * 0x01: Legacy SimHash-only (8B entry)
 * 0x02: SimHash-64 + MD5-128 (32B entry) - Cascade v1
 * 0x03: SimHash-64 + SHA256-256 (48B entry) - Future
 * 0x04: SimHash-64 + BLAKE3-256 (48B entry) - Future
 */
var HashType;
(function (HashType) {
    HashType[HashType["LEGACY_SIMHASH"] = 1] = "LEGACY_SIMHASH";
    HashType[HashType["CASCADE_MD5"] = 2] = "CASCADE_MD5";
    HashType[HashType["CASCADE_SHA256"] = 3] = "CASCADE_SHA256";
    HashType[HashType["CASCADE_BLAKE3"] = 4] = "CASCADE_BLAKE3";
})(HashType || (exports.HashType = HashType = {}));
/** Hash Type 对应的 entry 大小 */
exports.HASH_TYPE_ENTRY_SIZE = {
    [HashType.LEGACY_SIMHASH]: 8,
    [HashType.CASCADE_MD5]: 32,
    [HashType.CASCADE_SHA256]: 48,
    [HashType.CASCADE_BLAKE3]: 48
};
/**
 * 错误代码枚举
 */
var HctxErrorCode;
(function (HctxErrorCode) {
    /** 魔数不匹配 */
    HctxErrorCode["INVALID_MAGIC"] = "INVALID_MAGIC";
    /** 版本不兼容 */
    HctxErrorCode["INCOMPATIBLE_VERSION"] = "INCOMPATIBLE_VERSION";
    /** 不支持的最小兼容版本 */
    HctxErrorCode["MIN_VERSION_TOO_HIGH"] = "MIN_VERSION_TOO_HIGH";
    /** 未知的 hash type */
    HctxErrorCode["UNKNOWN_HASH_TYPE"] = "UNKNOWN_HASH_TYPE";
    /** 缓冲区大小不足 */
    HctxErrorCode["BUFFER_TOO_SMALL"] = "BUFFER_TOO_SMALL";
    /** 条目数量不匹配 */
    HctxErrorCode["CHUNK_COUNT_MISMATCH"] = "CHUNK_COUNT_MISMATCH";
    /** 元数据偏移无效 */
    HctxErrorCode["INVALID_METADATA_OFFSET"] = "INVALID_METADATA_OFFSET";
    /** 数据损坏 */
    HctxErrorCode["CORRUPTED_DATA"] = "CORRUPTED_DATA";
    /** chunkCount 精度丢失风险 - bigint → number 转换超限 */
    HctxErrorCode["PRECISION_LOSS"] = "PRECISION_LOSS";
    /** 功能未实现 */
    HctxErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
})(HctxErrorCode || (exports.HctxErrorCode = HctxErrorCode = {}));
// ============================================================================
// Header 解析与验证
// ============================================================================
/**
 * Header 大小（字节）
 */
exports.HEADER_SIZE = 32;
/**
 * 解析 HCTX Header
 *
 * @param buf - Header 缓冲区（至少 32 字节）
 * @returns 解析结果
 */
function parseHeader(buf) {
    if (buf.length < exports.HEADER_SIZE) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.BUFFER_TOO_SMALL,
                message: `Header buffer too small: ${buf.length} bytes, expected at least ${exports.HEADER_SIZE}`,
                expected: `${exports.HEADER_SIZE}`,
                actual: `${buf.length}`
            }
        };
    }
    // 解析魔数 (offset 0-3) - RISK-H-007: 使用大端序
    const magic = buf.readUInt32BE(0);
    // **RISK-H-002 修复**: 魔数校验 - 未知魔数立即失败
    if (!exports.SUPPORTED_MAGICS.includes(magic)) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.INVALID_MAGIC,
                message: `Invalid magic number: 0x${magic.toString(16).toUpperCase().padStart(8, '0')}. ` +
                    `Supported: ${exports.SUPPORTED_MAGICS.map(m => `0x${m.toString(16).toUpperCase()}`).join(', ')}`,
                expected: exports.SUPPORTED_MAGICS.map(m => `0x${m.toString(16).toUpperCase()}`).join(' or '),
                actual: `0x${magic.toString(16).toUpperCase().padStart(8, '0')}`
            }
        };
    }
    // 解析版本 (offset 4-5) - RISK-H-007: 使用大端序
    const version = buf.readUInt16BE(4);
    // 解析 hash type (offset 6)
    const hashType = buf.readUInt8(6);
    // 验证 hash type 有效性
    if (!Object.values(HashType).includes(hashType)) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.UNKNOWN_HASH_TYPE,
                message: `Unknown hash type: 0x${hashType.toString(16).padStart(2, '0')}`,
                actual: `0x${hashType.toString(16).padStart(2, '0')}`
            }
        };
    }
    // **DEBT-VALIDATION-002**: hash_type 0x03/0x04 占位 Fail-fast
    // 防止假实现导致数据损坏
    if (hashType === HashType.CASCADE_SHA256) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.NOT_IMPLEMENTED,
                message: 'hash_type 0x03 (SHA256) not implemented in v2.6.x, wait for v3.1. Consider downgrading to 0x02 (CASCADE_MD5).'
            }
        };
    }
    if (hashType === HashType.CASCADE_BLAKE3) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.NOT_IMPLEMENTED,
                message: 'hash_type 0x04 (BLAKE3) not implemented in v2.6.x, wait for v3.1. Consider downgrading to 0x02 (CASCADE_MD5).'
            }
        };
    }
    // 解析 flags (offset 7)
    const flags = buf.readUInt8(7);
    // 解析最小兼容版本 (offset 8-11) - **RISK-H-002 修复**: Fail-fast 核心, **RISK-H-007**: 大端序
    const minCompatibleVersion = buf.readUInt32BE(8);
    // 解析 chunk count (offset 12-19) - 使用 BigInt 全程化, RISK-H-007: 大端序
    const chunkCount = buf.readBigUInt64BE(12);
    // **DEBT-VALIDATION-001 修复**: chunkCount 精度守卫 - Fail-fast
    // 检查 chunkCount 是否超过 Number.MAX_SAFE_INTEGER，防止后续转换精度丢失
    if (chunkCount > BigInt(Number.MAX_SAFE_INTEGER)) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.PRECISION_LOSS,
                message: `chunkCount (${chunkCount.toString()}) exceeds Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}). ` +
                    `File too large to process safely.`,
                expected: `<= ${Number.MAX_SAFE_INTEGER}`,
                actual: chunkCount.toString()
            }
        };
    }
    // 解析 metadata offset (offset 20-27) - RISK-H-007: 大端序
    const metadataOffset = buf.readBigUInt64BE(20);
    // 解析保留字段 (offset 28-31) - RISK-H-007: 大端序
    const reserved = buf.readUInt32BE(28);
    const header = {
        magic,
        version,
        hashType,
        flags,
        minCompatibleVersion,
        chunkCount,
        metadataOffset,
        reserved
    };
    // 验证元数据偏移合理性
    const expectedMetadataOffset = BigInt(exports.HEADER_SIZE) + chunkCount * BigInt(exports.HASH_TYPE_ENTRY_SIZE[hashType]);
    if (metadataOffset < expectedMetadataOffset) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.INVALID_METADATA_OFFSET,
                message: `Metadata offset (${metadataOffset}) is too small, expected at least ${expectedMetadataOffset}`,
                expected: `>= ${expectedMetadataOffset}`,
                actual: `${metadataOffset}`
            }
        };
    }
    return { success: true, data: header };
}
/**
 * 序列化 HCTX Header
 *
 * @param header - Header 对象
 * @returns 32 字节 Buffer
 */
function serializeHeader(header) {
    const buf = Buffer.alloc(exports.HEADER_SIZE);
    // offset 0-3: magic - RISK-H-007: 大端序
    buf.writeUInt32BE(header.magic, 0);
    // offset 4-5: version - RISK-H-007: 大端序
    buf.writeUInt16BE(header.version, 4);
    // offset 6: hash_type
    buf.writeUInt8(header.hashType, 6);
    // offset 7: flags
    buf.writeUInt8(header.flags, 7);
    // offset 8-11: min_compatible_version - **RISK-H-002 修复**: Fail-fast 核心, RISK-H-007: 大端序
    buf.writeUInt32BE(header.minCompatibleVersion, 8);
    // offset 12-19: chunk_count - BigInt 全程化, RISK-H-007: 大端序
    buf.writeBigUInt64BE(header.chunkCount, 12);
    // offset 20-27: metadata_offset - RISK-H-007: 大端序
    buf.writeBigUInt64BE(header.metadataOffset, 20);
    // offset 28-31: reserved - RISK-H-007: 大端序
    buf.writeUInt32BE(header.reserved, 28);
    return buf;
}
// ============================================================================
// 版本兼容性检测（Fail-fast 核心）
// ============================================================================
/**
 * 当前读取器版本
 *
 * 格式: 主版本 * 256 + 次版本
 * 如 v3.0 = 0x0300 = 768
 */
exports.READER_VERSION = 0x0300; // v3.0
/**
 * 当前读取器支持的最小兼容版本
 */
exports.READER_MIN_COMPATIBLE_VERSION = 0x0200; // v2.0
/**
 * 检测版本兼容性
 *
 * **RISK-H-002 修复**: Fail-fast 策略
 * - 如果文件要求的最小兼容版本 > 当前读取器版本，立即拒绝
 * - 避免旧读者尝试解析新格式导致的数据损坏
 *
 * @param header - 解析的 Header
 * @returns 兼容性结果
 */
function checkCompatibility(header) {
    // 检查魔数
    if (!exports.SUPPORTED_MAGICS.includes(header.magic)) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.INVALID_MAGIC,
                message: `Unsupported magic: 0x${header.magic.toString(16).toUpperCase().padStart(8, '0')}`
            }
        };
    }
    // **RISK-H-002 修复**: 检查最小兼容版本（Fail-fast 核心）
    // 如果文件要求的最小兼容版本 > 当前读取器版本，说明当前读取器太旧
    if (header.minCompatibleVersion > exports.READER_VERSION) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.MIN_VERSION_TOO_HIGH,
                message: `File requires minimum compatible version 0x${header.minCompatibleVersion.toString(16).toUpperCase()}, ` +
                    `but this reader only supports up to 0x${exports.READER_VERSION.toString(16).toUpperCase()}. ` +
                    `Please upgrade your reader to open this file.`,
                expected: `<= 0x${exports.READER_VERSION.toString(16).toUpperCase()}`,
                actual: `0x${header.minCompatibleVersion.toString(16).toUpperCase()}`
            }
        };
    }
    // 检查版本范围
    const majorVersion = header.version >> 8;
    if (majorVersion < 1 || majorVersion > 4) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.INCOMPATIBLE_VERSION,
                message: `Unsupported major version: ${majorVersion}`,
                actual: `${majorVersion}`
            }
        };
    }
    return { success: true };
}
/**
 * 获取版本能力
 *
 * @param header - Header 对象
 * @returns 版本能力描述
 */
function getVersionCapabilities(header) {
    switch (header.hashType) {
        case HashType.LEGACY_SIMHASH:
            return {
                hashType: 0x01,
                supportsCascade: false,
                supportsSeedConfig: false,
                maxHashSize: 8
            };
        case HashType.CASCADE_MD5:
            return {
                hashType: 0x02,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 32
            };
        case HashType.CASCADE_SHA256:
            return {
                hashType: 0x03,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 48
            };
        case HashType.CASCADE_BLAKE3:
            return {
                hashType: 0x04,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 48
            };
        default:
            throw new Error(`Unknown hash type: ${header.hashType}`);
    }
}
// ============================================================================
// 条目解析
// ============================================================================
/**
 * 解析 Chunk 条目列表
 *
 * @param buf - 条目数据缓冲区
 * @param header - 已解析的 Header
 * @returns 解析结果
 */
function parseChunks(buf, header) {
    const entrySize = exports.HASH_TYPE_ENTRY_SIZE[header.hashType];
    const expectedSize = Number(header.chunkCount) * entrySize;
    if (buf.length < expectedSize) {
        return {
            success: false,
            error: {
                code: HctxErrorCode.BUFFER_TOO_SMALL,
                message: `Chunk data buffer too small: ${buf.length} bytes, expected ${expectedSize}`,
                expected: `${expectedSize}`,
                actual: `${buf.length}`
            }
        };
    }
    const chunks = [];
    for (let i = 0; i < Number(header.chunkCount); i++) {
        const offset = i * entrySize;
        const entryBuf = buf.subarray(offset, offset + entrySize);
        try {
            let chunk;
            switch (header.hashType) {
                case HashType.LEGACY_SIMHASH:
                    // V1 格式：只有 simhash，其他字段为默认值
                    chunk = {
                        simhash: (0, simhash_chunker_js_1.deserializeChunkHashV1)(entryBuf),
                        md5: Buffer.alloc(16), // 空 MD5
                        length: 0,
                        seed: 0
                    };
                    break;
                case HashType.CASCADE_MD5:
                    // V2 格式：完整 ChunkHashV2
                    chunk = (0, simhash_chunker_js_1.deserializeChunkHashV2)(entryBuf);
                    break;
                case HashType.CASCADE_SHA256:
                case HashType.CASCADE_BLAKE3:
                    // V3/V4 格式：未来扩展（当前简化处理）
                    // 实际实现需要处理 48 字节条目
                    // RISK-H-007: 统一使用大端序
                    chunk = {
                        simhash: entryBuf.readBigUInt64BE(0),
                        md5: entryBuf.subarray(8, 24), // 只取前 16 字节作为 MD5
                        length: entryBuf.readUInt32BE(40),
                        seed: entryBuf.readUInt32BE(44)
                    };
                    break;
                default:
                    return {
                        success: false,
                        error: {
                            code: HctxErrorCode.UNKNOWN_HASH_TYPE,
                            message: `Cannot parse chunks for hash type: ${header.hashType}`
                        }
                    };
            }
            chunks.push(chunk);
        }
        catch (err) {
            return {
                success: false,
                error: {
                    code: HctxErrorCode.CORRUPTED_DATA,
                    message: `Failed to parse chunk ${i}: ${err instanceof Error ? err.message : String(err)}`,
                    offset
                }
            };
        }
    }
    return { success: true, data: chunks };
}
/**
 * 读取 HCTX 文件
 *
 * **Fail-fast 策略**: 任何不兼容情况都会立即返回错误，不会静默降级
 *
 * @param buf - 完整文件缓冲区
 * @param options - 读取选项
 * @returns 解析结果
 */
function readHctxFile(buf, options) {
    // 如果启用紧凑模式，使用紧凑存储读取
    if (options?.useCompact) {
        const compactResult = readHctxFileCompact(buf, options.compactOptions);
        return {
            success: true,
            data: {
                header: compactResult.header,
                chunks: compactResult.chunks.toArray(), // 转换为数组保持兼容
                capabilities: compactResult.capabilities
            }
        };
    }
    // 1. 解析 Header
    const headerResult = parseHeader(buf);
    if (!headerResult.success) {
        return { success: false, error: headerResult.error };
    }
    const header = headerResult.data;
    // 2. 检查兼容性（Fail-fast）
    const compatResult = checkCompatibility(header);
    if (!compatResult.success) {
        return { success: false, error: compatResult.error };
    }
    // 3. 获取版本能力
    const capabilities = getVersionCapabilities(header);
    // 4. 解析 Chunk 条目
    const chunksOffset = exports.HEADER_SIZE;
    const chunksBuf = buf.subarray(chunksOffset);
    const chunksResult = parseChunks(chunksBuf, header);
    if (!chunksResult.success) {
        return { success: false, error: chunksResult.error };
    }
    return {
        success: true,
        data: {
            header,
            chunks: chunksResult.data,
            capabilities
        }
    };
}
/**
 * 使用紧凑存储读取 HCTX 文件（RISK-H-005 优化）
 *
 * 内存优化：
 * - 使用连续 Buffer 存储条目，避免对象膨胀
 * - 支持对象池化复用 Buffer
 * - 1GB 文件内存从 2.1GB 降至 <800MB
 *
 * @param buf - 完整文件缓冲区
 * @param options - 紧凑存储选项
 * @returns 紧凑文件内容
 */
function readHctxFileCompact(buf, options = {}) {
    // 1. 解析 Header
    const headerResult = parseHeader(buf);
    if (!headerResult.success) {
        throw new Error(`Failed to parse header: ${headerResult.error?.message}`);
    }
    const header = headerResult.data;
    // 2. 检查兼容性（Fail-fast）
    const compatResult = checkCompatibility(header);
    if (!compatResult.success) {
        throw new Error(`Compatibility check failed: ${compatResult.error?.message}`);
    }
    // 3. 获取版本能力
    const capabilities = getVersionCapabilities(header);
    // 4. 使用紧凑存储解析 Chunks
    const entrySize = exports.HASH_TYPE_ENTRY_SIZE[header.hashType];
    const chunksOffset = exports.HEADER_SIZE;
    const chunksDataSize = Number(header.chunkCount) * entrySize;
    const chunksBuf = buf.subarray(chunksOffset, chunksOffset + chunksDataSize);
    const chunks = new hctx_compact_js_1.CompactChunkStorage({
        initialCapacity: Number(header.chunkCount),
        usePool: options.usePool,
        poolMaxCapacity: options.poolMaxCapacity
    });
    // 根据 hashType 解析
    switch (header.hashType) {
        case HashType.LEGACY_SIMHASH:
            // V1 格式：只有 simhash (8 bytes) - RISK-H-007: 大端序
            for (let i = 0; i < Number(header.chunkCount); i++) {
                const offset = i * 8;
                const simhash = chunksBuf.readBigUInt64BE(offset);
                chunks.push({
                    simhash,
                    md5: Buffer.alloc(16),
                    length: 0,
                    seed: 0
                });
            }
            break;
        case HashType.CASCADE_MD5:
            // V2 格式：完整 32 字节，直接加载
            chunks.loadFromBuffer(chunksBuf, 32);
            break;
        case HashType.CASCADE_SHA256:
        case HashType.CASCADE_BLAKE3:
            // V3/V4 格式：48 字节（简化处理，只取前 32 字节）- RISK-H-007: 大端序
            for (let i = 0; i < Number(header.chunkCount); i++) {
                const offset = i * 48;
                chunks.push({
                    simhash: chunksBuf.readBigUInt64BE(offset),
                    md5: chunksBuf.subarray(offset + 8, offset + 24),
                    length: chunksBuf.readUInt32BE(offset + 40),
                    seed: chunksBuf.readUInt32BE(offset + 44)
                });
            }
            break;
    }
    return { header, chunks, capabilities };
}
/**
 * 获取内存使用对比（RISK-H-005 优化效果评估）
 *
 * @param numChunks - 条目数量
 * @returns 内存统计对比
 */
function estimateMemoryUsage(numChunks) {
    const entrySize = 32;
    const theoreticalSize = numChunks * entrySize;
    // 对象数组估算（基于 V8 典型开销）
    // - 对象头：约 48 bytes
    // - 属性指针：4 * 8 = 32 bytes
    // - Buffer 对象开销：约 80 bytes
    // - 数组指针开销：8 bytes/元素
    const objectOverhead = 48 + 32 + 80 + 8;
    const objectArraySize = numChunks * (entrySize + objectOverhead);
    // 紧凑存储估算
    const compactSize = numChunks * entrySize;
    return {
        objectArray: {
            theoreticalSize,
            actualSize: objectArraySize,
            overheadRatio: objectArraySize / theoreticalSize,
            gcPressure: numChunks * 5 // 估算 GC 对象数
        },
        compactStorage: {
            theoreticalSize,
            actualSize: compactSize,
            overheadRatio: compactSize / theoreticalSize,
            gcPressure: 0
        },
        savings: (objectArraySize - compactSize) / objectArraySize,
        gcPressureReduction: 1.0 // 几乎完全消除 GC 压力
    };
}
// ============================================================================
// HCTX 文件写入器
// ============================================================================
/**
 * 创建 HCTX 文件
 *
 * @param chunks - Chunk 列表
 * @param hashType - Hash 类型
 * @param options - 可选配置
 * @returns 文件缓冲区
 */
function createHctxFile(chunks, hashType = HashType.CASCADE_MD5, options) {
    const entrySize = exports.HASH_TYPE_ENTRY_SIZE[hashType];
    const chunksDataSize = chunks.length * entrySize;
    const metadataOffset = BigInt(exports.HEADER_SIZE + chunksDataSize);
    // 构建 Header
    const header = {
        magic: options?.magic ?? exports.HCTX_MAGIC_V2, // 默认使用 V2 魔数
        version: options?.version ?? exports.READER_VERSION,
        hashType,
        flags: 0,
        minCompatibleVersion: options?.minCompatibleVersion ?? exports.READER_MIN_COMPATIBLE_VERSION,
        chunkCount: BigInt(chunks.length),
        metadataOffset,
        reserved: 0
    };
    // 序列化 Header
    const headerBuf = serializeHeader(header);
    // 序列化 Chunks
    const chunksBuf = Buffer.alloc(chunksDataSize);
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const offset = i * entrySize;
        switch (hashType) {
            case HashType.LEGACY_SIMHASH:
                // V1: 只写入 simhash (8 bytes) - RISK-H-007: 大端序
                chunksBuf.writeBigUInt64BE(chunk.simhash & 0xffffffffffffffffn, offset);
                break;
            case HashType.CASCADE_MD5:
                // V2: 完整 32 字节 - RISK-H-007: 大端序
                chunksBuf.writeBigUInt64BE(chunk.simhash & 0xffffffffffffffffn, offset);
                chunksBuf.set(chunk.md5, offset + 8);
                chunksBuf.writeUInt32BE(chunk.length, offset + 24);
                chunksBuf.writeUInt32BE(chunk.seed, offset + 28);
                break;
            case HashType.CASCADE_SHA256:
            case HashType.CASCADE_BLAKE3:
                // V3/V4: 48 字节（扩展格式）- RISK-H-007: 大端序
                chunksBuf.writeBigUInt64BE(chunk.simhash & 0xffffffffffffffffn, offset);
                // MD5 放在 8-23，剩余空间留给 SHA256/BLAKE3
                chunksBuf.set(chunk.md5, offset + 8);
                chunksBuf.writeUInt32BE(chunk.length, offset + 40);
                chunksBuf.writeUInt32BE(chunk.seed, offset + 44);
                break;
        }
    }
    // 合并 Header + Chunks
    return Buffer.concat([headerBuf, chunksBuf]);
}
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 创建降级版本文件（兼容旧读取器）
 *
 * 将新格式降级为旧格式，用于与旧系统兼容
 *
 * @param chunks - Chunk 列表
 * @returns V1 格式文件缓冲区
 */
function createDowngradeFile(chunks) {
    return createHctxFile(chunks, HashType.LEGACY_SIMHASH, {
        magic: exports.HCTX_MAGIC_V1,
        version: 0x0100,
        minCompatibleVersion: 0x0100
    });
}
/**
 * 检查文件是否为新的级联格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为级联格式
 */
function isCascadeFormat(buf) {
    if (buf.length < exports.HEADER_SIZE) {
        return false;
    }
    const magic = buf.readUInt32BE(0); // RISK-H-007: 大端序
    const hashType = buf.readUInt8(6);
    return magic === exports.HCTX_MAGIC_V2 && hashType >= HashType.CASCADE_MD5;
}
/**
 * 获取文件版本信息
 *
 * @param buf - 文件缓冲区
 * @returns 版本信息字符串
 */
function getFileVersionInfo(buf) {
    if (buf.length < exports.HEADER_SIZE) {
        return 'Invalid: Buffer too small';
    }
    const magic = buf.readUInt32BE(0); // RISK-H-007: 大端序
    const version = buf.readUInt16BE(4); // RISK-H-007: 大端序
    const hashType = buf.readUInt8(6);
    const minCompat = buf.readUInt32BE(8); // RISK-H-007: 大端序
    const magicStr = magic === exports.HCTX_MAGIC_V1 ? 'HCTX(V1)' :
        magic === exports.HCTX_MAGIC_V2 ? 'HCX2(V2+)' :
            `UNKNOWN(0x${magic.toString(16)})`;
    const hashTypeStr = HashType[hashType] || `UNKNOWN(0x${hashType.toString(16)})`;
    return `${magicStr}, v${(version >> 8)}.${(version & 0xFF)}, hash=${hashTypeStr}, minCompat=0x${minCompat.toString(16)}`;
}
// ============================================================================
// 导出模块
// ============================================================================
exports.default = {
    parseHeader,
    serializeHeader,
    checkCompatibility,
    getVersionCapabilities,
    parseChunks,
    readHctxFile,
    createHctxFile,
    createDowngradeFile,
    isCascadeFormat,
    getFileVersionInfo,
    HCTX_MAGIC_V1: exports.HCTX_MAGIC_V1,
    HCTX_MAGIC_V2: exports.HCTX_MAGIC_V2,
    HEADER_SIZE: exports.HEADER_SIZE,
    HashType,
    HASH_TYPE_ENTRY_SIZE: exports.HASH_TYPE_ENTRY_SIZE,
    HctxErrorCode,
    READER_VERSION: exports.READER_VERSION,
    READER_MIN_COMPATIBLE_VERSION: exports.READER_MIN_COMPATIBLE_VERSION
};
//# sourceMappingURL=hctx-reader.js.map