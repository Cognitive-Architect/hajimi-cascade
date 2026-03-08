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
import { ByteOrder, ByteOrderDetectionResult } from './byte-order-detector.js';
import { ChunkHashV2 } from '../cdc/simhash-chunker.js';
import { HashType, HctxHeaderV3, ParseResult } from './hctx-reader.js';
/**
 * HCTX v2.5 LE Header 结构（小端序）
 * 用于兼容旧格式
 */
export interface HctxHeaderV2LE {
    magic: number;
    version: number;
    hashType: HashType;
    flags: number;
    minCompatibleVersion: number;
    chunkCount: bigint;
    metadataOffset: bigint;
    reserved: number;
}
/**
 * 读取选项 V2
 */
export interface ReadOptionsV2 {
    /**
     * 显式指定字节序（覆盖自动检测）
     * - 'LE': 强制按小端序解析
     * - 'BE': 强制按大端序解析
     * - undefined: 自动检测
     */
    byteOrder?: ByteOrder;
    /** 是否启用紧凑存储模式 */
    useCompact?: boolean;
    /** 是否严格模式（低置信度结果视为错误） */
    strict?: boolean;
}
/**
 * 带字节序信息的解析结果
 */
export interface ParseResultWithByteOrder<T> extends ParseResult<T> {
    /** 检测/使用的字节序 */
    byteOrder?: ByteOrder;
    /** 检测置信度 */
    confidence?: number;
    /** 检测方法 */
    detectionMethod?: string;
}
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
export declare function parseHeaderWithByteOrder(buf: Buffer, byteOrder: ByteOrder): ParseResult<HctxHeaderV3>;
/**
 * 解析 Chunk 条目列表（支持字节序自适应）
 *
 * @param buf - 条目数据缓冲区
 * @param header - 已解析的 Header
 * @param byteOrder - 字节序
 * @returns 解析结果
 */
export declare function parseChunksWithByteOrder(buf: Buffer, header: HctxHeaderV3, byteOrder: ByteOrder): ParseResult<ChunkHashV2[]>;
/**
 * HCTX 文件读取器 V2
 *
 * 支持字节序自适应的 HCTX 文件读取器
 */
export declare class HctxReader {
    private options;
    private byteOrder;
    private detectionResult?;
    /**
     * 创建 HctxReader 实例
     *
     * @param options - 读取选项
     */
    constructor(options?: ReadOptionsV2);
    /**
     * 获取检测到的字节序
     */
    getByteOrder(): ByteOrder;
    /**
     * 获取检测结果详情
     */
    getDetectionResult(): ByteOrderDetectionResult | undefined;
    /**
     * 解析文件（自动检测字节序）
     *
     * @param buffer - 文件缓冲区
     * @returns 解析结果（带字节序信息）
     */
    parse(buffer: Buffer): ParseResultWithByteOrder<{
        header: HctxHeaderV3;
        chunks: ChunkHashV2[];
    }>;
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
    parseWithByteOrder(buffer: Buffer, byteOrder: 'LE' | 'BE'): ParseResult<{
        header: HctxHeaderV3;
        chunks: ChunkHashV2[];
    }>;
    /**
     * 快速检测字节序（静态方法）
     *
     * @param buffer - 文件缓冲区
     * @returns 字节序
     */
    static detectByteOrder(buffer: Buffer): ByteOrder;
}
/**
 * 读取 HCTX 文件（自动检测字节序）
 *
 * @param buf - 文件缓冲区
 * @param options - 读取选项
 * @returns 带字节序信息的解析结果
 */
export declare function readHctxFileV2(buf: Buffer, options?: ReadOptionsV2): ParseResultWithByteOrder<{
    header: HctxHeaderV3;
    chunks: ChunkHashV2[];
}>;
/**
 * 使用指定字节序读取 HCTX 文件
 *
 * @param buf - 文件缓冲区
 * @param byteOrder - 字节序
 * @returns 解析结果
 */
export declare function readHctxFileWithByteOrder(buf: Buffer, byteOrder: 'LE' | 'BE'): ParseResult<{
    header: HctxHeaderV3;
    chunks: ChunkHashV2[];
}>;
/**
 * 创建降级版本文件（兼容旧读取器）
 *
 * 将新格式降级为 v2.5 LE 格式，用于与旧系统兼容
 *
 * @param chunks - Chunk 列表
 * @returns V2.5 LE 格式文件缓冲区
 */
export declare function createDowngradeFileV2(chunks: ChunkHashV2[]): Buffer;
/**
 * 检查文件是否为 v2.5 LE 格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为 v2.5 LE 格式
 */
export declare function isV25LEFormat(buf: Buffer): boolean;
/**
 * 检查文件是否为 v2.6 BE 格式
 *
 * @param buf - 文件缓冲区
 * @returns 是否为 v2.6 BE 格式
 */
export declare function isV26BEFormat(buf: Buffer): boolean;
/**
 * 获取文件格式信息
 *
 * @param buf - 文件缓冲区
 * @returns 格式信息字符串
 */
export declare function getFileFormatInfo(buf: Buffer): string;
declare const _default: {
    HctxReader: typeof HctxReader;
    parseHeaderWithByteOrder: typeof parseHeaderWithByteOrder;
    parseChunksWithByteOrder: typeof parseChunksWithByteOrder;
    readHctxFileV2: typeof readHctxFileV2;
    readHctxFileWithByteOrder: typeof readHctxFileWithByteOrder;
    createDowngradeFileV2: typeof createDowngradeFileV2;
    isV25LEFormat: typeof isV25LEFormat;
    isV26BEFormat: typeof isV26BEFormat;
    getFileFormatInfo: typeof getFileFormatInfo;
};
export default _default;
//# sourceMappingURL=hctx-reader-v2.d.ts.map