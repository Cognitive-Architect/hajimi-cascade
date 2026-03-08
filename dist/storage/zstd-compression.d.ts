/**
 * ZSTD Compression - Single Thread Implementation (Baseline)
 *
 * This module provides single-threaded ZSTD compression as the baseline
 * for parallel compression comparison.
 *
 * @module zstd-compression
 * @author Hajimi Team
 */
/**
 * Compression options
 */
export interface CompressionOptions {
    /** Compression level 1-9 (default: 3) */
    level?: number;
    /** Chunk size for parallel processing (default: 64KB) */
    chunkSize?: number;
}
/**
 * Compression result with metadata
 */
export interface CompressionResult {
    /** Compressed/decompressed data */
    data: Buffer;
    /** Compression mode used */
    mode: 'single' | 'parallel';
    /** Duration in milliseconds */
    duration: number;
    /** Original data size */
    originalSize: number;
    /** Result data size */
    compressedSize: number;
    /** Compression ratio */
    ratio: number;
}
/**
 * Single-threaded ZSTD compression using Node.js zlib
 * Uses deflate/gzip as fallback (since zstd-napi may not be available)
 */
export declare class ZstdCompression {
    private options;
    constructor(options?: CompressionOptions);
    /**
     * Synchronous compression (single-thread)
     * Uses gzip with max compression for CPU-intensive task
     * @param data - Data to compress
     * @returns Compressed data
     * @throws Error if compression fails
     */
    compressSync(data: Buffer): Buffer;
    /**
     * Synchronous decompression (single-thread)
     * @param data - Data to decompress
       * @returns Decompressed data
     * @throws Error if decompression fails
     */
    decompressSync(data: Buffer): Buffer;
    /**
     * Async compression with result metadata
     * @param data - Data to compress
     * @returns Compression result with metadata
     */
    compress(data: Buffer): Promise<CompressionResult>;
    /**
     * Async decompression with result metadata
     * @param data - Data to decompress
     * @returns Decompression result with metadata
     */
    decompress(data: Buffer): Promise<CompressionResult>;
    /**
     * Get current options
     * @returns Current compression options
     */
    getOptions(): CompressionOptions;
    /**
     * Calculate optimal chunk count based on data size and CPU cores
     * @param dataSize - Size of data to compress
     * @param cpuCores - Number of CPU cores (default: 4)
     * @returns Optimal chunk count
     */
    calculateChunkCount(dataSize: number, cpuCores?: number): number;
    /**
     * Split data into chunks for parallel processing
     * @param data - Data to split
     * @param chunkCount - Number of chunks
     * @returns Array of data chunks
     */
    splitIntoChunks(data: Buffer, chunkCount: number): Buffer[];
}
/** Singleton instance */
export declare const zstdCompression: ZstdCompression;
export default ZstdCompression;
//# sourceMappingURL=zstd-compression.d.ts.map