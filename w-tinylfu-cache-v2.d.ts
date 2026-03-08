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
/**
 * W-TinyLFU Cache V2 - 完整SLRU双区实现
 */
export declare class WTinyLFUCacheV2<K, V> {
    private capacity;
    private windowCap;
    private probationCap;
    private protectedCap;
    private window;
    private probation;
    private protected;
    private windowList;
    private probationList;
    private protectedList;
    private sketch;
    private hits;
    private misses;
    private evictions;
    constructor(options: WTinyLFUOptions);
    get(key: K): V | undefined;
    put(key: K, value: V): void;
    /**
     * Window → Probation/Protected 晋升
     */
    private promoteFromWindow;
    /**
     * Probation → Protected 晋升
     */
    private promoteToProtected;
    /**
     * Protected → Probation 降级 (LRU降级)
     */
    private demoteFromProtected;
    /**
     * 插入到Probation区
     */
    private insertToProbation;
    /**
     * 从Window驱逐LRU到Probation
     */
    private evictFromWindow;
    /**
     * 从Probation驱逐LFU
     */
    private evictFromProbation;
    delete(key: K): boolean;
    clear(): void;
    getStats(): WTinyLFUStats;
    /**
     * 获取各区容量配置
     */
    getCapacities(): {
        window: number;
        probation: number;
        protected: number;
    };
    isScanAttackDetected(): boolean;
}
export default WTinyLFUCacheV2;
