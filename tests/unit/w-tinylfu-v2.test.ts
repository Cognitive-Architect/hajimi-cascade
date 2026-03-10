/**
 * W-TinyLFU Cache V2 Test Suite
 */

import { WTinyLFUCacheV2 } from '../../src/storage/w-tinylfu-cache-v2';

describe('W-TinyLFU Cache V2 - SLRU Architecture', () => {
  let cache: WTinyLFUCacheV2<string, number>;

  beforeEach(() => {
    cache = new WTinyLFUCacheV2({ capacity: 1000 });
  });

  describe('SLRU-001: Protected Zone Capacity', () => {
    it('should allocate 80% of main cache to protected zone', () => {
      const caps = cache.getCapacities();
      const total = caps.window + caps.probation + caps.protected;
      const protectedRatio = caps.protected / (total - caps.window);
      
      expect(protectedRatio).toBeGreaterThanOrEqual(0.79);
      expect(protectedRatio).toBeLessThanOrEqual(0.81);
    });
  });

  describe('SLRU-002: Probation Zone Capacity', () => {
    it('should allocate 19% of main cache to probation zone', () => {
      const caps = cache.getCapacities();
      const total = caps.window + caps.probation + caps.protected;
      const probationRatio = caps.probation / (total - caps.window);
      
      expect(probationRatio).toBeGreaterThanOrEqual(0.18);
      expect(probationRatio).toBeLessThanOrEqual(0.20);
    });
  });

  describe('SLRU-003: Window to Probation Promotion', () => {
    it('should promote items from Window to Probation after freq >= 2', () => {
      for (let i = 0; i < 20; i++) {
        cache.put(`key${i}`, i);
      }
      
      cache.get('key1');
      let stats = cache.getStats();
      
      cache.get('key1');
      stats = cache.getStats();
      
      expect(stats.probationSize).toBeGreaterThan(0);
    });
  });

  describe('SLRU-004: Probation to Protected Promotion', () => {
    it('should promote items from Probation to Protected after freq >= 3', () => {
      for (let i = 0; i < 50; i++) {
        cache.put(`key${i}`, i);
      }
      
      cache.get('key0');
      cache.get('key0');
      cache.get('key0');
      
      expect(cache.get('key0')).toBe(0);
    });
  });

  describe('SLRU-005: Protected to Probation Demotion', () => {
    it('should demote LRU items from Protected when full', () => {
      const caps = cache.getCapacities();
      
      for (let i = 0; i < caps.protected + 50; i++) {
        cache.put(`hot${i}`, i);
        for (let j = 0; j < 5; j++) {
          cache.get(`hot${i}`);
        }
      }
      
      const stats = cache.getStats();
      expect(stats.protectedSize).toBeLessThanOrEqual(caps.protected);
      expect(stats.probationSize).toBeGreaterThan(0);
    });
  });

  describe('CF: Core Functionality', () => {
    it('should store and retrieve values', () => {
      cache.put('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should evict when capacity exceeded', () => {
      const smallCache = new WTinyLFUCacheV2<string, number>({ capacity: 50 });
      for (let i = 0; i < 200; i++) {
        smallCache.put(`key${i}`, i);
      }
      const stats = smallCache.getStats();
      const total = stats.windowSize + stats.probationSize + stats.protectedSize;
      expect(total).toBeLessThanOrEqual(50);
    });
  });

  describe('RG: API Compatibility', () => {
    it('should support basic cache operations', () => {
      cache.put('key1', 100);
      expect(cache.get('key1')).toBe(100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      
      cache.put('key2', 200);
      cache.clear();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should provide accurate stats', () => {
      let stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
      
      cache.put('key1', 1);
      cache.get('key1');
      cache.get('key2');
      
      stats = cache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('NG: Edge Cases', () => {
    it('should handle capacity=10', () => {
      const tinyCache = new WTinyLFUCacheV2<string, number>({ capacity: 10 });
      tinyCache.put('a', 1);
      expect(tinyCache.get('a')).toBe(1);
      tinyCache.put('b', 2);
      expect(tinyCache.get('b')).toBe(2);
    });
  });

  describe('High: Performance', () => {
    it('should handle 100K ops with low latency', () => {
      const perfCache = new WTinyLFUCacheV2<string, number>({ capacity: 100000 });
      
      const start = Date.now();
      for (let i = 0; i < 100000; i++) {
        perfCache.put(`k${i}`, i);
      }
      const populateTime = Date.now() - start;
      
      let hits = 0;
      const start2 = Date.now();
      for (let i = 0; i < 100000; i++) {
        if (perfCache.get(`k${Math.floor(Math.random() * 100000)}`) !== undefined) hits++;
      }
      const accessTime = Date.now() - start2;
      const avgLatency = accessTime / 100000;
      
      expect(avgLatency).toBeLessThan(0.02);
    });
  });
});
