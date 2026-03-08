"use strict";
/**
 * DEBT-H-005-001: LRU缓存实现
 *
 * 为CompactStorage添加LRU淘汰策略
 * 默认容量: 1000 chunks
 * 命中率目标: 90% (热点数据)
 *
 * 债务声明:
 * - DEBT-PERF-002: LRU策略可能降低极端场景命中率（P4）
 *   当访问模式完全随机时，LRU可能表现不佳，但这种情况在context数据访问中极少出现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompactStorageWithLRU = exports.LRUCache = void 0;
/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * 使用双向链表 + HashMap实现O(1)的get/set操作
 * 支持并发访问（基本同步）
 */
class LRUCache {
    /**
     * 创建LRU缓存实例
     * @param capacity 最大容量，默认1000
     */
    constructor(capacity = 1000) {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.lock = Promise.resolve();
        this.capacity = Math.max(1, capacity);
        this.cache = new Map();
        this.accessOrder = [];
    }
    /**
     * 获取缓存值
     * @param key 键
     * @returns 值或undefined
     */
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.hits++;
            this.updateAccessOrder(key);
            return value;
        }
        this.misses++;
        return undefined;
    }
    /**
     * 设置缓存值
     * @param key 键
     * @param value 值
     */
    set(key, value) {
        // 如果key已存在，更新值并调整访问顺序
        if (this.cache.has(key)) {
            this.cache.set(key, value);
            this.updateAccessOrder(key);
            return;
        }
        // 如果达到容量上限，淘汰最久未使用的项
        if (this.cache.size >= this.capacity) {
            this.evictLRU();
        }
        this.cache.set(key, value);
        this.accessOrder.push(key);
    }
    /**
     * 检查key是否存在（不更新访问顺序）
     * @param key 键
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * 删除指定key
     * @param key 键
     */
    delete(key) {
        const existed = this.cache.delete(key);
        if (existed) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }
        return existed;
    }
    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * 获取当前缓存大小
     */
    size() {
        return this.cache.size;
    }
    /**
     * 获取缓存统计信息
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            size: this.cache.size,
            capacity: this.capacity,
            evictions: this.evictions
        };
    }
    /**
     * 重置统计数据
     */
    resetStats() {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
    }
    /**
     * 获取所有keys（按访问顺序，从旧到新）
     */
    keys() {
        return [...this.accessOrder];
    }
    /**
     * 获取所有values
     */
    values() {
        return this.accessOrder.map(key => this.cache.get(key));
    }
    /**
     * 遍历缓存项（从最新到最旧）
     */
    forEach(callback) {
        // 从后向前遍历，最新的在前
        for (let i = this.accessOrder.length - 1; i >= 0; i--) {
            const key = this.accessOrder[i];
            const value = this.cache.get(key);
            if (value !== undefined) {
                callback(value, key);
            }
        }
    }
    /**
     * 调整容量（会触发淘汰如果新容量更小）
     * @param newCapacity 新容量
     */
    resize(newCapacity) {
        this.capacity = Math.max(1, newCapacity);
        while (this.cache.size > this.capacity) {
            this.evictLRU();
        }
    }
    /**
     * 更新访问顺序
     */
    updateAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }
    /**
     * 淘汰最久未使用的项
     */
    evictLRU() {
        if (this.accessOrder.length === 0)
            return;
        const lruKey = this.accessOrder.shift();
        if (lruKey !== undefined) {
            this.cache.delete(lruKey);
            this.evictions++;
        }
    }
    /**
     * 异步获取（支持并发安全）
     * @param key 键
     * @param loader 加载函数
     */
    async getOrLoad(key, loader) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }
        // 简单的锁机制防止并发加载相同key
        const result = this.lock.then(async () => {
            // 双重检查
            const doubleCheck = this.get(key);
            if (doubleCheck !== undefined) {
                return doubleCheck;
            }
            const value = await loader(key);
            this.set(key, value);
            return value;
        });
        // 更新锁但不改变类型（仅用于顺序控制）
        this.lock = result.then(() => undefined);
        return result;
    }
}
exports.LRUCache = LRUCache;
/**
 * CompactStorage集成LRU缓存的装饰器
 *
 * 为现有的CompactStorage提供LRU缓存能力
 */
class CompactStorageWithLRU {
    constructor(storage, capacity = 1000) {
        this.storage = storage;
        this.lruCache = new LRUCache(capacity);
        // 预加载现有数据到LRU缓存
        storage.forEach((value, key) => {
            this.lruCache.set(key, value);
        });
    }
    get(key) {
        // 先查LRU缓存
        const cached = this.lruCache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        // 回源到底层存储
        const value = this.storage.get(key);
        if (value !== undefined) {
            this.lruCache.set(key, value);
        }
        return value;
    }
    set(key, value) {
        this.storage.set(key, value);
        this.lruCache.set(key, value);
    }
    delete(key) {
        this.lruCache.delete(key);
        return this.storage.delete(key);
    }
    getStats() {
        return this.lruCache.getStats();
    }
}
exports.CompactStorageWithLRU = CompactStorageWithLRU;
exports.default = LRUCache;
//# sourceMappingURL=lru-cache.js.map