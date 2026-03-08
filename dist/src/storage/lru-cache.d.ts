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
export interface LRUCacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    capacity: number;
    evictions: number;
}
export interface LRUCacheEntry<V> {
    key: string | number;
    value: V;
    lastAccessed: number;
}
/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * 使用双向链表 + HashMap实现O(1)的get/set操作
 * 支持并发访问（基本同步）
 */
export declare class LRUCache<K extends string | number, V> {
    private cache;
    private accessOrder;
    private hits;
    private misses;
    private evictions;
    private capacity;
    private lock;
    /**
     * 创建LRU缓存实例
     * @param capacity 最大容量，默认1000
     */
    constructor(capacity?: number);
    /**
     * 获取缓存值
     * @param key 键
     * @returns 值或undefined
     */
    get(key: K): V | undefined;
    /**
     * 设置缓存值
     * @param key 键
     * @param value 值
     */
    set(key: K, value: V): void;
    /**
     * 检查key是否存在（不更新访问顺序）
     * @param key 键
     */
    has(key: K): boolean;
    /**
     * 删除指定key
     * @param key 键
     */
    delete(key: K): boolean;
    /**
     * 清空缓存
     */
    clear(): void;
    /**
     * 获取当前缓存大小
     */
    size(): number;
    /**
     * 获取缓存统计信息
     */
    getStats(): LRUCacheStats;
    /**
     * 重置统计数据
     */
    resetStats(): void;
    /**
     * 获取所有keys（按访问顺序，从旧到新）
     */
    keys(): K[];
    /**
     * 获取所有values
     */
    values(): V[];
    /**
     * 遍历缓存项（从最新到最旧）
     */
    forEach(callback: (value: V, key: K) => void): void;
    /**
     * 调整容量（会触发淘汰如果新容量更小）
     * @param newCapacity 新容量
     */
    resize(newCapacity: number): void;
    /**
     * 更新访问顺序
     */
    private updateAccessOrder;
    /**
     * 淘汰最久未使用的项
     */
    private evictLRU;
    /**
     * 异步获取（支持并发安全）
     * @param key 键
     * @param loader 加载函数
     */
    getOrLoad(key: K, loader: (key: K) => Promise<V>): Promise<V>;
}
/**
 * CompactStorage集成LRU缓存的装饰器
 *
 * 为现有的CompactStorage提供LRU缓存能力
 */
export declare class CompactStorageWithLRU<T> {
    private storage;
    private lruCache;
    constructor(storage: Map<string, T>, capacity?: number);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    delete(key: string): boolean;
    getStats(): LRUCacheStats;
}
export default LRUCache;
//# sourceMappingURL=lru-cache.d.ts.map