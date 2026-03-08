/**
 * ZSTD Compression - Single Thread Implementation (Baseline)
 *
 * This module provides single-threaded ZSTD compression as the baseline
 * for parallel compression comparison.
 *
 * @module zstd-compression
 * @author Hajimi Team
 */
export interface CompressionOptions {
    level?: number;
    chunkSize?: number;
}
export interface CompressionResult {
    data: Buffer;
    mode: 'single' | 'parallel';
    duration: number;
    originalSize: number;
    compressedSize: number;
    ratio: number;
}
/**
 * Single-threaded ZSTD compression using Node.js zlib
 * Uses deflate as fallback (since zstd-napi may not be available)
 */
export declare class ZstdCompression {
    private options;
    constructor(options?: CompressionOptions);
    /**
     * Synchronous compression (single-thread)
     */
    compressSync(data: Buffer): Buffer;
    /**
     * Synchronous decompression (single-thread)
     */
    decompressSync(data: Buffer): Buffer;
    /**
     * Async compression with result metadata
     */
    compress(data: Buffer): Promise<CompressionResult>;
    /**
     * Async decompression with result metadata
     */
    decompress(data: Buffer): Promise<CompressionResult>;
    /**
     * Get current options
     */
    getOptions(): CompressionOptions;
    /**
     * Calculate optimal chunk count based on data size and CPU cores
     */
    calculateChunkCount(dataSize: number, cpuCores?: number): number;
    /**
     * Split data into chunks for parallel processing
     */
    splitIntoChunks(data: Buffer, chunkCount: number): Buffer[];
}
export declare const zstdCompression: ZstdCompression;
export default ZstdCompression;
//# sourceMappingURL=zstd-compression.d.ts.map