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
import { SimHashValue, ChunkHashV2 } from '../cdc/simhash-chunker.js';
import { HctxHeaderV3 } from './hctx-reader.js';
/** 默认对象池容量 */
export declare const DEFAULT_POOL_CAPACITY = 1024;
/** 最大池化 Buffer 大小（64MB） */
export declare const MAX_POOLED_BUFFER_SIZE: number;
/** 条目大小（CASCADE_MD5 = 32 bytes） */
export declare const ENTRY_SIZE = 32;
/**
 * 紧凑存储的 Chunk 条目（视图模式）
 *
 * 不拥有数据，只是指向 compactBuffer 的视图
 * 访问时动态解析，避免创建大量对象
 */
export interface CompactChunkView {
    /** 条目索引 */
    readonly index: number;
    /** SimHash 64 位指纹 */
    readonly simhash: SimHashValue;
    /** MD5 128 位哈希（指向 compactBuffer 的子视图，只读） */
    readonly md5: Buffer;
    /** 块长度 */
    readonly length: number;
    /** SimHash 种子 */
    readonly seed: number;
}
/**
 * 紧凑存储配置
 */
export interface CompactStorageOptions {
    /** 初始容量（条目数） */
    initialCapacity?: number;
    /** 是否使用对象池 */
    usePool?: boolean;
    /** 池的最大容量 */
    poolMaxCapacity?: number;
}
/**
 * 内存统计信息
 */
export interface MemoryStats {
    /** 理论数据大小（字节） */
    theoreticalSize: number;
    /** 实际使用大小（字节） */
    actualSize: number;
    /** 开销比例 */
    overheadRatio: number;
    /** GC 压力指标（对象分配次数） */
    gcPressure: number;
}
/**
 * Buffer 对象池 - 减少 GC 压力
 *
 * 策略：
 * 1. 预分配常用大小的 Buffer
 * 2. 复用释放的 Buffer（大小匹配时）
 * 3. 过大 Buffer 直接丢弃（避免池膨胀）
 */
export declare class BufferPool {
    private pools;
    private maxCapacity;
    private hitCount;
    private missCount;
    constructor(maxCapacity?: number);
    /**
     * 获取统计信息
     */
    getStats(): {
        hit: number;
        miss: number;
        hitRate: number;
        pools: number;
    };
    /**
     * 重置统计
     */
    resetStats(): void;
    /**
     * 获取合适大小的 Bucket key
     */
    private getBucketKey;
    /**
     * 从池中获取 Buffer
     */
    acquire(size: number): Buffer;
    /**
     * 释放 Buffer 到池中
     */
    release(buf: Buffer): void;
    /**
     * 清空池
     */
    clear(): void;
}
/**
 * 获取全局 Buffer 池
 */
export declare function getGlobalBufferPool(): BufferPool;
/**
 * 重置全局 Buffer 池
 */
export declare function resetGlobalBufferPool(): void;
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
export declare class CompactChunkStorage {
    private buffer;
    private count;
    private capacity;
    private pool;
    private entrySize;
    constructor(options?: CompactStorageOptions);
    /**
     * 获取条目数量
     */
    get length(): number;
    /**
     * 获取原始 Buffer（只读）
     */
    get rawBuffer(): Buffer;
    /**
     * 确保容量足够
     */
    private ensureCapacity;
    /**
     * 添加条目
     */
    push(chunk: ChunkHashV2): void;
    /**
     * 批量添加条目（更高效）
     */
    pushBatch(chunks: ChunkHashV2[]): void;
    /**
     * 从 Buffer 批量加载（零拷贝模式）
     */
    loadFromBuffer(buf: Buffer, entrySize?: number): void;
    /**
     * 获取指定索引的条目（视图模式，不创建新对象）
     *
     * 使用回调函数模式，避免返回对象
     */
    getView<T>(index: number, callback: (view: CompactChunkView) => T): T;
    /**
     * 获取指定索引的条目（返回完整对象）
     *
     * 注意：这会创建新的 ChunkHashV2 对象，有 GC 开销
     * 仅在需要完整对象时使用
     */
    get(index: number): ChunkHashV2;
    /**
     * 遍历所有条目（视图模式）
     */
    forEach(callback: (view: CompactChunkView) => void): void;
    /**
     * 映射所有条目
     */
    map<T>(callback: (view: CompactChunkView) => T): T[];
    /**
     * 清空存储
     */
    clear(): void;
    /**
     * 释放资源
     */
    dispose(): void;
    /**
     * 转换为普通数组（兼容性接口）
     */
    toArray(): ChunkHashV2[];
    /**
     * 获取内存统计
     */
    getMemoryStats(): MemoryStats;
    /**
     * 序列化为文件格式
     */
    serialize(): Buffer;
}
/**
 * SimHash 紧凑索引
 *
 * 使用开放寻址哈希表，避免 Map 的开销
 * 内存布局：
 * - keys: Uint32Array 存储 simhash 高32位 + 低32位
 * - values: Uint32Array 存储 chunk 索引
 */
export declare class CompactSimHashIndex {
    private keysLo;
    private keysHi;
    private values;
    private size;
    private capacity;
    private loadFactor;
    constructor(initialCapacity?: number);
    private nextPowerOf2;
    private hash;
    private probe;
    private resize;
    /**
     * 设置键值对
     */
    set(simhash: SimHashValue, index: number): void;
    /**
     * 查找键
     */
    get(simhash: SimHashValue): number | undefined;
    /**
     * 检查键是否存在
     */
    has(simhash: SimHashValue): boolean;
    /**
     * 获取大小
     */
    get size_count(): number;
    /**
     * 清空索引
     */
    clear(): void;
    /**
     * 获取内存使用量（字节）
     */
    getMemoryUsage(): number;
}
/**
 * 紧凑 HCTX 文件内容
 */
export interface CompactHctxFile {
    header: HctxHeaderV3;
    chunks: CompactChunkStorage;
    capabilities: {
        hashType: 0x01 | 0x02 | 0x03 | 0x04;
        supportsCascade: boolean;
        supportsSeedConfig: boolean;
        maxHashSize: number;
    };
}
/**
 * 使用紧凑存储读取 HCTX 文件
 *
 * @param buf - 完整文件缓冲区
 * @param options - 紧凑存储选项
 * @returns 紧凑文件内容
 */
export declare function readHctxFileCompact(buf: Buffer, options?: CompactStorageOptions): Promise<CompactHctxFile>;
/**
 * 计算内存使用对比
 *
 * @param numChunks - 条目数量
 * @returns 内存统计对比
 */
export declare function estimateMemoryUsage(numChunks: number): {
    objectArray: MemoryStats;
    compactStorage: MemoryStats;
    savings: number;
};
declare const _default: {
    BufferPool: typeof BufferPool;
    CompactChunkStorage: typeof CompactChunkStorage;
    CompactSimHashIndex: typeof CompactSimHashIndex;
    getGlobalBufferPool: typeof getGlobalBufferPool;
    resetGlobalBufferPool: typeof resetGlobalBufferPool;
    estimateMemoryUsage: typeof estimateMemoryUsage;
};
export default _default;
//# sourceMappingURL=hctx-compact.d.ts.map