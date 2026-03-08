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
import { ChunkHashV2, VersionCapabilities } from '../cdc/simhash-chunker.js';
import { CompactChunkStorage, CompactStorageOptions, MemoryStats } from './hctx-compact.js';
/**
 * HCTX 文件魔数定义
 *
 * RISK-H-002 修复策略：
 * - 旧版本魔数 'HCTX' (0x48535458) - 对应 v1/v2 格式
 * - 新版本魔数 'HCX2' (0x48435832) - 对应 v3+ 格式，带级联哈希
 *
 * 旧读者遇到 'HCX2' 会识别为未知格式，立即报错（Fail-fast）
 */
export declare const HCTX_MAGIC_V1 = 1213420632;
export declare const HCTX_MAGIC_V2 = 1212373042;
/** 支持的魔数列表 */
export declare const SUPPORTED_MAGICS: number[];
/**
 * Hash Type 定义
 *
 * 0x01: Legacy SimHash-only (8B entry)
 * 0x02: SimHash-64 + MD5-128 (32B entry) - Cascade v1
 * 0x03: SimHash-64 + SHA256-256 (48B entry) - Future
 * 0x04: SimHash-64 + BLAKE3-256 (48B entry) - Future
 */
export declare enum HashType {
    LEGACY_SIMHASH = 1,
    CASCADE_MD5 = 2,
    CASCADE_SHA256 = 3,
    CASCADE_BLAKE3 = 4
}
/** Hash Type 对应的 entry 大小 */
export declare const HASH_TYPE_ENTRY_SIZE: Record<HashType, number>;
/**
 * HCTX Header V3 结构
 *
 * 布局 (大端序/网络字节序):
 * - offset 0-3: magic (uint32) - 'HCTX' 或 'HCX2'
 * - offset 4-5: version (uint16) - 主版本.次版本，如 0x0300
 * - offset 6: hash_type (uint8)
 * - offset 7: flags (uint8)
 * - offset 8-11: min_compatible_version (uint32) - 最小兼容版本
 * - offset 12-19: chunk_count (uint64) - 块数量
 * - offset 20-27: metadata_offset (uint64) - 元数据表偏移
 * - offset 28-31: reserved (uint32)
 *
 * 总大小: 32 bytes
 *
 * RISK-H-007 修复: 统一使用大端序 (Big-Endian) 确保跨平台互操作性
 */
export interface HctxHeaderV3 {
    /** 魔数 */
    magic: number;
    /** 版本号 (如 0x0300 = v3.0) */
    version: number;
    /** Hash 类型 */
    hashType: HashType;
    /** 标志位 */
    flags: number;
    /** 最小兼容版本 - 用于 Fail-fast */
    minCompatibleVersion: number;
    /** 块数量 */
    chunkCount: bigint;
    /** 元数据表偏移 */
    metadataOffset: bigint;
    /** 保留字段 */
    reserved: number;
}
/**
 * 解析结果
 */
export interface ParseResult<T> {
    success: boolean;
    data?: T;
    error?: HctxParseError;
}
/**
 * 解析错误类型
 */
export interface HctxParseError {
    code: HctxErrorCode;
    message: string;
    offset?: number;
    expected?: string;
    actual?: string;
}
/**
 * 错误代码枚举
 */
export declare enum HctxErrorCode {
    /** 魔数不匹配 */
    INVALID_MAGIC = "INVALID_MAGIC",
    /** 版本不兼容 */
    INCOMPATIBLE_VERSION = "INCOMPATIBLE_VERSION",
    /** 不支持的最小兼容版本 */
    MIN_VERSION_TOO_HIGH = "MIN_VERSION_TOO_HIGH",
    /** 未知的 hash type */
    UNKNOWN_HASH_TYPE = "UNKNOWN_HASH_TYPE",
    /** 缓冲区大小不足 */
    BUFFER_TOO_SMALL = "BUFFER_TOO_SMALL",
    /** 条目数量不匹配 */
    CHUNK_COUNT_MISMATCH = "CHUNK_COUNT_MISMATCH",
    /** 元数据偏移无效 */
    INVALID_METADATA_OFFSET = "INVALID_METADATA_OFFSET",
    /** 数据损坏 */
    CORRUPTED_DATA = "CORRUPTED_DATA",
    /** chunkCount 精度丢失风险 - bigint → number 转换超限 */
    PRECISION_LOSS = "PRECISION_LOSS",
    /** 功能未实现 */
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
}
/**
 * Header 大小（字节）
 */
export declare const HEADER_SIZE = 32;
/**
 * 解析 HCTX Header
 *
 * @param buf - Header 缓冲区（至少 32 字节）
 * @returns 解析结果
 */
export declare function parseHeader(buf: Buffer): ParseResult<HctxHeaderV3>;
/**
 * 序列化 HCTX Header
 *
 * @param header - Header 对象
 * @returns 32 字节 Buffer
 */
export declare function serializeHeader(header: HctxHeaderV3): Buffer;
/**
 * 当前读取器版本
 *
 * 格式: 主版本 * 256 + 次版本
 * 如 v3.0 = 0x0300 = 768
 */
export declare const READER_VERSION = 768;
/**
 * 当前读取器支持的最小兼容版本
 */
export declare const READER_MIN_COMPATIBLE_VERSION = 512;
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
export declare function checkCompatibility(header: HctxHeaderV3): ParseResult<void>;
/**
 * 获取版本能力
 *
 * @param header - Header 对象
 * @returns 版本能力描述
 */
export declare function getVersionCapabilities(header: HctxHeaderV3): VersionCapabilities;
/**
 * 解析 Chunk 条目列表
 *
 * @param buf - 条目数据缓冲区
 * @param header - 已解析的 Header
 * @returns 解析结果
 */
export declare function parseChunks(buf: Buffer, header: HctxHeaderV3): ParseResult<ChunkHashV2[]>;
/**
 * HCTX 文件内容（标准模式）
 */
export interface HctxFile {
    header: HctxHeaderV3;
    chunks: ChunkHashV2[];
    capabilities: VersionCapabilities;
}
/**
 * HCTX 文件内容（紧凑存储模式 - RISK-H-005）
 */
export interface HctxFileCompact {
    header: HctxHeaderV3;
    chunks: CompactChunkStorage;
    capabilities: VersionCapabilities;
}
/**
 * 读取选项
 */
export interface ReadOptions {
    /** 是否使用紧凑存储模式（RISK-H-005） */
    useCompact?: boolean;
    /** 紧凑存储选项 */
    compactOptions?: CompactStorageOptions;
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
export declare function readHctxFile(buf: Buffer, options?: ReadOptions): ParseResult<HctxFile>;
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
export declare function readHctxFileCompact(buf: Buffer, options?: CompactStorageOptions): HctxFileCompact;
/**
 * 获取内存使用对比（RISK-H-005 优化效果评估）
 *
 * @param numChunks - 条目数量
 * @returns 内存统计对比
 */
export declare function estimateMemoryUsage(numChunks: number): {
    objectArray: MemoryStats;
    compactStorage: MemoryStats;
    savings: number;
    gcPressureReduction: number;
};
/**
 * 创建 HCTX 文件
 *
 * @param chunks - Chunk 列表
 * @param hashType - Hash 类型
 * @param options - 可选配置
 * @returns 文件缓冲区
 */
export declare function createHctxFile(chunks: ChunkHashV2[], hashType?: HashType, options?: {
    magic?: number;
    version?: number;
    minCompatibleVersion?: number;
}): Buffer;
/**
 * 创建降级版本文件（兼容旧读取器）
 *
 * 将新格式降级为旧格式，用于与旧系统兼容
 *
 * @param chunks - Chunk 列表
 * @returns V1 格式文件缓冲区
 */
export declare function createDowngradeFile(chunks: ChunkHashV2[]): Buffer;
/**
 * 检查文件是否为新的级联格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为级联格式
 */
export declare function isCascadeFormat(buf: Buffer): boolean;
/**
 * 获取文件版本信息
 *
 * @param buf - 文件缓冲区
 * @returns 版本信息字符串
 */
export declare function getFileVersionInfo(buf: Buffer): string;
declare const _default: {
    parseHeader: typeof parseHeader;
    serializeHeader: typeof serializeHeader;
    checkCompatibility: typeof checkCompatibility;
    getVersionCapabilities: typeof getVersionCapabilities;
    parseChunks: typeof parseChunks;
    readHctxFile: typeof readHctxFile;
    createHctxFile: typeof createHctxFile;
    createDowngradeFile: typeof createDowngradeFile;
    isCascadeFormat: typeof isCascadeFormat;
    getFileVersionInfo: typeof getFileVersionInfo;
    HCTX_MAGIC_V1: number;
    HCTX_MAGIC_V2: number;
    HEADER_SIZE: number;
    HashType: typeof HashType;
    HASH_TYPE_ENTRY_SIZE: Record<HashType, number>;
    HctxErrorCode: typeof HctxErrorCode;
    READER_VERSION: number;
    READER_MIN_COMPATIBLE_VERSION: number;
};
export default _default;
//# sourceMappingURL=hctx-reader.d.ts.map