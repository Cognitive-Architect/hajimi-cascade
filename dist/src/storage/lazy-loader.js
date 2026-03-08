"use strict";
/**
 * DEBT-H-005-003: 懒加载
 *
 * 大文件支持按需加载chunks（mmap风格）
 * 首次访问延迟：<10ms
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
exports.MemoryMappedFile = exports.LazyLoader = exports.DEFAULT_LAZY_LOADER_CONFIG = void 0;
const fs = __importStar(require("fs"));
const util_1 = require("util");
const open = (0, util_1.promisify)(fs.open);
const read = (0, util_1.promisify)(fs.read);
const fstat = (0, util_1.promisify)(fs.fstat);
const close = (0, util_1.promisify)(fs.close);
exports.DEFAULT_LAZY_LOADER_CONFIG = {
    chunkSize: 64 * 1024, // 64KB
    maxCachedChunks: 100,
    readAhead: 1,
    offset: 0
};
/**
 * 懒加载器
 *
 * 实现类mmap的按需加载机制
 * 支持块缓存、预读、延迟加载
 */
class LazyLoader {
    /**
     * 创建懒加载器
     * @param filePath 文件路径
     * @param config 配置
     */
    constructor(filePath, config = {}) {
        this.fd = null;
        this.fileSize = 0;
        this.filePath = filePath;
        this.config = { ...exports.DEFAULT_LAZY_LOADER_CONFIG, ...config };
        this.chunkCache = new Map();
        this.accessOrder = [];
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalBytesRead: 0,
            totalLoadTime: 0,
            loadCount: 0
        };
    }
    /**
     * 初始化懒加载器（异步）
     */
    async init() {
        if (this.fd !== null)
            return;
        this.fd = await open(this.filePath, 'r');
        const stat = await fstat(this.fd);
        this.fileSize = stat.size;
    }
    /**
     * 同步初始化（如果文件已打开）
     */
    initSync() {
        if (this.fd !== null)
            return;
        this.fd = fs.openSync(this.filePath, 'r');
        const stat = fs.fstatSync(this.fd);
        this.fileSize = stat.size;
    }
    /**
     * 获取总块数
     */
    getTotalChunks() {
        return Math.ceil(this.fileSize / this.config.chunkSize);
    }
    /**
     * 加载指定块
     * @param chunkIndex 块索引
     * @returns Chunk对象
     */
    async loadChunk(chunkIndex) {
        await this.ensureInitialized();
        // 检查缓存
        const cached = this.chunkCache.get(chunkIndex);
        if (cached) {
            this.stats.cacheHits++;
            cached.accessCount++;
            this.updateAccessOrder(chunkIndex);
            return cached;
        }
        this.stats.cacheMisses++;
        const startTime = Date.now();
        // 计算块偏移和大小
        const offset = this.config.offset + chunkIndex * this.config.chunkSize;
        const size = Math.min(this.config.chunkSize, this.fileSize - offset);
        if (offset >= this.fileSize || size <= 0) {
            throw new Error(`Invalid chunk index: ${chunkIndex}, file size: ${this.fileSize}`);
        }
        // 读取块数据
        const buffer = Buffer.alloc(size);
        await read(this.fd, buffer, 0, size, offset);
        const loadTime = Date.now() - startTime;
        this.stats.totalLoadTime += loadTime;
        this.stats.loadCount++;
        this.stats.totalBytesRead += size;
        const chunk = {
            index: chunkIndex,
            data: buffer,
            offset,
            size,
            loadedAt: Date.now(),
            accessCount: 1
        };
        // 添加到缓存
        this.addToCache(chunkIndex, chunk);
        // 预读
        this.prefetch(chunkIndex + 1);
        return chunk;
    }
    /**
     * 同步加载块
     * @param chunkIndex 块索引
     */
    loadChunkSync(chunkIndex) {
        this.ensureInitializedSync();
        // 检查缓存
        const cached = this.chunkCache.get(chunkIndex);
        if (cached) {
            this.stats.cacheHits++;
            cached.accessCount++;
            this.updateAccessOrder(chunkIndex);
            return cached;
        }
        this.stats.cacheMisses++;
        const startTime = Date.now();
        // 计算块偏移和大小
        const offset = this.config.offset + chunkIndex * this.config.chunkSize;
        const size = Math.min(this.config.chunkSize, this.fileSize - offset);
        if (offset >= this.fileSize || size <= 0) {
            throw new Error(`Invalid chunk index: ${chunkIndex}, file size: ${this.fileSize}`);
        }
        // 读取块数据
        const buffer = Buffer.alloc(size);
        fs.readSync(this.fd, buffer, 0, size, offset);
        const loadTime = Date.now() - startTime;
        this.stats.totalLoadTime += loadTime;
        this.stats.loadCount++;
        this.stats.totalBytesRead += size;
        const chunk = {
            index: chunkIndex,
            data: buffer,
            offset,
            size,
            loadedAt: Date.now(),
            accessCount: 1
        };
        // 添加到缓存
        this.addToCache(chunkIndex, chunk);
        return chunk;
    }
    /**
     * 读取指定范围的数据
     * @param offset 起始偏移
     * @param length 长度
     */
    async read(offset, length) {
        await this.ensureInitialized();
        const startChunk = Math.floor(offset / this.config.chunkSize);
        const endChunk = Math.floor((offset + length - 1) / this.config.chunkSize);
        const chunks = [];
        let remaining = length;
        let currentOffset = offset;
        for (let i = startChunk; i <= endChunk && remaining > 0; i++) {
            const chunk = await this.loadChunk(i);
            const chunkOffset = currentOffset - chunk.offset;
            const toRead = Math.min(remaining, chunk.size - chunkOffset);
            chunks.push(chunk.data.subarray(chunkOffset, chunkOffset + toRead));
            remaining -= toRead;
            currentOffset += toRead;
        }
        return Buffer.concat(chunks);
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        return {
            totalChunks: this.getTotalChunks(),
            loadedChunks: this.chunkCache.size,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            totalBytesRead: this.stats.totalBytesRead,
            avgLoadLatency: this.stats.loadCount > 0 ? this.stats.totalLoadTime / this.stats.loadCount : 0,
            fileSize: this.fileSize
        };
    }
    /**
     * 清空缓存
     */
    clearCache() {
        this.chunkCache.clear();
        this.accessOrder = [];
    }
    /**
     * 关闭加载器
     */
    async close() {
        if (this.fd !== null) {
            await close(this.fd);
            this.fd = null;
        }
        this.clearCache();
    }
    /**
     * 同步关闭
     */
    closeSync() {
        if (this.fd !== null) {
            fs.closeSync(this.fd);
            this.fd = null;
        }
        this.clearCache();
    }
    /**
     * 确保已初始化
     */
    async ensureInitialized() {
        if (this.fd === null) {
            await this.init();
        }
    }
    /**
     * 确保已初始化（同步）
     */
    ensureInitializedSync() {
        if (this.fd === null) {
            this.initSync();
        }
    }
    /**
     * 添加到缓存（带LRU淘汰）
     */
    addToCache(chunkIndex, chunk) {
        // 淘汰最久未使用的块
        while (this.chunkCache.size >= this.config.maxCachedChunks && this.accessOrder.length > 0) {
            const lruIndex = this.accessOrder.shift();
            if (lruIndex !== undefined) {
                this.chunkCache.delete(lruIndex);
            }
        }
        this.chunkCache.set(chunkIndex, chunk);
        this.accessOrder.push(chunkIndex);
    }
    /**
     * 更新访问顺序
     */
    updateAccessOrder(chunkIndex) {
        const index = this.accessOrder.indexOf(chunkIndex);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(chunkIndex);
    }
    /**
     * 预读块
     */
    async prefetch(startChunk) {
        for (let i = 0; i < this.config.readAhead; i++) {
            const chunkIndex = startChunk + i;
            if (chunkIndex < this.getTotalChunks() && !this.chunkCache.has(chunkIndex)) {
                // 异步预读，不等待
                this.loadChunk(chunkIndex).catch(() => {
                    // 预读失败忽略
                });
            }
        }
    }
}
exports.LazyLoader = LazyLoader;
/**
 * 内存映射风格的文件访问
 *
 * 提供类似mmap的接口，基于LazyLoader实现
 */
class MemoryMappedFile {
    constructor(filePath, config) {
        this.loader = new LazyLoader(filePath, config);
        this.viewCache = new Map();
    }
    /**
     * 初始化
     */
    async init() {
        await this.loader.init();
    }
    /**
     * 读取Uint8
     */
    async readUInt8(offset) {
        const data = await this.loader.read(offset, 1);
        return data.readUInt8(0);
    }
    /**
     * 读取Uint32（小端序）
     */
    async readUInt32LE(offset) {
        const data = await this.loader.read(offset, 4);
        return data.readUInt32LE(0);
    }
    /**
     * 读取Uint64（大端序，返回bigint）
     */
    async readBigUInt64BE(offset) {
        const data = await this.loader.read(offset, 8);
        return data.readBigUInt64BE(0);
    }
    /**
     * 读取Buffer
     */
    async readBuffer(offset, length) {
        return this.loader.read(offset, length);
    }
    /**
     * 获取统计
     */
    getStats() {
        return this.loader.getStats();
    }
    /**
     * 关闭
     */
    async close() {
        await this.loader.close();
        this.viewCache.clear();
    }
}
exports.MemoryMappedFile = MemoryMappedFile;
exports.default = LazyLoader;
//# sourceMappingURL=lazy-loader.js.map