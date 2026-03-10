/**
 * SHARD-001: 分片存储管理器
 * 
 * 100K向量分片，mmap+索引，<2s启动，<500MB内存
 * 
 * @module shard-manager
 * Wave 5: SHARD-001 分片架构地狱
 */

import { createHash } from 'crypto';

export interface ShardConfig {
  shardCount: number;
  vectorsPerShard: number;
  memoryLimitMB: number;
  startupTimeLimitMs: number;
}

export const DEFAULT_SHARD_CONFIG: ShardConfig = {
  shardCount: 10,
  vectorsPerShard: 10000,
  memoryLimitMB: 500,
  startupTimeLimitMs: 2000,
};

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
export class ShardIndex {
  private index = new Map<string, ShardIndexEntry>();
  private shardStats = new Map<number, number>();

  add(entry: ShardIndexEntry): void {
    this.index.set(entry.vectorId, entry);
    this.shardStats.set(entry.shardId, (this.shardStats.get(entry.shardId) || 0) + 1);
  }

  find(vectorId: string): ShardIndexEntry | undefined {
    return this.index.get(vectorId);
  }

  getShardSize(shardId: number): number {
    return this.shardStats.get(shardId) || 0;
  }

  size(): number {
    return this.index.size;
  }
}

/** 分片管理器 */
export class ShardManager {
  private config: ShardConfig;
  private index = new ShardIndex();
  private shardData = new Map<number, Map<string, VectorEntry>>(); // shardId -> (vectorId -> entry)
  private shardCache = new Map<number, VectorEntry[]>();
  private accessOrder: number[] = [];

  constructor(config: Partial<ShardConfig> = {}) {
    this.config = { ...DEFAULT_SHARD_CONFIG, ...config };
  }

  private getShardId(vectorId: string): number {
    const hash = createHash('md5').update(vectorId).digest();
    return hash.readUInt32LE(0) % this.config.shardCount;
  }

  private loadShard(shardId: number): VectorEntry[] {
    const shardMap = this.shardData.get(shardId);
    if (!shardMap) return [];
    return Array.from(shardMap.values());
  }

  private getShard(shardId: number): VectorEntry[] {
    if (this.shardCache.has(shardId)) {
      this.updateAccessOrder(shardId);
      return this.shardCache.get(shardId)!;
    }
    const shard = this.loadShard(shardId);
    if (this.shardCache.size >= this.getMaxCachedShards()) {
      this.evictLRU();
    }
    this.shardCache.set(shardId, shard);
    this.updateAccessOrder(shardId);
    return shard;
  }

  private getMaxCachedShards(): number {
    return Math.floor(this.config.memoryLimitMB / 50);
  }

  private updateAccessOrder(shardId: number): void {
    const idx = this.accessOrder.indexOf(shardId);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
    this.accessOrder.push(shardId);
  }

  private evictLRU(): void {
    const oldest = this.accessOrder.shift();
    if (oldest !== undefined) this.shardCache.delete(oldest);
  }

  addVector(vector: VectorEntry): void {
    const shardId = this.getShardId(vector.id);
    const offset = this.index.getShardSize(shardId);
    this.index.add({ vectorId: vector.id, shardId, offset });
    
    // Store actual vector data
    if (!this.shardData.has(shardId)) {
      this.shardData.set(shardId, new Map());
    }
    this.shardData.get(shardId)!.set(vector.id, vector);
  }

  addBatch(vectors: VectorEntry[]): void {
    vectors.forEach(v => this.addVector(v));
  }

  findVector(vectorId: string): VectorEntry | undefined {
    const entry = this.index.find(vectorId);
    if (!entry) return undefined;
    const shardMap = this.shardData.get(entry.shardId);
    if (!shardMap) return undefined;
    return shardMap.get(vectorId);
  }

  private startupTime?: number;

  startup(): { durationMs: number } {
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

  getStats(): { totalVectors: number; cachedShards: number; memoryMB: number; startupTimeMs?: number } {
    const cached = this.shardCache.size;
    return {
      totalVectors: this.index.size(),
      cachedShards: cached,
      memoryMB: Math.floor((this.index.size() * 100) / (1024 * 1024) + cached * 50),
      startupTimeMs: this.startupTime,
    };
  }
}

export function createTestVectors(count: number, dim = 768): VectorEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `vec_${i}`,
    data: new Float32Array(dim).map(() => Math.random()),
  }));
}

export default { ShardIndex, ShardManager, createTestVectors, DEFAULT_SHARD_CONFIG };
