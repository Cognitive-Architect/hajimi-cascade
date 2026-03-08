/**
 * ZSTD Compression - Single Thread Implementation (Baseline)
 *
 * This module provides single-threaded ZSTD compression as the baseline
 * for parallel compression comparison.
 *
 * @module zstd-compression
 * @author Hajimi Team
 */

import * as zlib from 'zlib';

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
export class ZstdCompression {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      level: options.level ?? 3,
      chunkSize: options.chunkSize ?? 64 * 1024, // 64KB chunks
    };
  }

  /**
   * Synchronous compression (single-thread)
   * Uses gzip with max compression for CPU-intensive task
   * @param data - Data to compress
   * @returns Compressed data
   * @throws Error if compression fails
   */
  compressSync(data: Buffer): Buffer {
    if (data.length === 0) {
      throw new Error('Cannot compress empty data');
    }
    // Use gzip with configurable compression level
    return zlib.gzipSync(data, { level: this.options.level });
  }

  /**
   * Synchronous decompression (single-thread)
   * @param data - Data to decompress
     * @returns Decompressed data
   * @throws Error if decompression fails
   */
  decompressSync(data: Buffer): Buffer {
    if (data.length === 0) {
      throw new Error('Cannot decompress empty data');
    }
    return zlib.gunzipSync(data);
  }

  /**
   * Async compression with result metadata
   * @param data - Data to compress
   * @returns Compression result with metadata
   */
  async compress(data: Buffer): Promise<CompressionResult> {
    const start = Date.now();
    const compressed = this.compressSync(data);
    const duration = Date.now() - start;
    return {
      data: compressed,
      mode: 'single',
      duration,
      originalSize: data.length,
      compressedSize: compressed.length,
      ratio: compressed.length / data.length,
    };
  }

  /**
   * Async decompression with result metadata
   * @param data - Data to decompress
   * @returns Decompression result with metadata
   */
  async decompress(data: Buffer): Promise<CompressionResult> {
    const start = Date.now();
    const decompressed = this.decompressSync(data);
    const duration = Date.now() - start;
    return {
      data: decompressed,
      mode: 'single',
      duration,
      originalSize: data.length,
      compressedSize: decompressed.length,
      ratio: data.length / decompressed.length,
    };
  }

  /**
   * Get current options
   * @returns Current compression options
   */
  getOptions(): CompressionOptions {
    return { ...this.options };
  }

  /**
   * Calculate optimal chunk count based on data size and CPU cores
   * @param dataSize - Size of data to compress
   * @param cpuCores - Number of CPU cores (default: 4)
   * @returns Optimal chunk count
   */
  calculateChunkCount(dataSize: number, cpuCores = 4): number {
    const minChunkSize = this.options.chunkSize;
    const maxChunks = Math.ceil(dataSize / minChunkSize);
    return Math.min(maxChunks, cpuCores * 2); // 2x cores for better utilization
  }

  /**
   * Split data into chunks for parallel processing
   * @param data - Data to split
   * @param chunkCount - Number of chunks
   * @returns Array of data chunks
   */
  splitIntoChunks(data: Buffer, chunkCount: number): Buffer[] {
    if (chunkCount <= 0) {
      throw new Error('chunkCount must be positive');
    }
    if (data.length === 0) {
      return [];
    }
    
    const chunks: Buffer[] = [];
    const chunkSize = Math.ceil(data.length / chunkCount);
    
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      if (start < data.length) {
        chunks.push(data.subarray(start, end));
      }
    }
    return chunks;
  }
}

/** Singleton instance */
export const zstdCompression = new ZstdCompression();

export default ZstdCompression;
