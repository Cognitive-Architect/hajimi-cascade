"use strict";
/**
 * HCTX 紧凑存储格式 - RISK-H-005 内存优化实现
 *
 * 优化策略：
 * - 用 Buffer/Uint8Array 连续存储条目，避免对象膨胀
 * - 索引用 Uint32Array + 开放寻址哈希表
 * - 对象池化复用 Buffer，减少 GC 压力
 *
 * 目标：
 * - 1GB 文件峰值内存从 2.1GB 降至 <800MB
 * - GC 暂停时间 < 100ms
 *
 * @module hctx-compact
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
exports.CompactSimHashIndex = exports.CompactChunkStorage = exports.BufferPool = exports.ENTRY_SIZE = exports.MAX_POOLED_BUFFER_SIZE = exports.DEFAULT_POOL_CAPACITY = void 0;
exports.getGlobalBufferPool = getGlobalBufferPool;
exports.resetGlobalBufferPool = resetGlobalBufferPool;
exports.readHctxFileCompact = readHctxFileCompact;
exports.estimateMemoryUsage = estimateMemoryUsage;
const simhash_chunker_js_1 = require("../cdc/simhash-chunker.js");
// ============================================================================
// 常量定义
// ============================================================================
/** 默认对象池容量 */
exports.DEFAULT_POOL_CAPACITY = 1024;
/** 最大池化 Buffer 大小（64MB） */
exports.MAX_POOLED_BUFFER_SIZE = 64 * 1024 * 1024;
/** 条目大小（CASCADE_MD5 = 32 bytes） */
exports.ENTRY_SIZE = 32;
// ============================================================================
// Buffer 对象池
// ============================================================================
/**
 * Buffer 对象池 - 减少 GC 压力
 *
 * 策略：
 * 1. 预分配常用大小的 Buffer
 * 2. 复用释放的 Buffer（大小匹配时）
 * 3. 过大 Buffer 直接丢弃（避免池膨胀）
 */
class BufferPool {
    constructor(maxCapacity = exports.DEFAULT_POOL_CAPACITY) {
        this.pools = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        this.maxCapacity = maxCapacity;
    }
    /**
     * 获取统计信息
     */
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            hit: this.hitCount,
            miss: this.missCount,
            hitRate: total > 0 ? this.hitCount / total : 0,
            pools: this.pools.size
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.hitCount = 0;
        this.missCount = 0;
    }
    /**
     * 获取合适大小的 Bucket key
     */
    getBucketKey(size) {
        // 按 4KB 对齐
        return Math.ceil(size / 4096) * 4096;
    }
    /**
     * 从池中获取 Buffer
     */
    acquire(size) {
        const bucketKey = this.getBucketKey(size);
        const pool = this.pools.get(bucketKey);
        if (pool && pool.length > 0) {
            this.hitCount++;
            const buf = pool.pop();
            // 确保大小足够
            if (buf.length >= size) {
                buf.fill(0); // 清零
                return buf.subarray(0, size);
            }
        }
        this.missCount++;
        return Buffer.alloc(size);
    }
    /**
     * 释放 Buffer 到池中
     */
    release(buf) {
        // 过大的 Buffer 直接丢弃，不放入池中
        if (buf.length > exports.MAX_POOLED_BUFFER_SIZE) {
            return;
        }
        const bucketKey = this.getBucketKey(buf.length);
        let pool = this.pools.get(bucketKey);
        if (!pool) {
            pool = [];
            this.pools.set(bucketKey, pool);
        }
        // 池满时丢弃
        if (pool.length < this.maxCapacity) {
            pool.push(buf);
        }
    }
    /**
     * 清空池
     */
    clear() {
        this.pools.clear();
    }
}
exports.BufferPool = BufferPool;
/** 全局默认池 */
let globalPool = null;
/**
 * 获取全局 Buffer 池
 */
function getGlobalBufferPool() {
    if (!globalPool) {
        globalPool = new BufferPool(exports.DEFAULT_POOL_CAPACITY);
    }
    return globalPool;
}
/**
 * 重置全局 Buffer 池
 */
function resetGlobalBufferPool() {
    if (globalPool) {
        globalPool.clear();
        globalPool = null;
    }
}
// ============================================================================
// 紧凑 Chunk 存储
// ============================================================================
/**
 * 紧凑 Chunk 存储类
 *
 * 内存布局：
 * - compactBuffer: 连续存储所有条目（32字节/条目）
 * - count: 实际条目数
 * - capacity: 容量（可扩容）
 *
 * 相比 ChunkHashV2[] 数组的优势：
 * - 无对象头开销
 * - 无指针开销
 * - 无 GC 元数据开销
 * - CPU 缓存友好（连续内存访问）
 */
class CompactChunkStorage {
    constructor(options = {}) {
        this.count = 0;
        this.capacity = options.initialCapacity ?? exports.DEFAULT_POOL_CAPACITY;
        this.pool = options.usePool !== false ? getGlobalBufferPool() : null;
        this.entrySize = exports.ENTRY_SIZE;
        const bufferSize = this.capacity * this.entrySize;
        if (this.pool) {
            this.buffer = this.pool.acquire(bufferSize);
        }
        else {
            this.buffer = Buffer.alloc(bufferSize);
        }
    }
    /**
     * 获取条目数量
     */
    get length() {
        return this.count;
    }
    /**
     * 获取原始 Buffer（只读）
     */
    get rawBuffer() {
        return this.buffer.subarray(0, this.count * this.entrySize);
    }
    /**
     * 确保容量足够
     */
    ensureCapacity(required) {
        if (required <= this.capacity)
            return;
        // 扩容策略：2倍增长
        const newCapacity = Math.max(required, this.capacity * 2);
        const newSize = newCapacity * this.entrySize;
        let newBuffer;
        if (this.pool) {
            newBuffer = this.pool.acquire(newSize);
        }
        else {
            newBuffer = Buffer.alloc(newSize);
        }
        // 复制旧数据
        this.buffer.copy(newBuffer, 0, 0, this.count * this.entrySize);
        // 释放旧 Buffer
        if (this.pool) {
            this.pool.release(this.buffer);
        }
        this.buffer = newBuffer;
        this.capacity = newCapacity;
    }
    /**
     * 添加条目
     */
    push(chunk) {
        this.ensureCapacity(this.count + 1);
        const offset = this.count * this.entrySize;
        // simhash (8 bytes) - RISK-H-007: 大端序
        this.buffer.writeBigUInt64BE(chunk.simhash & simhash_chunker_js_1.UINT64_MASK, offset);
        // md5 (16 bytes)
        if (chunk.md5.length !== 16) {
            throw new Error(`MD5 must be 16 bytes, got ${chunk.md5.length}`);
        }
        this.buffer.set(chunk.md5, offset + 8);
        // length (4 bytes) - RISK-H-007: 大端序
        this.buffer.writeUInt32BE(chunk.length, offset + 24);
        // seed (4 bytes) - RISK-H-007: 大端序
        this.buffer.writeUInt32BE(chunk.seed, offset + 28);
        this.count++;
    }
    /**
     * 批量添加条目（更高效）
     */
    pushBatch(chunks) {
        this.ensureCapacity(this.count + chunks.length);
        for (const chunk of chunks) {
            const offset = this.count * this.entrySize;
            this.buffer.writeBigUInt64BE(chunk.simhash & simhash_chunker_js_1.UINT64_MASK, offset);
            this.buffer.set(chunk.md5, offset + 8);
            this.buffer.writeUInt32BE(chunk.length, offset + 24);
            this.buffer.writeUInt32BE(chunk.seed, offset + 28);
            this.count++;
        }
    }
    /**
     * 从 Buffer 批量加载（零拷贝模式）
     */
    loadFromBuffer(buf, entrySize = this.entrySize) {
        if (buf.length % entrySize !== 0) {
            throw new Error(`Buffer size ${buf.length} is not aligned to entry size ${entrySize}`);
        }
        const numEntries = buf.length / entrySize;
        this.ensureCapacity(numEntries);
        // 直接复制
        buf.copy(this.buffer, 0);
        this.count = numEntries;
    }
    /**
     * 获取指定索引的条目（视图模式，不创建新对象）
     *
     * 使用回调函数模式，避免返回对象
     */
    getView(index, callback) {
        if (index < 0 || index >= this.count) {
            throw new RangeError(`Index ${index} out of range [0, ${this.count})`);
        }
        const offset = index * this.entrySize;
        // 创建视图对象（单次使用，不缓存）
        const view = {
            index,
            simhash: this.buffer.readBigUInt64BE(offset), // RISK-H-007: 大端序
            md5: this.buffer.subarray(offset + 8, offset + 24),
            length: this.buffer.readUInt32BE(offset + 24), // RISK-H-007: 大端序
            seed: this.buffer.readUInt32BE(offset + 28) // RISK-H-007: 大端序
        };
        return callback(view);
    }
    /**
     * 获取指定索引的条目（返回完整对象）
     *
     * 注意：这会创建新的 ChunkHashV2 对象，有 GC 开销
     * 仅在需要完整对象时使用
     */
    get(index) {
        return this.getView(index, (view) => ({
            simhash: view.simhash,
            md5: Buffer.from(view.md5), // 复制一份
            length: view.length,
            seed: view.seed
        }));
    }
    /**
     * 遍历所有条目（视图模式）
     */
    forEach(callback) {
        for (let i = 0; i < this.count; i++) {
            this.getView(i, (view) => {
                callback(view);
                return undefined;
            });
        }
    }
    /**
     * 映射所有条目
     */
    map(callback) {
        const results = [];
        for (let i = 0; i < this.count; i++) {
            this.getView(i, (view) => {
                results.push(callback(view));
                return undefined;
            });
        }
        return results;
    }
    /**
     * 清空存储
     */
    clear() {
        this.count = 0;
    }
    /**
     * 释放资源
     */
    dispose() {
        if (this.pool) {
            this.pool.release(this.buffer);
        }
        this.count = 0;
        this.capacity = 0;
    }
    /**
     * 转换为普通数组（兼容性接口）
     */
    toArray() {
        return this.map((view) => ({
            simhash: view.simhash,
            md5: Buffer.from(view.md5),
            length: view.length,
            seed: view.seed
        }));
    }
    /**
     * 获取内存统计
     */
    getMemoryStats() {
        const theoreticalSize = this.count * this.entrySize;
        const actualSize = this.buffer.length;
        return {
            theoreticalSize,
            actualSize,
            overheadRatio: actualSize / theoreticalSize,
            gcPressure: 0 // 紧凑存储无额外对象分配
        };
    }
    /**
     * 序列化为文件格式
     */
    serialize() {
        return Buffer.from(this.buffer.subarray(0, this.count * this.entrySize));
    }
}
exports.CompactChunkStorage = CompactChunkStorage;
// ============================================================================
// 紧凑索引（SimHash -> 索引映射）
// ============================================================================
/**
 * SimHash 紧凑索引
 *
 * 使用开放寻址哈希表，避免 Map 的开销
 * 内存布局：
 * - keys: Uint32Array 存储 simhash 高32位 + 低32位
 * - values: Uint32Array 存储 chunk 索引
 */
class CompactSimHashIndex {
    constructor(initialCapacity = 1024) {
        this.size = 0;
        this.loadFactor = 0.75;
        this.capacity = this.nextPowerOf2(initialCapacity);
        this.keysLo = new Uint32Array(this.capacity);
        this.keysHi = new Uint32Array(this.capacity);
        this.values = new Uint32Array(this.capacity);
    }
    nextPowerOf2(n) {
        return Math.pow(2, Math.ceil(Math.log2(n)));
    }
    hash(hi, lo) {
        // SplitMix64 哈希变种 - 更好的分布
        let z = (lo ^ hi) >>> 0;
        z = ((z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9) >>> 0;
        z = ((z ^ (z >>> 27)) * 0x94D049BB133111EB) >>> 0;
        z = z ^ (z >>> 31);
        return z;
    }
    probe(index, i) {
        // 线性探测（更稳定）
        return (index + i) & (this.capacity - 1);
    }
    resize() {
        const oldKeysLo = this.keysLo;
        const oldKeysHi = this.keysHi;
        const oldValues = this.values;
        const oldCapacity = this.capacity;
        this.capacity *= 2;
        this.keysLo = new Uint32Array(this.capacity);
        this.keysHi = new Uint32Array(this.capacity);
        this.values = new Uint32Array(this.capacity);
        this.size = 0;
        // 重新插入
        for (let i = 0; i < oldCapacity; i++) {
            if (oldValues[i] !== 0 || (oldKeysHi[i] === 0 && oldKeysLo[i] === 0)) {
                // 可能是空槽，检查是否真的是空
                if (oldValues[i] === 0 && oldKeysHi[i] === 0 && oldKeysLo[i] === 0) {
                    continue;
                }
            }
            const simhash = (BigInt(oldKeysHi[i]) << 32n) | BigInt(oldKeysLo[i]);
            this.set(simhash, oldValues[i]);
        }
    }
    /**
     * 设置键值对
     */
    set(simhash, index) {
        if (this.size >= this.capacity * this.loadFactor) {
            this.resize();
        }
        const lo = Number(simhash & 0xffffffffn);
        const hi = Number(simhash >> 32n);
        let hashIndex = this.hash(hi, lo) & (this.capacity - 1);
        for (let i = 0; i < this.capacity; i++) {
            const probeIndex = (hashIndex + i) & (this.capacity - 1);
            if (this.values[probeIndex] === 0 &&
                this.keysLo[probeIndex] === 0 &&
                this.keysHi[probeIndex] === 0) {
                // 空槽
                this.keysLo[probeIndex] = lo;
                this.keysHi[probeIndex] = hi;
                this.values[probeIndex] = index + 1; // +1 避免 0 歧义
                this.size++;
                return;
            }
            if (this.keysLo[probeIndex] === lo && this.keysHi[probeIndex] === hi) {
                // 已存在，更新
                this.values[probeIndex] = index + 1;
                return;
            }
        }
        // 如果探测完所有槽位还没找到，扩容后再试
        this.resize();
        this.set(simhash, index); // 递归调用
    }
    /**
     * 查找键
     */
    get(simhash) {
        const lo = Number(simhash & 0xffffffffn);
        const hi = Number(simhash >> 32n);
        let hashIndex = this.hash(hi, lo) & (this.capacity - 1);
        for (let i = 0; i < this.capacity; i++) {
            const probeIndex = this.probe(hashIndex, i);
            if (this.values[probeIndex] === 0 &&
                this.keysLo[probeIndex] === 0 &&
                this.keysHi[probeIndex] === 0) {
                // 空槽，不存在
                return undefined;
            }
            if (this.keysLo[probeIndex] === lo && this.keysHi[probeIndex] === hi) {
                return this.values[probeIndex] - 1;
            }
        }
        return undefined;
    }
    /**
     * 检查键是否存在
     */
    has(simhash) {
        return this.get(simhash) !== undefined;
    }
    /**
     * 获取大小
     */
    get size_count() {
        return this.size;
    }
    /**
     * 清空索引
     */
    clear() {
        this.keysLo.fill(0);
        this.keysHi.fill(0);
        this.values.fill(0);
        this.size = 0;
    }
    /**
     * 获取内存使用量（字节）
     */
    getMemoryUsage() {
        return this.keysLo.byteLength +
            this.keysHi.byteLength +
            this.values.byteLength;
    }
}
exports.CompactSimHashIndex = CompactSimHashIndex;
/**
 * 使用紧凑存储读取 HCTX 文件
 *
 * @param buf - 完整文件缓冲区
 * @param options - 紧凑存储选项
 * @returns 紧凑文件内容
 */
async function readHctxFileCompact(buf, options = {}) {
    // 延迟导入避免循环依赖
    const { parseHeader, checkCompatibility, getVersionCapabilities, HashType, HASH_TYPE_ENTRY_SIZE, HEADER_SIZE } = await Promise.resolve().then(() => __importStar(require('./hctx-reader.js')));
    // 1. 解析 Header
    const headerResult = parseHeader(buf);
    if (!headerResult.success) {
        throw new Error(`Failed to parse header: ${headerResult.error?.message}`);
    }
    const header = headerResult.data;
    // 2. 检查兼容性
    const compatResult = checkCompatibility(header);
    if (!compatResult.success) {
        throw new Error(`Compatibility check failed: ${compatResult.error?.message}`);
    }
    // 3. 获取版本能力
    const capabilities = getVersionCapabilities(header);
    // 4. 使用紧凑存储解析 Chunks
    const entrySize = HASH_TYPE_ENTRY_SIZE[header.hashType];
    const chunksOffset = HEADER_SIZE;
    const chunksDataSize = Number(header.chunkCount) * entrySize;
    const chunksBuf = buf.subarray(chunksOffset, chunksOffset + chunksDataSize);
    const chunks = new CompactChunkStorage({
        initialCapacity: Number(header.chunkCount),
        usePool: options.usePool,
        poolMaxCapacity: options.poolMaxCapacity
    });
    // 根据 hashType 解析
    switch (header.hashType) {
        case HashType.LEGACY_SIMHASH:
            // V1 格式：只有 simhash (8 bytes)
            for (let i = 0; i < Number(header.chunkCount); i++) {
                const offset = i * 8;
                const simhash = chunksBuf.readBigUInt64BE(offset); // RISK-H-007: 大端序
                chunks.push({
                    simhash,
                    md5: Buffer.alloc(16),
                    length: 0,
                    seed: 0
                });
            }
            break;
        case HashType.CASCADE_MD5:
            // V2 格式：完整 32 字节
            chunks.loadFromBuffer(chunksBuf, 32);
            break;
        case HashType.CASCADE_SHA256:
        case HashType.CASCADE_BLAKE3:
            // V3/V4 格式：48 字节（简化处理，只取前 32 字节）
            for (let i = 0; i < Number(header.chunkCount); i++) {
                const offset = i * 48;
                chunks.push({
                    simhash: chunksBuf.readBigUInt64BE(offset), // RISK-H-007: 大端序
                    md5: chunksBuf.subarray(offset + 8, offset + 24),
                    length: chunksBuf.readUInt32BE(offset + 40), // RISK-H-007: 大端序
                    seed: chunksBuf.readUInt32BE(offset + 44) // RISK-H-007: 大端序
                });
            }
            break;
    }
    return { header, chunks, capabilities };
}
// 延迟导入辅助函数已移除，使用原生 async/await
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 计算内存使用对比
 *
 * @param numChunks - 条目数量
 * @returns 内存统计对比
 */
function estimateMemoryUsage(numChunks) {
    const entrySize = 32;
    const theoreticalSize = numChunks * entrySize;
    // 对象数组估算（基于 V8 典型开销）
    // - 对象头：约 48 bytes
    // - 属性指针：4 * 8 = 32 bytes
    // - Buffer 对象开销：约 80 bytes
    // - 数组指针开销：8 bytes/元素
    const objectOverhead = 48 + 32 + 80 + 8;
    const objectArraySize = numChunks * (entrySize + objectOverhead);
    // 紧凑存储估算
    const compactSize = numChunks * entrySize;
    return {
        objectArray: {
            theoreticalSize,
            actualSize: objectArraySize,
            overheadRatio: objectArraySize / theoreticalSize,
            gcPressure: numChunks * 5 // 估算 GC 对象数
        },
        compactStorage: {
            theoreticalSize,
            actualSize: compactSize,
            overheadRatio: compactSize / theoreticalSize,
            gcPressure: 0
        },
        savings: (objectArraySize - compactSize) / objectArraySize
    };
}
// ============================================================================
// 导出
// ============================================================================
exports.default = {
    BufferPool,
    CompactChunkStorage,
    CompactSimHashIndex,
    getGlobalBufferPool,
    resetGlobalBufferPool,
    estimateMemoryUsage
};
//# sourceMappingURL=hctx-compact.js.map