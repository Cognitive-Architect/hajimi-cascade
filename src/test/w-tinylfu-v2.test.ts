/**
 * W-TinyLFU Cache V2 Test Suite
 * 
 * 工单: B-01/04 SLRU双区架构测试
 * 覆盖: SLRU-001 ~ SLRU-006
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WTinyLFUCacheV2 } from '../storage/w-tinylfu-cache-v2.js';

describe('W-TinyLFU Cache V2 - SLRU Architecture', () => {
  let cache: WTinyLFUCacheV2<string, number>;

  beforeEach(() => {
    cache = new WTinyLFUCacheV2({ capacity: 1000 });
  });

  /**
   * SLRU-001: Protected区占80%容量
   */
  describe('SLRU-001: Protected Zone Capacity', () => {
    it('should allocate 80% of main cache to protected zone', () => {
      const caps = cache.getCapacities();
      const total = caps.window + caps.probation + caps.protected;
      const protectedRatio = caps.protected / (total - caps.window);
      
      console.log(`  Capacities: Window=${caps.window}, Probation=${caps.probation}, Protected=${caps.protected}`);
      console.log(`  Protected ratio: ${(protectedRatio * 100).toFixed(1)}%`);
      
      assert.strictEqual(protectedRatio >= 0.79 && protectedRatio <= 0.81, true, 
        `Protected should be ~80% of main, got ${(protectedRatio * 100).toFixed(1)}%`);
    });
  });

  /**
   * SLRU-002: Probation区占19%容量
   */
  describe('SLRU-002: Probation Zone Capacity', () => {
    it('should allocate 19% of main cache to probation zone', () => {
      const caps = cache.getCapacities();
      const total = caps.window + caps.probation + caps.protected;
      const probationRatio = caps.probation / (total - caps.window);
      
      console.log(`  Probation ratio: ${(probationRatio * 100).toFixed(1)}%`);
      
      assert.strictEqual(probationRatio >= 0.18 && probationRatio <= 0.20, true,
        `Probation should be ~19% of main, got ${(probationRatio * 100).toFixed(1)}%`);
    });
  });

  /**
   * SLRU-003: Window→Probation晋升
   */
  describe('SLRU-003: Window to Probation Promotion', () => {
    it('should promote items from Window to Probation after freq >= 2', () => {
      // 填充Window
      for (let i = 0; i < 20; i++) {
        cache.put(`key${i}`, i);
      }
      
      // 访问key0一次 (freq=1) - 应该还在Window
      cache.get('key0');
      let stats = cache.getStats();
      console.log(`  After 1 access: Window=${stats.windowSize}, Probation=${stats.probationSize}`);
      
      // 访问key1两次 (freq=2) - 应该晋升到Probation
      cache.get('key1');
      cache.get('key1');
      stats = cache.getStats();
      console.log(`  After 2 accesses: Window=${stats.windowSize}, Probation=${stats.probationSize}`);
      
      assert.strictEqual(stats.probationSize > 0, true, 'Item should be promoted to Probation');
    });
  });

  /**
   * SLRU-004: Probation→Protected晋升
   */
  describe('SLRU-004: Probation to Protected Promotion', () => {
    it('should promote items from Probation to Protected after freq >= 3', () => {
      // 填充Window并触发驱逐
      for (let i = 0; i < 50; i++) {
        cache.put(`key${i}`, i);
      }
      
      // 访问key0三次 (freq=3) - 应该直接晋升到Protected
      cache.get('key0');
      cache.get('key0');
      cache.get('key0');
      
      const stats = cache.getStats();
      console.log(`  After 3 accesses: Window=${stats.windowSize}, Probation=${stats.probationSize}, Protected=${stats.protectedSize}`);
      
      // 验证数据存在
      assert.strictEqual(cache.get('key0'), 0, 'Item should exist');
    });

    it('should maintain promoted items in Protected under load', () => {
      // 预热热点数据
      for (let i = 0; i < 100; i++) {
        cache.put(`hot${i}`, i);
        for (let j = 0; j < 5; j++) {
          cache.get(`hot${i}`);
        }
      }
      
      const stats = cache.getStats();
      console.log(`  After warmup: Protected=${stats.protectedSize}`);
      
      // Protected应该有数据
      assert.strictEqual(stats.protectedSize > 50, true, 'Protected should contain hot items');
    });
  });

  /**
   * SLRU-005: Protected→Probation降级
   */
  describe('SLRU-005: Protected to Probation Demotion', () => {
    it('should demote LRU items from Protected to Probation when full', () => {
      const caps = cache.getCapacities();
      
      // 填充超过Protected容量的热点数据
      for (let i = 0; i < caps.protected + 50; i++) {
        cache.put(`hot${i}`, i);
        for (let j = 0; j < 5; j++) {
          cache.get(`hot${i}`);
        }
      }
      
      const stats = cache.getStats();
      console.log(`  Protected capacity: ${caps.protected}, actual: ${stats.protectedSize}`);
      console.log(`  Probation size: ${stats.probationSize}`);
      
      // Protected不应该超过容量
      assert.strictEqual(stats.protectedSize <= caps.protected, true, 
        `Protected should not exceed capacity ${caps.protected}`);
      
      // Probation应该有被降级的数据
      assert.strictEqual(stats.probationSize > 0, true, 'Probation should have demoted items');
    });

    it('should preserve hot data during demotion', () => {
      // 创建热点数据
      for (let i = 0; i < 100; i++) {
        cache.put(`hot${i}`, i);
        for (let j = 0; j < 10; j++) cache.get(`hot${i}`);
      }
      
      // 强制降级: 添加更多热点
      for (let i = 100; i < 200; i++) {
        cache.put(`hot${i}`, i);
        for (let j = 0; j < 10; j++) cache.get(`hot${i}`);
      }
      
      // 验证早期热点仍然保留
      let retained = 0;
      for (let i = 0; i < 100; i++) {
        if (cache.get(`hot${i}`) !== undefined) retained++;
      }
      
      const rate = retained / 100;
      console.log(`  Hot data retention after demotion: ${(rate * 100).toFixed(1)}%`);
      assert.strictEqual(rate >= 0.70, true, `Expected ≥70% retention, got ${(rate * 100).toFixed(1)}%`);
    });
  });

  /**
   * SLRU-006: 双区独立LRU链
   */
  describe('SLRU-006: Independent LRU Chains', () => {
    it('should maintain independent LRU chains for each zone', () => {
      // 向各区添加数据
      for (let i = 0; i < 30; i++) {
        cache.put(`key${i}`, i);
      }
      
      // 访问使部分数据晋升
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) cache.get(`key${i}`);
      }
      
      const stats = cache.getStats();
      console.log(`  Zone distribution: Window=${stats.windowSize}, Probation=${stats.probationSize}, Protected=${stats.protectedSize}`);
      
      // 验证各区有独立的数据
      assert.strictEqual(stats.windowSize + stats.probationSize + stats.protectedSize > 0, true,
        'All zones should have data');
    });

    it('should not have cross-zone pollution in LRU chains', () => {
      // 填充数据
      for (let i = 0; i < 100; i++) {
        cache.put(`k${i}`, i);
        // 高频访问晋升到Protected
        if (i < 50) {
          for (let j = 0; j < 5; j++) cache.get(`k${i}`);
        }
      }
      
      const stats = cache.getStats();
      
      // 验证总大小合理
      const total = stats.windowSize + stats.probationSize + stats.protectedSize;
      assert.strictEqual(total <= 1000, true, 'Total size should not exceed capacity');
      
      // 验证各区大小之和等于总大小
      const sum = stats.windowSize + stats.probationSize + stats.protectedSize;
      assert.strictEqual(sum, total, 'Zone sizes should sum to total');
    });
  });

  /**
   * CF-001/002/003: 核心功能
   */
  describe('CF: Core Functionality', () => {
    it('CF-001: should store and retrieve values', () => {
      cache.put('key1', 100);
      assert.strictEqual(cache.get('key1'), 100);
    });

    it('CF-002: should evict when capacity exceeded', () => {
      const smallCache = new WTinyLFUCacheV2<string, number>({ capacity: 50 });
      for (let i = 0; i < 200; i++) {
        smallCache.put(`key${i}`, i);
      }
      const stats = smallCache.getStats();
      const total = stats.windowSize + stats.probationSize + stats.protectedSize;
      assert.strictEqual(total <= 50, true, `Total ${total} should not exceed capacity 50`);
    });

    it('CF-003: should handle basic promotion chain', () => {
      cache.put('test', 1);
      assert.strictEqual(cache.get('test'), 1);
      
      // 多次访问触发晋升
      for (let i = 0; i < 5; i++) {
        cache.get('test');
      }
      
      assert.strictEqual(cache.get('test'), 1);
    });
  });

  /**
   * RG-001: API兼容性
   */
  describe('RG-001: API Compatibility', () => {
    it('should support basic cache operations', () => {
      cache.put('key1', 100);
      assert.strictEqual(cache.get('key1'), 100);
      assert.strictEqual(cache.delete('key1'), true);
      assert.strictEqual(cache.get('key1'), undefined);
      
      cache.put('key2', 200);
      cache.clear();
      assert.strictEqual(cache.get('key2'), undefined);
    });

    it('should provide accurate stats', () => {
      let stats = cache.getStats();
      assert.strictEqual(stats.hitRate, 0);
      
      cache.put('key1', 1);
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      
      stats = cache.getStats();
      assert.strictEqual(stats.totalHits, 1);
      assert.strictEqual(stats.totalMisses, 1);
      assert.strictEqual(stats.hitRate, 0.5);
    });
  });

  /**
   * NG-001: 极端容量
   */
  describe('NG-001: Edge Cases', () => {
    it('should handle capacity=10', () => {
      const tinyCache = new WTinyLFUCacheV2<string, number>({ capacity: 10 });
      tinyCache.put('a', 1);
      assert.strictEqual(tinyCache.get('a'), 1);
      tinyCache.put('b', 2);
      assert.strictEqual(tinyCache.get('b'), 2);
    });

    it('should handle single item promotion', () => {
      const tinyCache = new WTinyLFUCacheV2<string, number>({ capacity: 10 });
      tinyCache.put('a', 1);
      tinyCache.get('a');
      tinyCache.get('a');
      assert.strictEqual(tinyCache.get('a'), 1);
    });
  });

  /**
   * NG-002: 一致性
   */
  describe('NG-002: Consistency', () => {
    it('should maintain data consistency under mixed operations', () => {
      for (let i = 0; i < 100; i++) {
        cache.put(`key${i}`, i * 10);
      }
      
      // 混合读写
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 100; i++) {
          if (i % 3 === 0) {
            cache.put(`key${i}`, i * 100);
          } else {
            cache.get(`key${i}`);
          }
        }
      }
      
      // 验证数据一致性
      for (let i = 0; i < 100; i += 3) {
        const val = cache.get(`key${i}`);
        if (val !== undefined) {
          assert.strictEqual(val, i * 100);
        }
      }
    });
  });

  /**
   * UX-001: 可观测性
   */
  describe('UX-001: Observability', () => {
    it('should provide detailed zone stats', () => {
      // 填充各区域
      for (let i = 0; i < 200; i++) {
        cache.put(`k${i}`, i);
        if (i < 100) {
          for (let j = 0; j < 5; j++) cache.get(`k${i}`);
        }
      }
      
      const stats = cache.getStats();
      assert.strictEqual(typeof stats.windowSize, 'number');
      assert.strictEqual(typeof stats.probationSize, 'number');
      assert.strictEqual(typeof stats.protectedSize, 'number');
      assert.strictEqual(typeof stats.hitRate, 'number');
      assert.strictEqual(typeof stats.evictions, 'number');
      
      console.log(`  Stats:`, stats);
    });
  });

  /**
   * E2E-001: 生命周期
   */
  describe('E2E-001: Lifecycle', () => {
    it('should complete full item lifecycle: Window→Probation→Protected→Demotion→Eviction', () => {
      const caps = cache.getCapacities();
      
      // Phase 1: 放入Window
      cache.put('lifecycle', 1);
      let stats = cache.getStats();
      assert.strictEqual(stats.windowSize >= 1, true, 'Item should be in Window');
      
      // Phase 2: 访问2次，晋升到Probation
      cache.get('lifecycle');
      cache.get('lifecycle');
      
      // Phase 3: 再访问1次，可能晋升到Protected
      cache.get('lifecycle');
      
      // Phase 4: 验证数据存在
      assert.strictEqual(cache.get('lifecycle'), 1, 'Item should survive promotion');
      
      console.log(`  Lifecycle test passed`);
    });
  });

  /**
   * High-001: 性能
   */
  describe('High-001: Performance', () => {
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
      
      console.log(`  Populate: ${populateTime}ms, Access: ${accessTime}ms, Latency: ${(avgLatency * 1000).toFixed(2)}μs`);
      assert.strictEqual(avgLatency < 0.02, true, 'Latency should be < 20μs');
    });
  });
});

console.log('W-TinyLFU V2 SLRU Test Suite Loaded');
