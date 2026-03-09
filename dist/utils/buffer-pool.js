"use strict";
/**
 * buffer-pool.ts - B-02: Buffer Pool核心 (≤200行)
 * 预分配缓冲区，减少GC压力，RSS波动<10%
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferPool = exports.DEFAULT_POOL_CONFIG = void 0;
exports.getGlobalPool = getGlobalPool;
exports.resetGlobalPool = resetGlobalPool;
exports.DEFAULT_POOL_CONFIG = {
    bufferSize: 64 * 1024, // 64KB
    maxBuffers: 1024,
    minBuffers: 16,
};
class BufferPool {
    constructor(config = {}) {
        this.available = [];
        this.inUse = new Set();
        this.peak = 0;
        this.recycled = 0;
        this.created = 0;
        this.destroyed = 0;
        this.config = { ...exports.DEFAULT_POOL_CONFIG, ...config };
        this.preallocate(this.config.minBuffers);
    }
    /** 预分配缓冲区 */
    preallocate(count) {
        for (let i = 0; i < count; i++) {
            if (this.available.length + this.inUse.size >= this.config.maxBuffers)
                break;
            this.available.push(Buffer.alloc(this.config.bufferSize));
            this.created++;
        }
    }
    /** 获取缓冲区 */
    acquire(size) {
        // 请求大小超过池配置，直接分配新缓冲区
        if (size && size > this.config.bufferSize) {
            return Buffer.alloc(size);
        }
        // 池耗尽时扩展
        if (this.available.length === 0) {
            if (this.inUse.size < this.config.maxBuffers) {
                this.preallocate(Math.min(8, this.config.maxBuffers - this.inUse.size));
            }
            else {
                // 池满，创建临时缓冲区(不纳入池管理)
                return Buffer.alloc(size || this.config.bufferSize);
            }
        }
        const buf = this.available.pop();
        this.inUse.add(buf);
        if (this.inUse.size > this.peak) {
            this.peak = this.inUse.size;
        }
        return buf;
    }
    /** 释放缓冲区回池 */
    release(buf) {
        if (!this.inUse.has(buf))
            return;
        this.inUse.delete(buf);
        // 超过最大限制时销毁，否则回收
        if (this.available.length >= this.config.maxBuffers - this.config.minBuffers) {
            this.destroyed++;
            return;
        }
        // 清空数据(安全)
        buf.fill(0);
        this.available.push(buf);
        this.recycled++;
    }
    /** 批量释放 */
    releaseAll(buffers) {
        buffers.forEach(buf => this.release(buf));
    }
    /** 清空池 */
    clear() {
        this.inUse.forEach(buf => {
            buf.fill(0);
        });
        this.inUse.clear();
        this.available = this.available.slice(0, this.config.minBuffers);
        this.available.forEach(buf => buf.fill(0));
    }
    /** 获取统计 */
    getStats() {
        return {
            total: this.available.length + this.inUse.size,
            available: this.available.length,
            inUse: this.inUse.size,
            peak: this.peak,
            recycled: this.recycled,
            created: this.created,
        };
    }
    /** 调整池大小(动态扩容/缩容) */
    resize(newMax) {
        this.config.maxBuffers = newMax;
        // 缩容时释放多余缓冲区
        while (this.available.length > newMax - this.inUse.size) {
            this.available.pop();
            this.destroyed++;
        }
    }
    /** 内存使用估算(bytes) */
    getMemoryUsage() {
        return (this.available.length + this.inUse.size) * this.config.bufferSize;
    }
    /** 池使用报告 */
    report() {
        const stats = this.getStats();
        return `Pool: ${stats.inUse}/${stats.total} (peak:${stats.peak}, recycled:${stats.recycled})`;
    }
}
exports.BufferPool = BufferPool;
/** 全局单例池 */
let globalPool = null;
function getGlobalPool(config) {
    if (!globalPool) {
        globalPool = new BufferPool(config);
    }
    return globalPool;
}
function resetGlobalPool() {
    globalPool?.clear();
    globalPool = null;
}
exports.default = BufferPool;
//# sourceMappingURL=buffer-pool.js.map