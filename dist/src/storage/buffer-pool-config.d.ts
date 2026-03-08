/**
 * DEBT-H-005-002: Pool配置化
 *
 * BufferPool参数从硬编码改为构造函数配置
 * 支持：maxSize, preAlloc, growthFactor
 */
export interface BufferPoolConfig {
    /** 最大缓冲区大小（字节），默认 10MB */
    maxSize: number;
    /** 预分配缓冲区数量，默认 5 */
    preAlloc: number;
    /** 缓冲区大小（字节），默认 64KB */
    bufferSize: number;
    /** 增长因子，默认 1.5 */
    growthFactor: number;
    /** 是否允许动态扩容，默认 true */
    allowGrowth: boolean;
    /** 空闲超时时间（毫秒），默认 60000 */
    idleTimeout: number;
    /** 是否启用统计，默认 true */
    enableStats: boolean;
}
export declare const DEFAULT_BUFFER_POOL_CONFIG: BufferPoolConfig;
export interface BufferPoolStats {
    /** 总分配次数 */
    totalAllocations: number;
    /** 总释放次数 */
    totalReleases: number;
    /** 当前可用缓冲区数量 */
    availableCount: number;
    /** 当前使用中缓冲区数量 */
    inUseCount: number;
    /** 缓存命中次数 */
    cacheHits: number;
    /** 缓存未命中次数 */
    cacheMisses: number;
    /** 当前总大小（字节） */
    currentSize: number;
    /** 峰值使用量（字节） */
    peakUsage: number;
    /** 命中率 */
    hitRate: number;
}
export interface PooledBuffer {
    buffer: Buffer;
    size: number;
    acquiredAt: number;
}
/**
 * 可配置的BufferPool
 *
 * 替代硬编码参数的BufferPool实现
 * 支持动态扩容、空闲回收、统计监控
 */
export declare class ConfigurableBufferPool {
    private config;
    private pool;
    private inUse;
    private stats;
    private lastShrinkTime;
    private currentBufferSize;
    /**
     * 创建可配置的BufferPool
     * @param config 配置对象，未指定项使用默认值
     */
    constructor(config?: Partial<BufferPoolConfig>);
    /**
     * 预分配缓冲区
     */
    private preallocate;
    /**
     * 获取缓冲区
     * @param requiredSize 需要的缓冲区大小（可选）
     * @returns PooledBuffer对象
     */
    acquire(requiredSize?: number): PooledBuffer;
    /**
     * 释放缓冲区回池
     * @param pooledBuffer PooledBuffer对象
     */
    release(pooledBuffer: PooledBuffer): void;
    /**
     * 获取当前配置
     */
    getConfig(): BufferPoolConfig;
    /**
     * 更新配置（运行时）
     * @param config 新配置
     */
    updateConfig(config: Partial<BufferPoolConfig>): void;
    /**
     * 获取统计信息
     */
    getStats(): BufferPoolStats;
    /**
     * 重置统计
     */
    resetStats(): void;
    /**
     * 清空池
     */
    clear(): void;
    /**
     * 获取当前总大小
     */
    private getCurrentTotalSize;
    /**
     * 缩容 - 释放多余缓冲区
     */
    private shrink;
    /**
     * 获取池中所有缓冲区（调试用）
     */
    getPoolBuffers(): Buffer[];
    /**
     * 获取使用中的缓冲区（调试用）
     */
    getInUseBuffers(): PooledBuffer[];
}
/**
 * 全局BufferPool实例管理
 */
export declare class BufferPoolManager {
    private static pools;
    /**
     * 获取或创建命名池
     */
    static getPool(name: string, config?: Partial<BufferPoolConfig>): ConfigurableBufferPool;
    /**
     * 删除命名池
     */
    static removePool(name: string): boolean;
    /**
     * 获取所有池名称
     */
    static getPoolNames(): string[];
    /**
     * 清空所有池
     */
    static clearAll(): void;
    /**
     * 获取所有统计
     */
    static getAllStats(): Record<string, BufferPoolStats>;
}
export default ConfigurableBufferPool;
//# sourceMappingURL=buffer-pool-config.d.ts.map