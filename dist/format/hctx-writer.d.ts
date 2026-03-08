/**
 * HCTX 格式写入器 - RISK-H-005 内存优化实现
 *
 * 核心优化：
 * 1. Buffer 对象池化复用，减少 GC 压力
 * 2. 流式写入支持，避免一次性加载所有数据到内存
 * 3. 分块写入，控制内存峰值
 *
 * 目标：
 * - 1GB 文件峰值内存 < 800MB
 * - GC 暂停时间 < 100ms
 * - SHA256 校验和一致性保证
 *
 * @module hctx-writer
 */
import { createHash } from 'crypto';
import { ChunkHashV2 } from '../cdc/simhash-chunker.js';
import { HashType, HctxHeaderV3 } from './hctx-reader.js';
import { CompactChunkStorage } from './hctx-compact.js';
/**
 * 写入器配置选项
 */
export interface HctxWriterOptions {
    /** Hash 类型 */
    hashType?: HashType;
    /** 魔数 */
    magic?: number;
    /** 版本 */
    version?: number;
    /** 最小兼容版本 */
    minCompatibleVersion?: number;
    /** 是否使用对象池 */
    usePool?: boolean;
    /** 池的最大容量 */
    poolMaxCapacity?: number;
    /** 写入缓冲区大小（字节） */
    writeBufferSize?: number;
    /** 是否计算校验和 */
    enableChecksum?: boolean;
}
/**
 * 写入结果
 */
export interface WriteResult {
    /** 写入的 Buffer */
    buffer: Buffer;
    /** 校验和（如果启用） */
    checksum?: string;
    /** 写入的条目数 */
    chunkCount: number;
    /** 文件大小 */
    fileSize: number;
    /** 内存统计 */
    memoryStats: {
        peakMemory: number;
        bufferAllocations: number;
    };
}
/**
 * 流式写入器状态
 */
export interface StreamingWriterState {
    hashType: HashType;
    entrySize: number;
    header: HctxHeaderV3;
    chunksWritten: number;
    buffer: Buffer;
    bufferOffset: number;
    checksum?: ReturnType<typeof createHash>;
    memoryPeak: number;
}
/**
 * 内存监控器
 */
declare class MemoryMonitor {
    private baseline;
    private peak;
    private samples;
    start(): void;
    sample(): void;
    getStats(): {
        baseline: number;
        peak: number;
        delta: number;
        samples: number;
    };
    getPeakMB(): number;
}
/**
 * 创建优化的 HCTX 文件
 *
 * 相比原版的改进：
 * 1. 使用 Buffer 池化减少分配
 * 2. 批量序列化减少函数调用开销
 * 3. 内存监控
 *
 * @param chunks - Chunk 列表
 * @param options - 写入选项
 * @returns 写入结果
 */
export declare function createHctxFileOptimized(chunks: ChunkHashV2[] | CompactChunkStorage, options?: HctxWriterOptions): WriteResult;
/**
 * HCTX 流式写入器
 *
 * 用于大文件场景，控制内存峰值：
 * 1. 分块收集数据
 * 2. 达到阈值时刷写到磁盘/输出
 * 3. 复用缓冲区
 */
export declare class HctxStreamingWriter {
    private state;
    private options;
    private pool;
    private monitor;
    private chunks;
    constructor(options?: HctxWriterOptions);
    /**
     * 添加单个 Chunk
     */
    write(chunk: ChunkHashV2): void;
    /**
     * 批量添加 Chunks
     */
    writeBatch(chunks: ChunkHashV2[]): void;
    /**
     * 完成写入，生成最终文件
     */
    finalize(): WriteResult;
    /**
     * 获取当前统计
     */
    getStats(): {
        chunksWritten: number;
        memoryPeakMB: number;
    };
    /**
     * 释放资源
     */
    dispose(): void;
}
/**
 * 内存优化的批量文件生成
 *
 * 适用于需要生成超大文件的场景，通过分批次处理控制内存
 *
 * @param chunkGenerator - 异步 Chunk 生成器
 * @param options - 写入选项
 * @returns 写入结果
 */
export declare function writeHctxFileStreaming(chunkGenerator: AsyncGenerator<ChunkHashV2>, options?: HctxWriterOptions): Promise<WriteResult>;
/**
 * 创建降级版本文件（兼容旧读取器）- 内存优化版
 *
 * @param chunks - Chunk 列表
 * @param options - 写入选项
 * @returns 写入结果
 */
export declare function createDowngradeFileOptimized(chunks: ChunkHashV2[] | CompactChunkStorage, options?: Omit<HctxWriterOptions, 'hashType' | 'magic' | 'version' | 'minCompatibleVersion'>): WriteResult;
/**
 * 运行内存基准测试
 *
 * @param numChunks - 测试条目数
 * @returns 基准测试结果
 */
export declare function runMemoryBenchmark(numChunks: number): {
    optimized: {
        timeMs: number;
        peakMemoryMB: number;
        memoryPerChunk: number;
    };
    standard: {
        timeMs: number;
        peakMemoryMB: number;
        memoryPerChunk: number;
    };
    improvement: {
        memoryReduction: number;
        speedup: number;
    };
};
declare const _default: {
    createHctxFileOptimized: typeof createHctxFileOptimized;
    createDowngradeFileOptimized: typeof createDowngradeFileOptimized;
    HctxStreamingWriter: typeof HctxStreamingWriter;
    writeHctxFileStreaming: typeof writeHctxFileStreaming;
    runMemoryBenchmark: typeof runMemoryBenchmark;
    MemoryMonitor: typeof MemoryMonitor;
};
export default _default;
//# sourceMappingURL=hctx-writer.d.ts.map