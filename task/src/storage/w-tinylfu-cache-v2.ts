/**
 * WTinyLFUCache - TinyLFU缓存算法实现
 * 支持高性能get/set操作，用于内存泄漏、并发压力和性能基准测试
 */

// 计数器布隆过滤器 (Counting Bloom Filter) 用于频率统计
class CountingBloomFilter {
  private counters: Uint32Array;
  private size: number;
  private numHashes: number;

  constructor(size: number = 8192, numHashes: number = 4) {
    this.size = size;
    this.numHashes = numHashes;
    this.counters = new Uint32Array(size);
  }

  private hash(key: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % this.size;
  }

  increment(key: string): void {
    for (let i = 0; i < this.numHashes; i++) {
      const idx = this.hash(key, i);
      if (this.counters[idx] < 0xFFFFFFFF) {
        this.counters[idx]++;
      }
    }
  }

  estimate(key: string): number {
    let min = Infinity;
    for (let i = 0; i < this.numHashes; i++) {
      const idx = this.hash(key, i);
      min = Math.min(min, this.counters[idx]);
    }
    return min === Infinity ? 0 : min;
  }

  reset(): void {
    this.counters.fill(0);
  }
}

// 缓存条目
interface CacheEntry {
  key: string;
  value: string;
  frequency: number;
}

// WTinyLFUCache 配置选项
interface WTinyLFUCacheOptions {
  capacity: number;
}

/**
 * WTinyLFUCache 类 - 主缓存实现
 * 使用TinyLFU算法进行高效的缓存淘汰
 */
export class WTinyLFUCache {
  private capacity: number;
  private cache: Map<string, CacheEntry>;
  private frequencySketch: CountingBloomFilter;
  private accessCount: number;
  private resetThreshold: number;

  constructor(options: WTinyLFUCacheOptions) {
    if (!options || typeof options.capacity !== 'number' || options.capacity <= 0) {
      this.capacity = 100;
    } else {
      this.capacity = options.capacity;
    }
    this.cache = new Map<string, CacheEntry>();
    this.frequencySketch = new CountingBloomFilter();
    this.accessCount = 0;
    this.resetThreshold = this.capacity * 10;
  }

  /**
   * 获取缓存值
   * @param key - 缓存键
   * @returns 缓存值或undefined
   */
  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // 增加访问频率
      this.frequencySketch.increment(key);
      entry.frequency = this.frequencySketch.estimate(key);
      this.accessCount++;
      
      // 定期重置频率统计
      if (this.accessCount >= this.resetThreshold) {
        this.frequencySketch.reset();
        this.accessCount = 0;
        // 重新统计当前缓存的频率
        for (const [k, v] of this.cache) {
          v.frequency = this.frequencySketch.estimate(k);
        }
      }
      
      return entry.value;
    }
    return undefined;
  }

  /**
   * 设置缓存值
   * @param key - 缓存键
   * @param value - 缓存值
   */
  set(key: string, value: string): void {
    // 更新频率统计
    this.frequencySketch.increment(key);
    
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      // 更新现有条目
      existingEntry.value = value;
      existingEntry.frequency = this.frequencySketch.estimate(key);
    } else {
      // 新条目
      if (this.cache.size >= this.capacity) {
        this.evict();
      }
      this.cache.set(key, {
        key,
        value,
        frequency: this.frequencySketch.estimate(key)
      });
    }
    
    this.accessCount++;
    if (this.accessCount >= this.resetThreshold) {
      this.frequencySketch.reset();
      this.accessCount = 0;
    }
  }

  /**
   * 淘汰最低频率的条目
   */
  private evict(): void {
    let minFreq = Infinity;
    let victim: CacheEntry | null = null;
    
    for (const entry of this.cache.values()) {
      if (entry.frequency < minFreq) {
        minFreq = entry.frequency;
        victim = entry;
      }
    }
    
    if (victim) {
      this.cache.delete(victim.key);
    }
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.frequencySketch.reset();
    this.accessCount = 0;
  }

  /**
   * 遍历所有条目 (用于测试验证)
   */
  entries(): IterableIterator<[string, string]> {
    const result: [string, string][] = [];
    for (const [key, entry] of this.cache) {
      result.push([key, entry.value]);
    }
    return result[Symbol.iterator]();
  }
}

export default WTinyLFUCache;
