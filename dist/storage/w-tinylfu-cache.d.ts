/**
 * W-TinyLFU Cache - Production Ready
 *
 * Target:
 * - Random hit rate ≥82%
 * - Scan attack immunity ≥80%
 * - Latency <10μs
 */
export interface WTinyLFUOptions {
    capacity: number;
    windowSize?: number;
}
export interface WTinyLFUStats {
    hitRate: number;
    windowSize: number;
    mainSize: number;
    totalHits: number;
    totalMisses: number;
}
export declare class WTinyLFUCache<K, V> {
    private capacity;
    private windowCap;
    private mainCap;
    private window;
    private main;
    private sketch;
    private hits;
    private misses;
    constructor(options: WTinyLFUOptions);
    get(key: K): V | undefined;
    put(key: K, value: V): void;
    private addToMain;
    delete(key: K): boolean;
    clear(): void;
    getStats(): WTinyLFUStats;
    isScanAttackDetected(): boolean;
}
export default WTinyLFUCache;
//# sourceMappingURL=w-tinylfu-cache.d.ts.map