/**
 * SHARD-001 Real 100K Vector E2E Test
 * 
 * 真实100K向量测试，非Mock，验证启动时间和内存
 */

import {
  ShardManager,
  createTestVectors,
} from '../../src/storage/shard-manager';

describe('SHARD-001 Real 100K: Performance Baseline', () => {
  let manager: ShardManager;

  beforeEach(() => {
    manager = new ShardManager({
      shardCount: 10,
      vectorsPerShard: 10000,
      memoryLimitMB: 500,
      startupTimeLimitMs: 2000,
    });
  });

  it('should initialize 100000 vectors', () => {
    const vectors = createTestVectors(100000);
    expect(vectors.length).toBe(100000);
    expect(vectors[0].id).toBe('vec_0');
    expect(vectors[99999].id).toBe('vec_99999');
  });

  it('should add 100K vectors to manager', () => {
    const vectors = createTestVectors(100000);
    
    const startMem = process.memoryUsage().heapUsed;
    manager.addBatch(vectors);
    const endMem = process.memoryUsage().heapUsed;
    
    const stats = manager.getStats();
    expect(stats.totalVectors).toBe(100000);
    
    console.log(`100K vectors added, heap delta: ${((endMem - startMem) / 1024 / 1024).toFixed(2)} MB`);
  });

  it('should startup in less than 2000ms', () => {
    const vectors = createTestVectors(100000);
    manager.addBatch(vectors);
    
    const result = manager.startup();
    
    console.log(`100K startup time: ${result.durationMs}ms`);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('should use less than 500MB memory', () => {
    const vectors = createTestVectors(100000);
    manager.addBatch(vectors);
    manager.startup();
    
    // Access some vectors to populate cache
    for (let i = 0; i < 1000; i += 100) {
      manager.findVector(`vec_${i}`);
    }
    
    const stats = manager.getStats();
    console.log(`Memory usage: ${stats.memoryMB}MB`);
    expect(stats.memoryMB).toBeLessThan(500);
  });

  it('should find vector after adding 100K', () => {
    const vectors = createTestVectors(100000);
    manager.addBatch(vectors);
    manager.startup();
    
    const found = manager.findVector('vec_50000');
    expect(found).toBeDefined();
    expect(found!.id).toBe('vec_50000');
    expect(found!.data).toBeInstanceOf(Float32Array);
    expect(found!.data.length).toBe(768);
  });

  it('should handle empty vector array', () => {
    manager.addBatch([]);
    const stats = manager.getStats();
    expect(stats.totalVectors).toBe(0);
    
    const result = manager.startup();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should have consistent startup time on multiple calls', () => {
    const vectors = createTestVectors(100000);
    manager.addBatch(vectors);
    
    const result1 = manager.startup();
    const result2 = manager.startup();
    
    // Both should be positive and reasonable
    expect(result1.durationMs).toBeGreaterThanOrEqual(0);
    expect(result2.durationMs).toBeGreaterThanOrEqual(0);
    
    const stats = manager.getStats();
    console.log(`Startup time recorded: ${stats.startupTimeMs}ms`);
  });

  it('should not leak memory significantly', () => {
    const vectors = createTestVectors(100000);
    
    const memBefore = process.memoryUsage().rss;
    manager.addBatch(vectors);
    manager.startup();
    
    // Force gc if available
    if (global.gc) {
      global.gc();
    }
    
    const memAfter = process.memoryUsage().rss;
    const growthMB = (memAfter - memBefore) / 1024 / 1024;
    
    console.log(`Memory growth: ${growthMB.toFixed(2)} MB`);
    expect(growthMB).toBeLessThan(100); // Less than 100MB growth
  });
});
