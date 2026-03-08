"use strict";
/**
 * DEBT-H-005-002: Pool配置化
 *
 * BufferPool参数从硬编码改为构造函数配置
 * 支持：maxSize, preAlloc, growthFactor
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferPoolManager = exports.ConfigurableBufferPool = exports.DEFAULT_BUFFER_POOL_CONFIG = void 0;
exports.DEFAULT_BUFFER_POOL_CONFIG = {
    maxSize: 10 * 1024 * 1024, // 10MB
    preAlloc: 5,
    bufferSize: 64 * 1024, // 64KB
    growthFactor: 1.5,
    allowGrowth: true,
    idleTimeout: 60000,
    enableStats: true
};
/**
 * 可配置的BufferPool
 *
 * 替代硬编码参数的BufferPool实现
 * 支持动态扩容、空闲回收、统计监控
 */
class ConfigurableBufferPool {
    /**
     * 创建可配置的BufferPool
     * @param config 配置对象，未指定项使用默认值
     */
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_BUFFER_POOL_CONFIG, ...config };
        this.pool = [];
        this.inUse = new Set();
        this.stats = {
            totalAllocations: 0,
            totalReleases: 0,
            cacheHits: 0,
            cacheMisses: 0,
            peakUsage: 0
        };
        this.lastShrinkTime = Date.now();
        this.currentBufferSize = this.config.bufferSize;
        // 预分配缓冲区
        this.preallocate();
    }
    /**
     * 预分配缓冲区
     */
    preallocate() {
        for (let i = 0; i < this.config.preAlloc; i++) {
            const buffer = Buffer.allocUnsafe(this.config.bufferSize);
            this.pool.push(buffer);
        }
    }
    /**
     * 获取缓冲区
     * @param requiredSize 需要的缓冲区大小（可选）
     * @returns PooledBuffer对象
     */
    acquire(requiredSize) {
        const size = requiredSize || this.currentBufferSize;
        // 尝试从池中获取
        let buffer;
        // 查找足够大的缓冲区
        for (let i = 0; i < this.pool.length; i++) {
            if (this.pool[i].length >= size) {
                buffer = this.pool.splice(i, 1)[0];
                this.stats.cacheHits++;
                break;
            }
        }
        // 如果没有合适的，创建新缓冲区
        if (!buffer) {
            this.stats.cacheMisses++;
            const allocSize = Math.max(size, this.currentBufferSize);
            // 检查是否超过最大限制
            const currentTotalSize = this.getCurrentTotalSize();
            if (currentTotalSize + allocSize > this.config.maxSize) {
                // 尝试回收空闲缓冲区
                this.shrink();
                // 再次检查
                if (currentTotalSize + allocSize > this.config.maxSize) {
                    throw new Error(`BufferPool exceeded max size: ${this.config.maxSize}`);
                }
            }
            buffer = Buffer.allocUnsafe(allocSize);
            // 动态扩容
            if (this.config.allowGrowth && this.stats.cacheMisses > this.stats.cacheHits) {
                this.currentBufferSize = Math.min(this.currentBufferSize * this.config.growthFactor, this.config.maxSize / 4 // 单个缓冲区不超过maxSize的1/4
                );
            }
        }
        this.stats.totalAllocations++;
        const pooledBuffer = {
            buffer,
            size: buffer.length,
            acquiredAt: Date.now()
        };
        this.inUse.add(pooledBuffer);
        // 更新峰值
        const currentUsage = this.getCurrentTotalSize();
        if (currentUsage > this.stats.peakUsage) {
            this.stats.peakUsage = currentUsage;
        }
        return pooledBuffer;
    }
    /**
     * 释放缓冲区回池
     * @param pooledBuffer PooledBuffer对象
     */
    release(pooledBuffer) {
        if (!this.inUse.has(pooledBuffer)) {
            throw new Error('Attempting to release buffer not acquired from this pool');
        }
        this.inUse.delete(pooledBuffer);
        this.stats.totalReleases++;
        // 检查是否需要缩容
        const now = Date.now();
        if (now - this.lastShrinkTime > this.config.idleTimeout) {
            this.shrink();
            this.lastShrinkTime = now;
        }
        // 清空缓冲区内容（安全考虑）
        pooledBuffer.buffer.fill(0);
        // 归还到池
        this.pool.push(pooledBuffer.buffer);
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * 更新配置（运行时）
     * @param config 新配置
     */
    updateConfig(config) {
        const oldConfig = this.config;
        this.config = { ...this.config, ...config };
        // 如果preAlloc增加，补充分配
        if (config.preAlloc && config.preAlloc > oldConfig.preAlloc) {
            const diff = config.preAlloc - oldConfig.preAlloc;
            for (let i = 0; i < diff; i++) {
                if (this.pool.length + this.inUse.size < config.preAlloc) {
                    this.pool.push(Buffer.allocUnsafe(this.config.bufferSize));
                }
            }
        }
        // 如果maxSize减小，可能需要缩容
        if (config.maxSize && config.maxSize < oldConfig.maxSize) {
            this.shrink();
        }
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        return {
            totalAllocations: this.stats.totalAllocations,
            totalReleases: this.stats.totalReleases,
            availableCount: this.pool.length,
            inUseCount: this.inUse.size,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            currentSize: this.getCurrentTotalSize(),
            peakUsage: this.stats.peakUsage,
            hitRate: total > 0 ? this.stats.cacheHits / total : 0
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.stats = {
            totalAllocations: 0,
            totalReleases: 0,
            cacheHits: 0,
            cacheMisses: 0,
            peakUsage: this.stats.peakUsage
        };
    }
    /**
     * 清空池
     */
    clear() {
        if (this.inUse.size > 0) {
            throw new Error(`Cannot clear pool with ${this.inUse.size} buffers in use`);
        }
        this.pool = [];
        this.resetStats();
    }
    /**
     * 获取当前总大小
     */
    getCurrentTotalSize() {
        let size = this.pool.reduce((sum, buf) => sum + buf.length, 0);
        this.inUse.forEach(pb => {
            size += pb.buffer.length;
        });
        return size;
    }
    /**
     * 缩容 - 释放多余缓冲区
     */
    shrink() {
        const targetSize = Math.max(this.config.preAlloc, this.inUse.size);
        while (this.pool.length > targetSize) {
            this.pool.pop();
        }
    }
    /**
     * 获取池中所有缓冲区（调试用）
     */
    getPoolBuffers() {
        return [...this.pool];
    }
    /**
     * 获取使用中的缓冲区（调试用）
     */
    getInUseBuffers() {
        return Array.from(this.inUse);
    }
}
exports.ConfigurableBufferPool = ConfigurableBufferPool;
/**
 * 全局BufferPool实例管理
 */
class BufferPoolManager {
    /**
     * 获取或创建命名池
     */
    static getPool(name, config) {
        if (!this.pools.has(name)) {
            this.pools.set(name, new ConfigurableBufferPool(config));
        }
        return this.pools.get(name);
    }
    /**
     * 删除命名池
     */
    static removePool(name) {
        const pool = this.pools.get(name);
        if (pool) {
            pool.clear();
            return this.pools.delete(name);
        }
        return false;
    }
    /**
     * 获取所有池名称
     */
    static getPoolNames() {
        return Array.from(this.pools.keys());
    }
    /**
     * 清空所有池
     */
    static clearAll() {
        this.pools.forEach(pool => pool.clear());
        this.pools.clear();
    }
    /**
     * 获取所有统计
     */
    static getAllStats() {
        const stats = {};
        this.pools.forEach((pool, name) => {
            stats[name] = pool.getStats();
        });
        return stats;
    }
}
exports.BufferPoolManager = BufferPoolManager;
BufferPoolManager.pools = new Map();
exports.default = ConfigurableBufferPool;
//# sourceMappingURL=buffer-pool-config.js.map