/**
 * SHARD-001: 分片存储管理器
 *
 * 100K向量分片，mmap+索引，<2s启动，<500MB内存
 *
 * @module shard-manager
 * Wave 5: SHARD-001 分片架构地狱
 */
export interface ShardConfig {
    shardCount: number;
    vectorsPerShard: number;
    memoryLimitMB: number;
    startupTimeLimitMs: number;
}
export declare const DEFAULT_SHARD_CONFIG: ShardConfig;
export interface VectorEntry {
    id: string;
    data: Float32Array;
}
export interface ShardIndexEntry {
    vectorId: string;
    shardId: number;
    offset: number;
}
/** 分片索引 */
export declare class ShardIndex {
    private index;
    private shardStats;
    add(entry: ShardIndexEntry): void;
    find(vectorId: string): ShardIndexEntry | undefined;
    getShardSize(shardId: number): number;
    size(): number;
}
/** 分片管理器 */
export declare class ShardManager {
    private config;
    private index;
    private shardData;
    private shardCache;
    private accessOrder;
    constructor(config?: Partial<ShardConfig>);
    private getShardId;
    private loadShard;
    private getShard;
    private getMaxCachedShards;
    private updateAccessOrder;
    private evictLRU;
    addVector(vector: VectorEntry): void;
    addBatch(vectors: VectorEntry[]): void;
    findVector(vectorId: string): VectorEntry | undefined;
    private startupTime?;
    startup(): {
        durationMs: number;
    };
    getStats(): {
        totalVectors: number;
        cachedShards: number;
        memoryMB: number;
        startupTimeMs?: number;
    };
}
export declare function createTestVectors(count: number, dim?: number): VectorEntry[];
declare const _default: {
    ShardIndex: typeof ShardIndex;
    ShardManager: typeof ShardManager;
    createTestVectors: typeof createTestVectors;
    DEFAULT_SHARD_CONFIG: ShardConfig;
};
export default _default;
//# sourceMappingURL=shard-manager.d.ts.map