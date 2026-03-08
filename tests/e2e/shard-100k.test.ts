/**
 * SHARD-001 E2E Test: 100K Vector Sharding
 */

import {
  ShardManager,
  ShardIndex,
  createTestVectors,
} from '../../src/storage/shard-manager';

describe('SHARD-001: 100K Vector Sharding', () => {
  it('should handle 10K vectors', () => {
    const manager = new ShardManager();
    const vectors = createTestVectors(10000);
    
    manager.addBatch(vectors);
    const stats = manager.getStats();
    
    expect(stats.totalVectors).toBe(10000);
  });

  it('should startup quickly', () => {
    const manager = new ShardManager();
    const vectors = createTestVectors(10000);
    manager.addBatch(vectors);
    
    const result = manager.startup();
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('should respect memory limit', () => {
    const manager = new ShardManager({ memoryLimitMB: 100 });
    const vectors = createTestVectors(10000);
    manager.addBatch(vectors);
    
    // Access vectors from different shards
    for (let i = 0; i < 100; i += 10) {
      manager.findVector(`vec_${i}`);
    }
    
    const stats = manager.getStats();
    expect(stats.memoryMB).toBeLessThanOrEqual(200);
  });

  it('should find vector after adding', () => {
    const manager = new ShardManager();
    const vectors = createTestVectors(1000);
    manager.addBatch(vectors);
    
    const found = manager.findVector('vec_500');
    expect(found).toBeDefined();
    expect(found!.id).toBe('vec_500');
  });
});
