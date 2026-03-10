/**
 * Coverage Gap Test Suite
 * 
 * 补充边缘用例，提升覆盖率从77.26%到≥80%
 * 目标：shard-manager错误分支，simhash边界条件
 */

import { ShardManager, createTestVectors, ShardIndex } from '../../src/storage/shard-manager';
import { 
  popcnt64, 
  hammingDistance, 
  isSimilar,
  CandidateLimiter,
  OverflowProtectedCalculator 
} from '../../src/cdc/simhash-math';

describe('Edge Error Handling', () => {
  describe('ShardManager Edge Cases', () => {
    it('should handle null/undefined vector add gracefully', () => {
      const manager = new ShardManager();
      
      // @ts-expect-error Testing null input
      expect(() => manager.addVector(null)).toThrow();
      // @ts-expect-error Testing undefined input  
      expect(() => manager.addVector(undefined)).toThrow();
    });

    it('should handle empty vector array', () => {
      const manager = new ShardManager();
      expect(() => manager.addBatch([])).not.toThrow();
      expect(manager.getStats().totalVectors).toBe(0);
    });

    it('should return undefined for non-existent vector', () => {
      const manager = new ShardManager();
      const vectors = createTestVectors(10);
      manager.addBatch(vectors);
      
      const found = manager.findVector('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should handle very large vector ID', () => {
      const manager = new ShardManager();
      manager.addVector({
        id: 'vec_'.repeat(100),
        data: new Float32Array(768),
      });
      
      expect(manager.getStats().totalVectors).toBe(1);
    });
  });

  describe('ShardIndex Edge Cases', () => {
    it('should handle empty index operations', () => {
      const index = new ShardIndex();
      expect(index.find('any')).toBeUndefined();
      expect(index.getShardSize(0)).toBe(0);
      expect(index.size()).toBe(0);
    });

    it('should handle duplicate adds', () => {
      const index = new ShardIndex();
      index.add({ vectorId: 'dup', shardId: 0, offset: 0 });
      index.add({ vectorId: 'dup', shardId: 0, offset: 1 });
      
      const found = index.find('dup');
      expect(found).toBeDefined();
      // Should have latest offset
      expect(found!.offset).toBe(1);
    });
  });

  describe('SimHash Math Edge Cases', () => {
    it('should handle zero value popcnt', () => {
      expect(popcnt64(0n)).toBe(0);
    });

    it('should handle max value popcnt', () => {
      const max64 = 0xffffffffffffffffn;
      expect(popcnt64(max64)).toBe(64);
    });

    it('should handle hamming distance with same value', () => {
      const val = 0x1234567890abcdefn;
      expect(hammingDistance(val, val)).toBe(0);
    });

    it('should handle hamming distance with max difference', () => {
      expect(hammingDistance(0n, 0xffffffffffffffffn)).toBe(64);
    });

    it('should detect similarity within threshold', () => {
      const a = 0b1111000011110000111100001111000011110000111100001111000011110000n;
      const b = 0b1111000011110000111100001111000011110000111100001111000011110001n;
      expect(isSimilar(a, b, 3)).toBe(true);
    });

    it('should detect non-similarity beyond threshold', () => {
      const a = 0n;
      const b = 0xffffffffffffffffn;
      expect(isSimilar(a, b, 3)).toBe(false);
    });
  });

  describe('CandidateLimiter Edge Cases', () => {
    it('should not limit when under threshold', () => {
      const limiter = new CandidateLimiter(100, 768);
      const candidates = [{ id: 1, distance: 1 }, { id: 2, distance: 2 }];
      
      expect(limiter.shouldLimit(500)).toBe(false);
      expect(limiter.limitCandidates(candidates)).toHaveLength(2);
    });

    it('should limit when over threshold', () => {
      const limiter = new CandidateLimiter(100, 768);
      const candidates = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        distance: i % 10,
      }));
      
      expect(limiter.shouldLimit(1000)).toBe(true);
      expect(limiter.limitCandidates(candidates)).toHaveLength(100);
    });

    it('should sort by distance when limiting', () => {
      const limiter = new CandidateLimiter(3, 768);
      const candidates = [
        { id: 1, distance: 10 },
        { id: 2, distance: 1 },
        { id: 3, distance: 5 },
        { id: 4, distance: 2 },
      ];
      
      const limited = limiter.limitCandidates(candidates);
      expect(limited).toHaveLength(3);
      expect(limited[0].distance).toBe(1);
      expect(limited[1].distance).toBe(2);
      expect(limited[2].distance).toBe(5);
    });
  });

  describe('OverflowProtectedCalculator Edge Cases', () => {
    it('should handle safe multiply within bounds', () => {
      const calc = new OverflowProtectedCalculator();
      expect(calc.safeMultiply(100n, 200n)).toBe(20000n);
    });

    it('should handle vector distance calculation', () => {
      const calc = new OverflowProtectedCalculator();
      const a = [1n, 2n, 3n];
      const b = [4n, 5n, 6n];
      
      const dist = calc.safeDistance(a, b);
      expect(dist).toBe(27); // (4-1)^2 + (5-2)^2 + (6-3)^2 = 9+9+9 = 27
    });

    it('should throw on dimension mismatch', () => {
      const calc = new OverflowProtectedCalculator();
      expect(() => calc.safeDistance([1n, 2n], [1n])).toThrow('dimensions must match');
    });
  });
});

describe('Invalid Dimension Handling', () => {
  it('should handle zero dimension vectors', () => {
    const manager = new ShardManager();
    manager.addVector({
      id: 'zero-dim',
      data: new Float32Array(0),
    });
    
    const found = manager.findVector('zero-dim');
    expect(found).toBeDefined();
    expect(found!.data.length).toBe(0);
  });

  it('should handle unusual dimensions', () => {
    const manager = new ShardManager();
    manager.addVector({
      id: 'odd-dim',
      data: new Float32Array(1536), // 2x standard
    });
    
    const found = manager.findVector('odd-dim');
    expect(found).toBeDefined();
    expect(found!.data.length).toBe(1536);
  });
});
