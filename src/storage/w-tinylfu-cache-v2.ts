/**
 * W-TinyLFU Cache V2 - True SLRU Dual-Zone Architecture
 * 
 * 工单: B-01/04 SLRU双区架构实现（核心硬钢）
 * 目标: 实现真正的Protected/Probation双区SLRU，补足架构缺口
 * 
 * 架构设计:
 * - Window: 1%容量，接收新条目
 * - Probation: 19%容量，候选区
 * - Protected: 80%容量，高频保护区
 * 
 * 晋升链: Window(freq≥2) → Probation → Protected(freq≥3)
 * 降级链: Protected(LRU) → Probation → Evict(LFU)
 * 
 * @author 唐音人格
 * @version 2.0.0
 */

export interface WTinyLFUOptions {
  capacity: number;
  /** Window缓存比例 (默认0.01 = 1%) */
  windowRatio?: number;
  /** Protected缓存比例 (默认0.80 = 80% of main) */
  protectedRatio?: number;
}

export interface WTinyLFUStats {
  hitRate: number;
  windowSize: number;
  probationSize: number;
  protectedSize: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
}

/** 缓存区域类型 */
type Zone = 'window' | 'probation' | 'protected';

interface Entry<V> {
  key: string;
  value: V;
  zone: Zone;
  /** 访问频率 */
  freq: number;
  /** 前驱节点 */
  prev: Entry<V> | null;
  /** 后继节点 */
  next: Entry<V> | null;
}

/**
 * Count-Min Sketch - 频率估计数据结构
 */
class CountMinSketch {
  private width: number;
  private table: Uint8Array;

  constructor(capacity: number) {
    this.width = Math.max(64, capacity * 4);
    this.table = new Uint8Array(this.width);
  }

  private hash(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    return h % this.width;
  }

  increment(key: string): void {
    const idx = this.hash(key);
    if (this.table[idx] < 255) this.table[idx]++;
  }

  estimate(key: string): number {
    return this.table[this.hash(key)];
  }

  reset(): void {
    this.table.fill(0);
  }
}

/**
 * 双向链表 - 用于LRU排序
 */
class LRUList<V> {
  head: Entry<V> | null = null;
  tail: Entry<V> | null = null;
  size: number = 0;

  /** 添加到头部 (MRU位置) */
  unshift(entry: Entry<V>): void {
    entry.next = this.head;
    entry.prev = null;
    if (this.head) {
      this.head.prev = entry;
    }
    this.head = entry;
    if (!this.tail) {
      this.tail = entry;
    }
    this.size++;
  }

  /** 移除节点 */
  remove(entry: Entry<V>): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }
    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }
    entry.prev = null;
    entry.next = null;
    this.size--;
  }

  /** 移动到头部 */
  moveToHead(entry: Entry<V>): void {
    this.remove(entry);
    this.unshift(entry);
  }

  /** 移除尾部 (LRU位置) */
  pop(): Entry<V> | null {
    if (!this.tail) return null;
    const entry = this.tail;
    this.remove(entry);
    return entry;
  }

  /** 清空 */
  clear(): void {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }
}

/**
 * W-TinyLFU Cache V2 - 完整SLRU双区实现
 */
export class WTinyLFUCacheV2<K, V> {
  private capacity: number;
  private windowCap: number;
  private probationCap: number;
  private protectedCap: number;
  
  // 三区独立存储
  private window: Map<string, Entry<V>>;
  private probation: Map<string, Entry<V>>;
  private protected: Map<string, Entry<V>>;
  
  // 三区独立LRU链表 (关键: 无交叉污染)
  private windowList: LRUList<V>;
  private probationList: LRUList<V>;
  private protectedList: LRUList<V>;
  
  private sketch: CountMinSketch;
  
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: WTinyLFUOptions) {
    this.capacity = Math.max(10, options.capacity);
    
    const windowRatio = options.windowRatio ?? 0.01;
    const protectedRatio = options.protectedRatio ?? 0.80;
    
    // 容量分配: Window 1%, Main = Probation 19% + Protected 80%
    this.windowCap = Math.max(1, Math.floor(this.capacity * windowRatio));
    const mainCap = this.capacity - this.windowCap;
    this.protectedCap = Math.max(1, Math.floor(mainCap * protectedRatio));
    this.probationCap = Math.max(1, mainCap - this.protectedCap);
    
    // 独立存储区
    this.window = new Map();
    this.probation = new Map();
    this.protected = new Map();
    
    // 独立LRU链表
    this.windowList = new LRUList<V>();
    this.probationList = new LRUList<V>();
    this.protectedList = new LRUList<V>();
    
    this.sketch = new CountMinSketch(this.capacity);
  }

  get(key: K): V | undefined {
    const k = String(key);
    
    // 1. 检查Protected区 (最高优先级)
    const protectedEntry = this.protected.get(k);
    if (protectedEntry) {
      this.hits++;
      protectedEntry.freq++;
      this.sketch.increment(k);
      // LRU: 移动到Protected链表头部
      this.protectedList.moveToHead(protectedEntry);
      return protectedEntry.value;
    }
    
    // 2. 检查Probation区
    const probationEntry = this.probation.get(k);
    if (probationEntry) {
      this.hits++;
      probationEntry.freq++;
      this.sketch.increment(k);
      
      // Probation → Protected 晋升逻辑
      if (probationEntry.freq >= 3) {
        this.promoteToProtected(probationEntry);
      } else {
        // LRU: 移动到Probation链表头部
        this.probationList.moveToHead(probationEntry);
      }
      return probationEntry.value;
    }
    
    // 3. 检查Window区
    const winEntry = this.window.get(k);
    if (winEntry) {
      this.hits++;
      winEntry.freq++;
      this.sketch.increment(k);
      
      // Window → Probation/Protected 晋升逻辑
      if (winEntry.freq >= 2) {
        this.promoteFromWindow(winEntry);
      } else {
        // LRU: 移动到Window链表头部
        this.windowList.moveToHead(winEntry);
      }
      return winEntry.value;
    }
    
    this.misses++;
    return undefined;
  }

  put(key: K, value: V): void {
    const k = String(key);
    
    // 更新现有条目
    const existing = this.window.get(k) || this.probation.get(k) || this.protected.get(k);
    if (existing) {
      existing.value = value;
      existing.freq++;
      this.sketch.increment(k);
      
      // 根据所在区移动到头部
      if (existing.zone === 'window') {
        this.windowList.moveToHead(existing);
        if (existing.freq >= 2) {
          this.promoteFromWindow(existing);
        }
      } else if (existing.zone === 'probation') {
        if (existing.freq >= 3) {
          this.promoteToProtected(existing);
        } else {
          this.probationList.moveToHead(existing);
        }
      } else {
        this.protectedList.moveToHead(existing);
      }
      return;
    }
    
    // 新条目
    this.sketch.increment(k);
    
    // 如果Window已满，驱逐LRU到Probation
    if (this.window.size >= this.windowCap) {
      this.evictFromWindow();
    }
    
    // 创建新条目放入Window
    const newEntry: Entry<V> = {
      key: k,
      value,
      zone: 'window',
      freq: 1,
      prev: null,
      next: null
    };
    
    this.window.set(k, newEntry);
    this.windowList.unshift(newEntry);
  }

  /**
   * Window → Probation/Protected 晋升
   */
  private promoteFromWindow(entry: Entry<V>): void {
    // 从Window移除
    this.window.delete(entry.key);
    this.windowList.remove(entry);
    
    // 根据频率决定去向
    if (entry.freq >= 3 && this.protected.size < this.protectedCap) {
      // 直接晋升到Protected
      entry.zone = 'protected';
      this.protected.set(entry.key, entry);
      this.protectedList.unshift(entry);
    } else {
      // 晋升到Probation
      this.insertToProbation(entry);
    }
  }

  /**
   * Probation → Protected 晋升
   */
  private promoteToProtected(entry: Entry<V>): void {
    // 从Probation移除
    this.probation.delete(entry.key);
    this.probationList.remove(entry);
    
    // 如果Protected已满，需要降级LRU到Probation
    if (this.protected.size >= this.protectedCap) {
      this.demoteFromProtected();
    }
    
    // 晋升到Protected
    entry.zone = 'protected';
    this.protected.set(entry.key, entry);
    this.protectedList.unshift(entry);
  }

  /**
   * Protected → Probation 降级 (LRU降级)
   */
  private demoteFromProtected(): void {
    const victim = this.protectedList.pop();
    if (!victim) return;
    
    this.protected.delete(victim.key);
    
    // 降级到Probation
    victim.zone = 'probation';
    victim.freq = 1; // 重置频率
    this.insertToProbation(victim);
  }

  /**
   * 插入到Probation区
   */
  private insertToProbation(entry: Entry<V>): void {
    // 如果Probation已满，执行LFU驱逐
    if (this.probation.size >= this.probationCap) {
      this.evictFromProbation();
    }
    
    entry.zone = 'probation';
    this.probation.set(entry.key, entry);
    this.probationList.unshift(entry);
  }

  /**
   * 从Window驱逐LRU到Probation
   */
  private evictFromWindow(): void {
    const victim = this.windowList.pop();
    if (!victim) return;
    
    this.window.delete(victim.key);
    
    // 驱逐到Probation (Window → Probation)
    this.insertToProbation(victim);
  }

  /**
   * 从Probation驱逐LFU
   */
  private evictFromProbation(): void {
    // 找到频率最低的条目进行驱逐
    let victim: Entry<V> | null = null;
    let minFreq = Infinity;
    
    // 扫描Probation链表尾部 (LRU端)
    let checked = 0;
    let current = this.probationList.tail;
    
    while (current && checked < 10) {
      const sketchFreq = this.sketch.estimate(current.key);
      const totalFreq = sketchFreq + current.freq;
      
      if (totalFreq < minFreq) {
        minFreq = totalFreq;
        victim = current;
      }
      
      current = current.prev;
      checked++;
    }
    
    if (victim) {
      this.probation.delete(victim.key);
      this.probationList.remove(victim);
      this.evictions++;
    }
  }

  delete(key: K): boolean {
    const k = String(key);
    
    const winEntry = this.window.get(k);
    if (winEntry) {
      this.window.delete(k);
      this.windowList.remove(winEntry);
      return true;
    }
    
    const probEntry = this.probation.get(k);
    if (probEntry) {
      this.probation.delete(k);
      this.probationList.remove(probEntry);
      return true;
    }
    
    const protEntry = this.protected.get(k);
    if (protEntry) {
      this.protected.delete(k);
      this.protectedList.remove(protEntry);
      return true;
    }
    
    return false;
  }

  clear(): void {
    this.window.clear();
    this.probation.clear();
    this.protected.clear();
    this.windowList.clear();
    this.probationList.clear();
    this.protectedList.clear();
    this.sketch.reset();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats(): WTinyLFUStats {
    const total = this.hits + this.misses;
    return {
      hitRate: total > 0 ? this.hits / total : 0,
      windowSize: this.window.size,
      probationSize: this.probation.size,
      protectedSize: this.protected.size,
      totalHits: this.hits,
      totalMisses: this.misses,
      evictions: this.evictions
    };
  }

  /**
   * 获取各区容量配置
   */
  getCapacities(): { window: number; probation: number; protected: number } {
    return {
      window: this.windowCap,
      probation: this.probationCap,
      protected: this.protectedCap
    };
  }

  isScanAttackDetected(): boolean {
    return false;
  }
}

export default WTinyLFUCacheV2;
