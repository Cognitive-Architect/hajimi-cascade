"use strict";
/**
 * HCTX 兼容层读取器 V2 - DEBT-BYTE-001 实现
 *
 * 功能：支持 LE/BE 字节序自适应读取，解决 v2.5→v2.6 升级数据兼容性问题
 *
 * 核心特性：
 * - 自动检测字节序（通过 ByteOrderDetector）
 * - 支持 parseWithByteOrder 显式指定字节序
 * - 兼容 v2.5 LE 和 v2.6 BE 格式
 * - 零拷贝解析（高性能）
 *
 * 安全红线：
 * - 自适应仅影响读取路径，不破坏 v2.6 BE 写入性能
 * - 无法检测字节序时明确报错（Fail-fast）
 * - 类型安全：无 bigint <-> Number 不安全转换
 *
 * @module hctx-reader-v2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HctxReader = void 0;
exports.parseHeaderWithByteOrder = parseHeaderWithByteOrder;
exports.parseChunksWithByteOrder = parseChunksWithByteOrder;
exports.readHctxFileV2 = readHctxFileV2;
exports.readHctxFileWithByteOrder = readHctxFileWithByteOrder;
exports.createDowngradeFileV2 = createDowngradeFileV2;
exports.isV25LEFormat = isV25LEFormat;
exports.isV26BEFormat = isV26BEFormat;
exports.getFileFormatInfo = getFileFormatInfo;
const byte_order_detector_js_1 = require("./byte-order-detector.js");
const hctx_reader_js_1 = require("./hctx-reader.js");
// ============================================================================
// Header 解析（支持字节序自适应）
// ============================================================================
/**
 * 解析 Header（支持字节序自适应）
 *
 * 根据指定的字节序解析 HCTX Header，支持：
 * - LE (小端序)：v2.5 格式
 * - BE (大端序)：v2.6+ 格式
 *
 * @param buf - Header 缓冲区（至少 32 字节）
 * @param byteOrder - 字节序
 * @returns 解析结果
 */
function parseHeaderWithByteOrder(buf, byteOrder) {
    if (buf.length < hctx_reader_js_1.HEADER_SIZE) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.BUFFER_TOO_SMALL,
                message: `Header buffer too small: ${buf.length} bytes, expected at least ${hctx_reader_js_1.HEADER_SIZE}`,
                expected: `${hctx_reader_js_1.HEADER_SIZE}`,
                actual: `${buf.length}`
            }
        };
    }
    if (byteOrder === 'UNKNOWN') {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.INVALID_MAGIC,
                message: 'Cannot parse header with unknown byte order'
            }
        };
    }
    // 根据字节序选择读取函数
    const isLE = byteOrder === 'LE';
    // 解析魔数
    const magic = isLE ? buf.readUInt32LE(0) : buf.readUInt32BE(0);
    // 魔数校验
    if (!hctx_reader_js_1.SUPPORTED_MAGICS.includes(magic)) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.INVALID_MAGIC,
                message: `Invalid magic number: 0x${magic.toString(16).toUpperCase().padStart(8, '0')}`,
                expected: hctx_reader_js_1.SUPPORTED_MAGICS.map(m => `0x${m.toString(16).toUpperCase()}`).join(' or '),
                actual: `0x${magic.toString(16).toUpperCase().padStart(8, '0')}`
            }
        };
    }
    // 解析版本
    const version = isLE ? buf.readUInt16LE(4) : buf.readUInt16BE(4);
    // 解析 hash type
    const hashType = buf.readUInt8(6);
    // 验证 hash type 有效性
    if (!Object.values(hctx_reader_js_1.HashType).includes(hashType)) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.UNKNOWN_HASH_TYPE,
                message: `Unknown hash type: 0x${hashType.toString(16).padStart(2, '0')}`,
                actual: `0x${hashType.toString(16).padStart(2, '0')}`
            }
        };
    }
    // 解析 flags
    const flags = buf.readUInt8(7);
    // 解析最小兼容版本
    const minCompatibleVersion = isLE ? buf.readUInt32LE(8) : buf.readUInt32BE(8);
    // 解析 chunk count（使用 BigInt 全程化）
    const chunkCount = isLE ? buf.readBigUInt64LE(12) : buf.readBigUInt64BE(12);
    // chunkCount 精度守卫
    if (chunkCount > BigInt(Number.MAX_SAFE_INTEGER)) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.PRECISION_LOSS,
                message: `chunkCount (${chunkCount.toString()}) exceeds Number.MAX_SAFE_INTEGER`,
                expected: `<= ${Number.MAX_SAFE_INTEGER}`,
                actual: chunkCount.toString()
            }
        };
    }
    // 解析 metadata offset
    const metadataOffset = isLE ? buf.readBigUInt64LE(20) : buf.readBigUInt64BE(20);
    // 解析保留字段
    const reserved = isLE ? buf.readUInt32LE(28) : buf.readUInt32BE(28);
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
    const expectedMetadataOffset = BigInt(hctx_reader_js_1.HEADER_SIZE) + chunkCount * BigInt(hctx_reader_js_1.HASH_TYPE_ENTRY_SIZE[hashType]);
    if (metadataOffset < expectedMetadataOffset) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.INVALID_METADATA_OFFSET,
                message: `Metadata offset (${metadataOffset}) is too small, expected at least ${expectedMetadataOffset}`,
                expected: `>= ${expectedMetadataOffset}`,
                actual: `${metadataOffset}`
            }
        };
    }
    return { success: true, data: header };
}
// ============================================================================
// 条目解析（支持字节序自适应）
// ============================================================================
/**
 * 解析 Chunk 条目列表（支持字节序自适应）
 *
 * @param buf - 条目数据缓冲区
 * @param header - 已解析的 Header
 * @param byteOrder - 字节序
 * @returns 解析结果
 */
function parseChunksWithByteOrder(buf, header, byteOrder) {
    const entrySize = hctx_reader_js_1.HASH_TYPE_ENTRY_SIZE[header.hashType];
    const expectedSize = Number(header.chunkCount) * entrySize;
    if (buf.length < expectedSize) {
        return {
            success: false,
            error: {
                code: hctx_reader_js_1.HctxErrorCode.BUFFER_TOO_SMALL,
                message: `Chunk data buffer too small: ${buf.length} bytes, expected ${expectedSize}`,
                expected: `${expectedSize}`,
                actual: `${buf.length}`
            }
        };
    }
    const isLE = byteOrder === 'LE';
    const chunks = [];
    for (let i = 0; i < Number(header.chunkCount); i++) {
        const offset = i * entrySize;
        const entryBuf = buf.subarray(offset, offset + entrySize);
        try {
            let chunk;
            switch (header.hashType) {
                case hctx_reader_js_1.HashType.LEGACY_SIMHASH:
                    // V1 格式：只有 simhash（8 字节）
                    chunk = {
                        simhash: isLE
                            ? entryBuf.readBigUInt64LE(0)
                            : entryBuf.readBigUInt64BE(0),
                        md5: Buffer.alloc(16),
                        length: 0,
                        seed: 0
                    };
                    break;
                case hctx_reader_js_1.HashType.CASCADE_MD5:
                    // V2 格式：完整 32 字节
                    chunk = {
                        simhash: isLE
                            ? entryBuf.readBigUInt64LE(0)
                            : entryBuf.readBigUInt64BE(0),
                        md5: Buffer.from(entryBuf.subarray(8, 24)),
                        length: isLE
                            ? entryBuf.readUInt32LE(24)
                            : entryBuf.readUInt32BE(24),
                        seed: isLE
                            ? entryBuf.readUInt32LE(28)
                            : entryBuf.readUInt32BE(28)
                    };
                    break;
                case hctx_reader_js_1.HashType.CASCADE_SHA256:
                case hctx_reader_js_1.HashType.CASCADE_BLAKE3:
                    // V3/V4 格式：48 字节
                    chunk = {
                        simhash: isLE
                            ? entryBuf.readBigUInt64LE(0)
                            : entryBuf.readBigUInt64BE(0),
                        md5: Buffer.from(entryBuf.subarray(8, 24)),
                        length: isLE
                            ? entryBuf.readUInt32LE(40)
                            : entryBuf.readUInt32BE(40),
                        seed: isLE
                            ? entryBuf.readUInt32LE(44)
                            : entryBuf.readUInt32BE(44)
                    };
                    break;
                default:
                    return {
                        success: false,
                        error: {
                            code: hctx_reader_js_1.HctxErrorCode.UNKNOWN_HASH_TYPE,
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
                    code: hctx_reader_js_1.HctxErrorCode.CORRUPTED_DATA,
                    message: `Failed to parse chunk ${i}: ${err instanceof Error ? err.message : String(err)}`,
                    offset
                }
            };
        }
    }
    return { success: true, data: chunks };
}
// ============================================================================
// HctxReader V2 类
// ============================================================================
/**
 * HCTX 文件读取器 V2
 *
 * 支持字节序自适应的 HCTX 文件读取器
 */
class HctxReader {
    /**
     * 创建 HctxReader 实例
     *
     * @param options - 读取选项
     */
    constructor(options = {}) {
        this.options = options;
        this.byteOrder = 'UNKNOWN';
    }
    /**
     * 获取检测到的字节序
     */
    getByteOrder() {
        return this.byteOrder;
    }
    /**
     * 获取检测结果详情
     */
    getDetectionResult() {
        return this.detectionResult;
    }
    /**
     * 解析文件（自动检测字节序）
     *
     * @param buffer - 文件缓冲区
     * @returns 解析结果（带字节序信息）
     */
    parse(buffer) {
        // 1. 检测或获取字节序
        let byteOrder;
        if (this.options.byteOrder) {
            // 显式指定字节序
            byteOrder = this.options.byteOrder;
            this.byteOrder = byteOrder;
        }
        else {
            // 自动检测
            const detection = byte_order_detector_js_1.ByteOrderDetector.detect(buffer, {
                strict: this.options.strict
            });
            this.detectionResult = detection;
            if (detection.byteOrder === 'UNKNOWN') {
                return {
                    success: false,
                    error: {
                        code: hctx_reader_js_1.HctxErrorCode.INVALID_MAGIC,
                        message: detection.errorMessage || 'Cannot determine byte order'
                    },
                    byteOrder: 'UNKNOWN',
                    confidence: detection.confidence,
                    detectionMethod: detection.method
                };
            }
            byteOrder = detection.byteOrder;
            this.byteOrder = byteOrder;
        }
        // 2. 解析文件
        // 确保 byteOrder 不是 UNKNOWN（前面已检查）
        const result = this.parseWithByteOrder(buffer, byteOrder);
        // 3. 添加字节序信息
        return {
            ...result,
            byteOrder,
            confidence: this.detectionResult?.confidence ?? 1.0,
            detectionMethod: this.detectionResult?.method ?? 'explicit'
        };
    }
    /**
     * 使用指定字节序解析文件
     *
     * @param buffer - 文件缓冲区
     * @param byteOrder - 字节序（'LE' | 'BE'）
     * @returns 解析结果
     *
     * @example
     * ```typescript
     * const reader = new HctxReader();
     * const result = reader.parseWithByteOrder(buffer, 'LE');
     * if (result.success) {
     *   console.log(result.data.header);
     * }
     * ```
     */
    parseWithByteOrder(buffer, byteOrder) {
        this.byteOrder = byteOrder;
        // 1. 解析 Header
        const headerResult = parseHeaderWithByteOrder(buffer, byteOrder);
        if (!headerResult.success) {
            return { success: false, error: headerResult.error };
        }
        const header = headerResult.data;
        // 2. 解析 Chunks
        const chunksOffset = hctx_reader_js_1.HEADER_SIZE;
        const chunksBuf = buffer.subarray(chunksOffset);
        const chunksResult = parseChunksWithByteOrder(chunksBuf, header, byteOrder);
        if (!chunksResult.success) {
            return { success: false, error: chunksResult.error };
        }
        return {
            success: true,
            data: {
                header,
                chunks: chunksResult.data
            }
        };
    }
    /**
     * 快速检测字节序（静态方法）
     *
     * @param buffer - 文件缓冲区
     * @returns 字节序
     */
    static detectByteOrder(buffer) {
        return (0, byte_order_detector_js_1.detectByteOrderFast)(buffer);
    }
}
exports.HctxReader = HctxReader;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 读取 HCTX 文件（自动检测字节序）
 *
 * @param buf - 文件缓冲区
 * @param options - 读取选项
 * @returns 带字节序信息的解析结果
 */
function readHctxFileV2(buf, options) {
    const reader = new HctxReader(options);
    return reader.parse(buf);
}
/**
 * 使用指定字节序读取 HCTX 文件
 *
 * @param buf - 文件缓冲区
 * @param byteOrder - 字节序
 * @returns 解析结果
 */
function readHctxFileWithByteOrder(buf, byteOrder) {
    const reader = new HctxReader({ byteOrder });
    return reader.parseWithByteOrder(buf, byteOrder);
}
/**
 * 创建降级版本文件（兼容旧读取器）
 *
 * 将新格式降级为 v2.5 LE 格式，用于与旧系统兼容
 *
 * @param chunks - Chunk 列表
 * @returns V2.5 LE 格式文件缓冲区
 */
function createDowngradeFileV2(chunks) {
    // 延迟导入避免循环依赖
    const { createHctxFile, HCTX_MAGIC_V1, HashType } = require('./hctx-reader.js');
    return createHctxFile(chunks, HashType.LEGACY_SIMHASH, {
        magic: HCTX_MAGIC_V1,
        version: 0x0200,
        minCompatibleVersion: 0x0100
    });
}
// ============================================================================
// 兼容性检测
// ============================================================================
/**
 * 检查文件是否为 v2.5 LE 格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为 v2.5 LE 格式
 */
function isV25LEFormat(buf) {
    if (buf.length < 8)
        return false;
    const magicLE = buf.readUInt32LE(0);
    const versionLE = buf.readUInt16LE(4);
    // v2.5 LE 格式特征：LE 魔数 + v2.x 版本
    return magicLE === 0x48535458 && (versionLE >= 0x0200 && versionLE < 0x0300);
}
/**
 * 检查文件是否为 v2.6 BE 格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为 v2.6 BE 格式
 */
function isV26BEFormat(buf) {
    if (buf.length < 8)
        return false;
    const magicBE = buf.readUInt32BE(0);
    const versionBE = buf.readUInt16BE(4);
    // v2.6 BE 格式特征：BE 魔数 + v3.x 版本
    return magicBE === 0x48435832 && (versionBE >= 0x0300);
}
/**
 * 获取文件格式信息
 *
 * @param buf - 文件缓冲区
 * @returns 格式信息字符串
 */
function getFileFormatInfo(buf) {
    if (buf.length < 8) {
        return 'Invalid: Buffer too small';
    }
    const isV25 = isV25LEFormat(buf);
    const isV26 = isV26BEFormat(buf);
    const detected = (0, byte_order_detector_js_1.detectByteOrderFast)(buf);
    if (isV25) {
        const version = buf.readUInt16LE(4);
        return `HCTX v2.5 LE format, version ${(version >> 8)}.${(version & 0xFF)}`;
    }
    if (isV26) {
        const version = buf.readUInt16BE(4);
        return `HCX2 v2.6+ BE format, version ${(version >> 8)}.${(version & 0xFF)}`;
    }
    if (detected !== 'UNKNOWN') {
        return `Unknown format, detected byte order: ${detected}`;
    }
    return 'Unknown format, cannot detect byte order';
}
// ============================================================================
// 导出
// ============================================================================
exports.default = {
    HctxReader,
    parseHeaderWithByteOrder,
    parseChunksWithByteOrder,
    readHctxFileV2,
    readHctxFileWithByteOrder,
    createDowngradeFileV2,
    isV25LEFormat,
    isV26BEFormat,
    getFileFormatInfo
};
//# sourceMappingURL=hctx-reader-v2.js.map