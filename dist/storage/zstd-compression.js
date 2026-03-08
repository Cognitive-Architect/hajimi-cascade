"use strict";
/**
 * ZSTD Compression - Single Thread Implementation (Baseline)
 *
 * This module provides single-threaded ZSTD compression as the baseline
 * for parallel compression comparison.
 *
 * @module zstd-compression
 * @author Hajimi Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.zstdCompression = exports.ZstdCompression = void 0;
const zlib = __importStar(require("zlib"));
/**
 * Single-threaded ZSTD compression using Node.js zlib
 * Uses deflate/gzip as fallback (since zstd-napi may not be available)
 */
class ZstdCompression {
    constructor(options = {}) {
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
    compressSync(data) {
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
    decompressSync(data) {
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
    async compress(data) {
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
    async decompress(data) {
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
    getOptions() {
        return { ...this.options };
    }
    /**
     * Calculate optimal chunk count based on data size and CPU cores
     * @param dataSize - Size of data to compress
     * @param cpuCores - Number of CPU cores (default: 4)
     * @returns Optimal chunk count
     */
    calculateChunkCount(dataSize, cpuCores = 4) {
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
    splitIntoChunks(data, chunkCount) {
        if (chunkCount <= 0) {
            throw new Error('chunkCount must be positive');
        }
        if (data.length === 0) {
            return [];
        }
        const chunks = [];
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
exports.ZstdCompression = ZstdCompression;
/** Singleton instance */
exports.zstdCompression = new ZstdCompression();
exports.default = ZstdCompression;
//# sourceMappingURL=zstd-compression.js.map