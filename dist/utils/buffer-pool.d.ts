/**
 * buffer-pool.ts - B-02: Buffer Pool核心 (≤200行)
 * 预分配缓冲区，减少GC压力，RSS波动<10%
 */
export interface PoolConfig {
    bufferSize: number;
    maxBuffers: number;
    minBuffers: number;
}
export declare const DEFAULT_POOL_CONFIG: PoolConfig;
export interface PoolStats {
    total: number;
    available: number;
    inUse: number;
    peak: number;
    recycled: number;
    created: number;
}
export declare class BufferPool {
    private config;
    private available;
    private inUse;
    private peak;
    private recycled;
    private created;
    private destroyed;
    constructor(config?: Partial<PoolConfig>);
    /** 预分配缓冲区 */
    private preallocate;
    /** 获取缓冲区 */
    acquire(size?: number): Buffer;
    /** 释放缓冲区回池 */
    release(buf: Buffer): void;
    /** 批量释放 */
    releaseAll(buffers: Buffer[]): void;
    /** 清空池 */
    clear(): void;
    /** 获取统计 */
    getStats(): PoolStats;
    /** 调整池大小(动态扩容/缩容) */
    resize(newMax: number): void;
    /** 内存使用估算(bytes) */
    getMemoryUsage(): number;
    /** 池使用报告 */
    report(): string;
}
export declare function getGlobalPool(config?: Partial<PoolConfig>): BufferPool;
export declare function resetGlobalPool(): void;
export default BufferPool;
//# sourceMappingURL=buffer-pool.d.ts.map