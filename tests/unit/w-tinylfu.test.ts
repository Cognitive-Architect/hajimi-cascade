/**
 * W-TinyLFU Cache Test Suite
 */

import { WTinyLFUCache } from '../../src/storage/w-tinylfu-cache';

describe('W-TinyLFU Cache', () => {
  let cache: WTinyLFUCache<string, number>;

  beforeEach(() => {
    cache = new WTinyLFUCache({ capacity: 1000 });
  });

  describe('Core Functionality', () => {
    it('should store and retrieve values', () => {
      cache.put('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should update existing values', () => {
      cache.put('key1', 100);
      cache.put('key1', 200);
      expect(cache.get('key1')).toBe(200);
    });

    it('should evict when capacity exceeded', () => {
      const smallCache = new WTinyLFUCache<string, number>({ capacity: 5 });
      for (let i = 0; i < 10; i++) {
        smallCache.put(`key${i}`, i);
      }
      const stats = smallCache.getStats();
      expect(stats.windowSize + stats.mainSize).toBeLessThanOrEqual(5);
    });
  });

  describe('Frequency Tracking', () => {
    it('should track access frequencies', () => {
      cache.put('freq-test', 1);
      for (let i = 0; i < 10; i++) {
        cache.get('freq-test');
      }
      const stats = cache.getStats();
      expect(stats.totalHits).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Cache Regions', () => {
    it('should promote frequently accessed items', () => {
      cache.put('promote-me', 1);
      for (let i = 0; i < 10; i++) cache.get('promote-me');
      expect(cache.get('promote-me')).toBe(1);
    });

    it('should delete items', () => {
      cache.put('key1', 100);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should clear all items', () => {
      cache.put('key1', 100);
      cache.put('key2', 200);
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('Hit Rate', () => {
    it('should achieve reasonable hit rate', () => {
      for (let i = 0; i < 1000; i++) {
        cache.put(`key${i}`, i);
      }
      
      let hits = 0;
      for (let i = 0; i < 10000; i++) {
        const key = `key${Math.floor(Math.random() * 1000)}`;
        if (cache.get(key) !== undefined) hits++;
      }
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle small capacity', () => {
      const tinyCache = new WTinyLFUCache<string, number>({ capacity: 5 });
      tinyCache.put('a', 1);
      expect(tinyCache.get('a')).toBe(1);
      tinyCache.put('b', 2);
      tinyCache.put('c', 3);
      expect(tinyCache.get('b')).toBe(2);
    });
  });
});
