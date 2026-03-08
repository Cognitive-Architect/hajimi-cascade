"use strict";
/**
 * DEBT-H-005-004: 压缩存储（可选）
 *
 * 可选zstd压缩存储层（节省50%+磁盘空间）
 * 压缩率目标：50%（文本数据）
 *
 * 债务声明:
 * - DEBT-COMP-001: 压缩存储增加CPU开销（P4）
 *   压缩/解压操作会消耗CPU资源，建议用于I/O密集型场景而非CPU密集型场景
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
exports.CompressedStorage = exports.ZstdCompressor = exports.DEFAULT_COMPRESSION_CONFIG = void 0;
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const gzip = (0, util_1.promisify)(zlib.gzip);
const gunzip = (0, util_1.promisify)(zlib.gunzip);
const deflate = (0, util_1.promisify)(zlib.deflate);
const inflate = (0, util_1.promisify)(zlib.inflate);
const brotliCompress = (0, util_1.promisify)(zlib.brotliCompress);
const brotliDecompress = (0, util_1.promisify)(zlib.brotliDecompress);
exports.DEFAULT_COMPRESSION_CONFIG = {
    algorithm: 'gzip', // 默认使用gzip（zstd需要额外依赖）
    level: 6,
    minSize: 100
};
/**
 * Zstd压缩器（使用zlib作为fallback）
 *
 * 注意：纯JavaScript环境下，zstd需要原生模块
 * 当前实现使用brotli作为最佳替代方案（压缩率接近zstd）
 *
 * 当安装@mongodb-js/zstd后，可自动切换到zstd实现
 */
class ZstdCompressor {
    config;
    stats;
    zstdNative = null;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_COMPRESSION_CONFIG, ...config };
        this.stats = {
            originalSize: 0,
            compressedSize: 0,
            compressCount: 0,
            decompressCount: 0,
            totalCompressTime: 0,
            totalDecompressTime: 0
        };
        // 尝试加载原生zstd模块
        this.tryLoadZstdNative();
    }
    /**
     * 尝试加载原生zstd模块
     */
    tryLoadZstdNative() {
        try {
            // 尝试加载常见的zstd包
            this.zstdNative = require('@mongodb-js/zstd');
            this.config.algorithm = 'zstd';
        }
        catch {
            try {
                this.zstdNative = require('zstd-codec');
                this.config.algorithm = 'zstd';
            }
            catch {
                // 使用fallback算法
                this.zstdNative = null;
                if (this.config.algorithm === 'zstd') {
                    this.config.algorithm = 'brotli'; // brotli压缩率最接近zstd
                }
            }
        }
    }
    /**
     * 异步压缩
     */
    async compress(data) {
        const startTime = Date.now();
        // 小数据不压缩
        if (data.length < this.config.minSize) {
            return {
                data,
                algorithm: 'none',
                originalSize: data.length,
                compressedSize: data.length,
                timestamp: Date.now()
            };
        }
        let compressed;
        if (this.zstdNative && this.config.algorithm === 'zstd') {
            compressed = await this.compressZstd(data);
        }
        else {
            compressed = await this.compressFallback(data);
        }
        const compressTime = Date.now() - startTime;
        this.stats.compressCount++;
        this.stats.originalSize += data.length;
        this.stats.compressedSize += compressed.length;
        this.stats.totalCompressTime += compressTime;
        return {
            data: compressed,
            algorithm: this.config.algorithm,
            originalSize: data.length,
            compressedSize: compressed.length,
            timestamp: Date.now()
        };
    }
    /**
     * 异步解压
     */
    async decompress(compressed) {
        const startTime = Date.now();
        if (compressed.algorithm === 'none') {
            return compressed.data;
        }
        let decompressed;
        if (compressed.algorithm === 'zstd' && this.zstdNative) {
            decompressed = await this.decompressZstd(compressed.data);
        }
        else {
            decompressed = await this.decompressFallback(compressed.data, compressed.algorithm);
        }
        const decompressTime = Date.now() - startTime;
        this.stats.decompressCount++;
        this.stats.totalDecompressTime += decompressTime;
        return decompressed;
    }
    /**
     * 同步压缩
     */
    compressSync(data) {
        const startTime = Date.now();
        if (data.length < this.config.minSize) {
            return {
                data,
                algorithm: 'none',
                originalSize: data.length,
                compressedSize: data.length,
                timestamp: Date.now()
            };
        }
        let compressed;
        if (this.zstdNative && this.config.algorithm === 'zstd') {
            compressed = this.compressZstdSync(data);
        }
        else {
            compressed = this.compressFallbackSync(data);
        }
        const compressTime = Date.now() - startTime;
        this.stats.compressCount++;
        this.stats.originalSize += data.length;
        this.stats.compressedSize += compressed.length;
        this.stats.totalCompressTime += compressTime;
        return {
            data: compressed,
            algorithm: this.config.algorithm,
            originalSize: data.length,
            compressedSize: compressed.length,
            timestamp: Date.now()
        };
    }
    /**
     * 同步解压
     */
    decompressSync(compressed) {
        const startTime = Date.now();
        if (compressed.algorithm === 'none') {
            return compressed.data;
        }
        let decompressed;
        if (compressed.algorithm === 'zstd' && this.zstdNative) {
            decompressed = this.decompressZstdSync(compressed.data);
        }
        else {
            decompressed = this.decompressFallbackSync(compressed.data, compressed.algorithm);
        }
        const decompressTime = Date.now() - startTime;
        this.stats.decompressCount++;
        this.stats.totalDecompressTime += decompressTime;
        return decompressed;
    }
    /**
     * 获取统计
     */
    getStats() {
        return {
            originalSize: this.stats.originalSize,
            compressedSize: this.stats.compressedSize,
            ratio: this.stats.originalSize > 0
                ? 1 - this.stats.compressedSize / this.stats.originalSize
                : 0,
            compressCount: this.stats.compressCount,
            decompressCount: this.stats.decompressCount,
            avgCompressTime: this.stats.compressCount > 0
                ? this.stats.totalCompressTime / this.stats.compressCount
                : 0,
            avgDecompressTime: this.stats.decompressCount > 0
                ? this.stats.totalDecompressTime / this.stats.decompressCount
                : 0
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.stats = {
            originalSize: 0,
            compressedSize: 0,
            compressCount: 0,
            decompressCount: 0,
            totalCompressTime: 0,
            totalDecompressTime: 0
        };
    }
    /**
     * 更新配置
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 检查是否使用原生zstd
     */
    isUsingNativeZstd() {
        return this.zstdNative !== null && this.config.algorithm === 'zstd';
    }
    // ====== Private methods ======
    async compressZstd(data) {
        // 使用原生zstd压缩
        if (this.zstdNative.compress) {
            return this.zstdNative.compress(data, this.config.level);
        }
        throw new Error('Zstd native module not available');
    }
    compressZstdSync(data) {
        if (this.zstdNative.compressSync) {
            return this.zstdNative.compressSync(data, this.config.level);
        }
        throw new Error('Zstd native module sync API not available');
    }
    async decompressZstd(data) {
        if (this.zstdNative.decompress) {
            return this.zstdNative.decompress(data);
        }
        throw new Error('Zstd native module not available');
    }
    decompressZstdSync(data) {
        if (this.zstdNative.decompressSync) {
            return this.zstdNative.decompressSync(data);
        }
        throw new Error('Zstd native module sync API not available');
    }
    async compressFallback(data) {
        switch (this.config.algorithm) {
            case 'gzip':
                return gzip(data, { level: this.config.level });
            case 'deflate':
                return deflate(data, { level: this.config.level });
            case 'brotli':
                return brotliCompress(data, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level
                    }
                });
            default:
                return data;
        }
    }
    compressFallbackSync(data) {
        switch (this.config.algorithm) {
            case 'gzip':
                return zlib.gzipSync(data, { level: this.config.level });
            case 'deflate':
                return zlib.deflateSync(data, { level: this.config.level });
            case 'brotli':
                return zlib.brotliCompressSync(data, {
                    params: {
                        [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level
                    }
                });
            default:
                return data;
        }
    }
    async decompressFallback(data, algorithm) {
        switch (algorithm) {
            case 'gzip':
                return gunzip(data);
            case 'deflate':
                return inflate(data);
            case 'brotli':
                return brotliDecompress(data);
            default:
                return data;
        }
    }
    decompressFallbackSync(data, algorithm) {
        switch (algorithm) {
            case 'gzip':
                return zlib.gunzipSync(data);
            case 'deflate':
                return zlib.inflateSync(data);
            case 'brotli':
                return zlib.brotliDecompressSync(data);
            default:
                return data;
        }
    }
}
exports.ZstdCompressor = ZstdCompressor;
/**
 * 压缩存储层
 *
 * 为存储系统添加透明压缩能力
 */
class CompressedStorage {
    compressor;
    storage;
    constructor(config) {
        this.compressor = new ZstdCompressor(config);
        this.storage = new Map();
    }
    /**
     * 存储数据（自动压缩）
     */
    async set(key, data) {
        const compressed = await this.compressor.compress(data);
        this.storage.set(key, compressed);
    }
    /**
     * 同步存储
     */
    setSync(key, data) {
        const compressed = this.compressor.compressSync(data);
        this.storage.set(key, compressed);
    }
    /**
     * 获取数据（自动解压）
     */
    async get(key) {
        const compressed = this.storage.get(key);
        if (!compressed)
            return undefined;
        return this.compressor.decompress(compressed);
    }
    /**
     * 同步获取
     */
    getSync(key) {
        const compressed = this.storage.get(key);
        if (!compressed)
            return undefined;
        return this.compressor.decompressSync(compressed);
    }
    /**
     * 删除
     */
    delete(key) {
        return this.storage.delete(key);
    }
    /**
     * 获取统计
     */
    getStats() {
        return this.compressor.getStats();
    }
    /**
     * 获取原始压缩数据
     */
    getRaw(key) {
        return this.storage.get(key);
    }
    /**
     * 获取所有keys
     */
    keys() {
        return Array.from(this.storage.keys());
    }
    /**
     * 清空
     */
    clear() {
        this.storage.clear();
        this.compressor.resetStats();
    }
}
exports.CompressedStorage = CompressedStorage;
exports.default = ZstdCompressor;
//# sourceMappingURL=zstd-compression.js.map