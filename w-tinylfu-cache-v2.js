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
/**
 * Count-Min Sketch - 频率估计数据结构
 */
var CountMinSketch = /** @class */ (function () {
    function CountMinSketch(capacity) {
        this.width = Math.max(64, capacity * 4);
        this.table = new Uint8Array(this.width);
    }
    CountMinSketch.prototype.hash = function (key) {
        var h = 0;
        for (var i = 0; i < key.length; i++) {
            h = (h * 31 + key.charCodeAt(i)) >>> 0;
        }
        return h % this.width;
    };
    CountMinSketch.prototype.increment = function (key) {
        var idx = this.hash(key);
        if (this.table[idx] < 255)
            this.table[idx]++;
    };
    CountMinSketch.prototype.estimate = function (key) {
        return this.table[this.hash(key)];
    };
    CountMinSketch.prototype.reset = function () {
        this.table.fill(0);
    };
    return CountMinSketch;
}());
/**
 * 双向链表 - 用于LRU排序
 */
var LRUList = /** @class */ (function () {
    function LRUList() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }
    /** 添加到头部 (MRU位置) */
    LRUList.prototype.unshift = function (entry) {
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
    };
    /** 移除节点 */
    LRUList.prototype.remove = function (entry) {
        if (entry.prev) {
            entry.prev.next = entry.next;
        }
        else {
            this.head = entry.next;
        }
        if (entry.next) {
            entry.next.prev = entry.prev;
        }
        else {
            this.tail = entry.prev;
        }
        entry.prev = null;
        entry.next = null;
        this.size--;
    };
    /** 移动到头部 */
    LRUList.prototype.moveToHead = function (entry) {
        this.remove(entry);
        this.unshift(entry);
    };
    /** 移除尾部 (LRU位置) */
    LRUList.prototype.pop = function () {
        if (!this.tail)
            return null;
        var entry = this.tail;
        this.remove(entry);
        return entry;
    };
    /** 清空 */
    LRUList.prototype.clear = function () {
        this.head = null;
        this.tail = null;
        this.size = 0;
    };
    return LRUList;
}());
/**
 * W-TinyLFU Cache V2 - 完整SLRU双区实现
 */
var WTinyLFUCacheV2 = /** @class */ (function () {
    function WTinyLFUCacheV2(options) {
        var _a, _b;
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.capacity = Math.max(10, options.capacity);
        var windowRatio = (_a = options.windowRatio) !== null && _a !== void 0 ? _a : 0.01;
        var protectedRatio = (_b = options.protectedRatio) !== null && _b !== void 0 ? _b : 0.80;
        // 容量分配: Window 1%, Main = Probation 19% + Protected 80%
        this.windowCap = Math.max(1, Math.floor(this.capacity * windowRatio));
        var mainCap = this.capacity - this.windowCap;
        this.protectedCap = Math.max(1, Math.floor(mainCap * protectedRatio));
        this.probationCap = Math.max(1, mainCap - this.protectedCap);
        // 独立存储区
        this.window = new Map();
        this.probation = new Map();
        this.protected = new Map();
        // 独立LRU链表
        this.windowList = new LRUList();
        this.probationList = new LRUList();
        this.protectedList = new LRUList();
        this.sketch = new CountMinSketch(this.capacity);
    }
    WTinyLFUCacheV2.prototype.get = function (key) {
        var k = String(key);
        // 1. 检查Protected区 (最高优先级)
        var protectedEntry = this.protected.get(k);
        if (protectedEntry) {
            this.hits++;
            protectedEntry.freq++;
            this.sketch.increment(k);
            // LRU: 移动到Protected链表头部
            this.protectedList.moveToHead(protectedEntry);
            return protectedEntry.value;
        }
        // 2. 检查Probation区
        var probationEntry = this.probation.get(k);
        if (probationEntry) {
            this.hits++;
            probationEntry.freq++;
            this.sketch.increment(k);
            // Probation → Protected 晋升逻辑
            if (probationEntry.freq >= 3) {
                this.promoteToProtected(probationEntry);
            }
            else {
                // LRU: 移动到Probation链表头部
                this.probationList.moveToHead(probationEntry);
            }
            return probationEntry.value;
        }
        // 3. 检查Window区
        var winEntry = this.window.get(k);
        if (winEntry) {
            this.hits++;
            winEntry.freq++;
            this.sketch.increment(k);
            // Window → Probation/Protected 晋升逻辑
            if (winEntry.freq >= 2) {
                this.promoteFromWindow(winEntry);
            }
            else {
                // LRU: 移动到Window链表头部
                this.windowList.moveToHead(winEntry);
            }
            return winEntry.value;
        }
        this.misses++;
        return undefined;
    };
    WTinyLFUCacheV2.prototype.put = function (key, value) {
        var k = String(key);
        // 更新现有条目
        var existing = this.window.get(k) || this.probation.get(k) || this.protected.get(k);
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
            }
            else if (existing.zone === 'probation') {
                if (existing.freq >= 3) {
                    this.promoteToProtected(existing);
                }
                else {
                    this.probationList.moveToHead(existing);
                }
            }
            else {
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
        var newEntry = {
            key: k,
            value: value,
            zone: 'window',
            freq: 1,
            prev: null,
            next: null
        };
        this.window.set(k, newEntry);
        this.windowList.unshift(newEntry);
    };
    /**
     * Window → Probation/Protected 晋升
     */
    WTinyLFUCacheV2.prototype.promoteFromWindow = function (entry) {
        // 从Window移除
        this.window.delete(entry.key);
        this.windowList.remove(entry);
        // 根据频率决定去向
        if (entry.freq >= 3 && this.protected.size < this.protectedCap) {
            // 直接晋升到Protected
            entry.zone = 'protected';
            this.protected.set(entry.key, entry);
            this.protectedList.unshift(entry);
        }
        else {
            // 晋升到Probation
            this.insertToProbation(entry);
        }
    };
    /**
     * Probation → Protected 晋升
     */
    WTinyLFUCacheV2.prototype.promoteToProtected = function (entry) {
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
    };
    /**
     * Protected → Probation 降级 (LRU降级)
     */
    WTinyLFUCacheV2.prototype.demoteFromProtected = function () {
        var victim = this.protectedList.pop();
        if (!victim)
            return;
        this.protected.delete(victim.key);
        // 降级到Probation
        victim.zone = 'probation';
        victim.freq = 1; // 重置频率
        this.insertToProbation(victim);
    };
    /**
     * 插入到Probation区
     */
    WTinyLFUCacheV2.prototype.insertToProbation = function (entry) {
        // 如果Probation已满，执行LFU驱逐
        if (this.probation.size >= this.probationCap) {
            this.evictFromProbation();
        }
        entry.zone = 'probation';
        this.probation.set(entry.key, entry);
        this.probationList.unshift(entry);
    };
    /**
     * 从Window驱逐LRU到Probation
     */
    WTinyLFUCacheV2.prototype.evictFromWindow = function () {
        var victim = this.windowList.pop();
        if (!victim)
            return;
        this.window.delete(victim.key);
        // 驱逐到Probation (Window → Probation)
        this.insertToProbation(victim);
    };
    /**
     * 从Probation驱逐LFU
     */
    WTinyLFUCacheV2.prototype.evictFromProbation = function () {
        // 找到频率最低的条目进行驱逐
        var victim = null;
        var minFreq = Infinity;
        // 扫描Probation链表尾部 (LRU端)
        var checked = 0;
        var current = this.probationList.tail;
        while (current && checked < 10) {
            var sketchFreq = this.sketch.estimate(current.key);
            var totalFreq = sketchFreq + current.freq;
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
    };
    WTinyLFUCacheV2.prototype.delete = function (key) {
        var k = String(key);
        var winEntry = this.window.get(k);
        if (winEntry) {
            this.window.delete(k);
            this.windowList.remove(winEntry);
            return true;
        }
        var probEntry = this.probation.get(k);
        if (probEntry) {
            this.probation.delete(k);
            this.probationList.remove(probEntry);
            return true;
        }
        var protEntry = this.protected.get(k);
        if (protEntry) {
            this.protected.delete(k);
            this.protectedList.remove(protEntry);
            return true;
        }
        return false;
    };
    WTinyLFUCacheV2.prototype.clear = function () {
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
    };
    WTinyLFUCacheV2.prototype.getStats = function () {
        var total = this.hits + this.misses;
        return {
            hitRate: total > 0 ? this.hits / total : 0,
            windowSize: this.window.size,
            probationSize: this.probation.size,
            protectedSize: this.protected.size,
            totalHits: this.hits,
            totalMisses: this.misses,
            evictions: this.evictions
        };
    };
    /**
     * 获取各区容量配置
     */
    WTinyLFUCacheV2.prototype.getCapacities = function () {
        return {
            window: this.windowCap,
            probation: this.probationCap,
            protected: this.protectedCap
        };
    };
    WTinyLFUCacheV2.prototype.isScanAttackDetected = function () {
        return false;
    };
    return WTinyLFUCacheV2;
}());
export { WTinyLFUCacheV2 };
export default WTinyLFUCacheV2;
