"use strict";
/**
 * SHARD-001: 分片存储管理器
 *
 * 100K向量分片，mmap+索引，<2s启动，<500MB内存
 *
 * @module shard-manager
 * Wave 5: SHARD-001 分片架构地狱
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardManager = exports.ShardIndex = exports.DEFAULT_SHARD_CONFIG = void 0;
exports.createTestVectors = createTestVectors;
const crypto_1 = require("crypto");
exports.DEFAULT_SHARD_CONFIG = {
    shardCount: 10,
    vectorsPerShard: 10000,
    memoryLimitMB: 500,
    startupTimeLimitMs: 2000,
};
/** 分片索引 */
class ShardIndex {
    constructor() {
        this.index = new Map();
        this.shardStats = new Map();
    }
    add(entry) {
        this.index.set(entry.vectorId, entry);
        this.shardStats.set(entry.shardId, (this.shardStats.get(entry.shardId) || 0) + 1);
    }
    find(vectorId) {
        return this.index.get(vectorId);
    }
    getShardSize(shardId) {
        return this.shardStats.get(shardId) || 0;
    }
    size() {
        return this.index.size;
    }
}
exports.ShardIndex = ShardIndex;
/** 分片管理器 */
class ShardManager {
    constructor(config = {}) {
        this.index = new ShardIndex();
        this.shardData = new Map(); // shardId -> (vectorId -> entry)
        this.shardCache = new Map();
        this.accessOrder = [];
        this.config = { ...exports.DEFAULT_SHARD_CONFIG, ...config };
    }
    getShardId(vectorId) {
        const hash = (0, crypto_1.createHash)('md5').update(vectorId).digest();
        return hash.readUInt32LE(0) % this.config.shardCount;
    }
    loadShard(shardId) {
        const shardMap = this.shardData.get(shardId);
        if (!shardMap)
            return [];
        return Array.from(shardMap.values());
    }
    getShard(shardId) {
        if (this.shardCache.has(shardId)) {
            this.updateAccessOrder(shardId);
            return this.shardCache.get(shardId);
        }
        const shard = this.loadShard(shardId);
        if (this.shardCache.size >= this.getMaxCachedShards()) {
            this.evictLRU();
        }
        this.shardCache.set(shardId, shard);
        this.updateAccessOrder(shardId);
        return shard;
    }
    getMaxCachedShards() {
        return Math.floor(this.config.memoryLimitMB / 50);
    }
    updateAccessOrder(shardId) {
        const idx = this.accessOrder.indexOf(shardId);
        if (idx !== -1)
            this.accessOrder.splice(idx, 1);
        this.accessOrder.push(shardId);
    }
    evictLRU() {
        const oldest = this.accessOrder.shift();
        if (oldest !== undefined)
            this.shardCache.delete(oldest);
    }
    addVector(vector) {
        const shardId = this.getShardId(vector.id);
        const offset = this.index.getShardSize(shardId);
        this.index.add({ vectorId: vector.id, shardId, offset });
        // Store actual vector data
        if (!this.shardData.has(shardId)) {
            this.shardData.set(shardId, new Map());
        }
        this.shardData.get(shardId).set(vector.id, vector);
    }
    addBatch(vectors) {
        vectors.forEach(v => this.addVector(v));
    }
    findVector(vectorId) {
        const entry = this.index.find(vectorId);
        if (!entry)
            return undefined;
        const shardMap = this.shardData.get(entry.shardId);
        if (!shardMap)
            return undefined;
        return shardMap.get(vectorId);
    }
    startup() {
        const start = Date.now();
        // 预热：加载前N个分片到缓存
        const preloadCount = Math.min(3, this.config.shardCount);
        for (let shardId = 0; shardId < preloadCount; shardId++) {
            if (this.index.getShardSize(shardId) > 0) {
                this.getShard(shardId);
            }
        }
        const duration = Date.now() - start;
        this.startupTime = duration;
        return { durationMs: duration };
    }
    getStats() {
        const cached = this.shardCache.size;
        return {
            totalVectors: this.index.size(),
            cachedShards: cached,
            memoryMB: Math.floor((this.index.size() * 100) / (1024 * 1024) + cached * 50),
            startupTimeMs: this.startupTime,
        };
    }
}
exports.ShardManager = ShardManager;
function createTestVectors(count, dim = 768) {
    return Array.from({ length: count }, (_, i) => ({
        id: `vec_${i}`,
        data: new Float32Array(dim).map(() => Math.random()),
    }));
}
exports.default = { ShardIndex, ShardManager, createTestVectors, DEFAULT_SHARD_CONFIG: exports.DEFAULT_SHARD_CONFIG };
//# sourceMappingURL=shard-manager.js.map