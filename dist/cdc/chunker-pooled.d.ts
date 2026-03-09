/**
 * chunker-pooled.ts - B-02: CDC with Buffer Pool (≤250行)
 * 集成Buffer Pool的CDC分块器，减少内存分配
 */
import { BufferPool } from '../utils/buffer-pool';
export interface PooledChunkerConfig {
    windowSize: number;
    minChunkSize: number;
    maxChunkSize: number;
    avgChunkSize: number;
}
export declare const DEFAULT_CHUNKER_CONFIG: PooledChunkerConfig;
export interface Chunk {
    hash: string;
    offset: number;
    length: number;
    data: Buffer;
}
export declare class PooledChunker {
    private config;
    private pool;
    private mask;
    constructor(config?: Partial<PooledChunkerConfig>, pool?: BufferPool);
    /** CDC分块主函数 */
    chunk(data: Buffer): Chunk[];
    /** 判断是否应该切割 */
    private shouldCut;
    /** 计算块哈希 */
    private computeHash;
    /** 批量处理 */
    chunkBatch(dataList: Buffer[]): Chunk[][];
    /** 释放所有块回Pool */
    releaseChunks(chunks: Chunk[]): void;
    /** 获取统计 */
    getStats(): {
        chunks: number;
        pool: ReturnType<BufferPool['getStats']>;
    };
    /** 内存报告 */
    report(): string;
}
/** 便捷函数 */
export declare function chunkData(data: Buffer, config?: Partial<PooledChunkerConfig>): Chunk[];
export default PooledChunker;
//# sourceMappingURL=chunker-pooled.d.ts.map