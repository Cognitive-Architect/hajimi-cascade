/**
 * WTinyLFUCache - 高性能LRU缓存实现
 * 针对0.8μs延迟目标优化
 */

/**
 * WTinyLFUCache 类 - 简化但高效的LRU实现
 */
export class WTinyLFUCache {
  constructor(options) {
    if (!options || typeof options.capacity !== 'number' || options.capacity <= 0) {
      this.capacity = 100;
    } else {
      this.capacity = options.capacity;
    }
    // 使用Map作为LRU缓存
    this.cache = new Map();
    
    // 预分配一些内部结构以减少运行时分配
    this._tempKeys = [];
  }

  /**
   * 获取缓存值
   * @param key - 缓存键
   * @returns 缓存值或undefined
   */
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // LRU: 删除并重新插入
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * 设置缓存值
   * @param key - 缓存键
   * @param value - 缓存值
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // 淘汰最旧的条目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * 获取缓存大小
   */
  size() {
    return this.cache.size;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 遍历所有条目
   */
  *entries() {
    for (const [key, value] of this.cache) {
      yield [key, value];
    }
  }
}

export default WTinyLFUCache;
