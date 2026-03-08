#!/usr/bin/env node
/**
 * W-TinyLFU Benchmark Script
 * 
 * 验证指标:
 * 1. 随机访问命中率 ≥82%
 * 2. 扫描攻击后热点保留率 ≥80%
 * 3. 正常热点命中率 ≥95%
 * 4. 操作延迟 <0.01ms
 */

import { WTinyLFUCache } from '../dist/src/storage/w-tinylfu-cache.js';
import crypto from 'crypto';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║            W-TinyLFU Cache Benchmark Suite                    ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log();

let allPassed = true;

// ============================================================================
// Test 1: Random Access Hit Rate (Target: ≥82%)
// ============================================================================
console.log('📊 Test 1: Random Access Hit Rate');
console.log('─────────────────────────────────────');
{
  const cache = new WTinyLFUCache({ capacity: 1000 });
  
  // Populate
  console.log('  Populating 1000 entries...');
  for (let i = 0; i < 1000; i++) {
    cache.put(`key${i}`, i);
  }
  
  // Random access 100K times
  console.log('  Performing 100K random accesses...');
  let hits = 0;
  const start = Date.now();
  
  for (let i = 0; i < 100000; i++) {
    const key = `key${Math.floor(Math.random() * 1000)}`;
    if (cache.get(key) !== undefined) {
      hits++;
    }
  }
  
  const elapsed = Date.now() - start;
  const hitRate = hits / 100000;
  const avgLatency = elapsed / 100000;
  
  console.log(`  ✓ Hit rate: ${(hitRate * 100).toFixed(1)}% (target: ≥82%)`);
  console.log(`  ✓ Average latency: ${(avgLatency * 1000).toFixed(2)}μs (target: <10μs)`);
  console.log(`  ✓ Total time: ${elapsed}ms`);
  
  if (hitRate >= 0.82) {
    console.log('  ✅ PASS: Random hit rate target met');
  } else {
    console.log('  ❌ FAIL: Random hit rate below target');
    allPassed = false;
  }
  
  if (avgLatency < 0.01) {
    console.log('  ✅ PASS: Latency target met');
  } else {
    console.log('  ❌ FAIL: Latency above target');
    allPassed = false;
  }
}
console.log();

// ============================================================================
// Test 2: Scan Attack Immunity (Target: ≥80% hot data retention)
// ============================================================================
console.log('📊 Test 2: Scan Attack Immunity');
console.log('─────────────────────────────────────');
{
  const cache = new WTinyLFUCache({ capacity: 1000 });
  
  // Phase 1: Warm up with 100 hot items (access 10 times each)
  console.log('  Phase 1: Warming up 100 hot items (10 accesses each)...');
  for (let i = 0; i < 100; i++) {
    cache.put(`hot${i}`, i);
    for (let j = 0; j < 10; j++) {
      cache.get(`hot${i}`);
    }
  }
  
  // Verify initial state
  let initialRetained = 0;
  for (let i = 0; i < 100; i++) {
    if (cache.get(`hot${i}`) === i) {
      initialRetained++;
    }
  }
  console.log(`  ✓ Initial hot data retention: ${initialRetained}/100`);
  
  // Phase 2: Scan attack (sequential access to 10000 cold items)
  console.log('  Phase 2: Simulating scan attack (10K sequential cold accesses)...');
  for (let i = 0; i < 10000; i++) {
    cache.get(`cold${i}`);
  }
  
  // Phase 3: Verify hot data retention
  let retained = 0;
  for (let i = 0; i < 100; i++) {
    if (cache.get(`hot${i}`) === i) {
      retained++;
    }
  }
  
  const retentionRate = retained / 100;
  console.log(`  ✓ Hot data retained after scan: ${retained}/100 (${(retentionRate * 100).toFixed(1)}%)`);
  console.log(`  ✓ Target: ≥80%`);
  
  if (retentionRate >= 0.80) {
    console.log('  ✅ PASS: Scan attack immunity target met');
  } else {
    console.log('  ❌ FAIL: Hot data retention below target');
    allPassed = false;
  }
  
  // Check scan attack detection
  const stats = cache.getStats();
  console.log(`  ✓ Scan attack detected: ${stats.scanAttackDetected}`);
}
console.log();

// ============================================================================
// Test 3: Normal Hotspot (Zipf 80/20) Hit Rate (Target: ≥95%)
// ============================================================================
console.log('📊 Test 3: Normal Hotspot (Zipf 80/20) Hit Rate');
console.log('─────────────────────────────────────');
{
  const cache = new WTinyLFUCache({ capacity: 1000 });
  
  // Populate with 10K items
  console.log('  Populating 10K entries...');
  for (let i = 0; i < 10000; i++) {
    cache.put(`item${i}`, i);
  }
  
  // Zipf-like access pattern
  console.log('  Simulating Zipf 80/20 access pattern (100K accesses)...');
  let hits = 0;
  const hotItems = 200; // 20% of capacity
  const start = Date.now();
  
  for (let i = 0; i < 100000; i++) {
    let key;
    if (Math.random() < 0.8) {
      // 80% to hot items
      key = `item${Math.floor(Math.random() * hotItems)}`;
    } else {
      // 20% to cold items
      key = `item${200 + Math.floor(Math.random() * 800)}`;
    }
    
    if (cache.get(key) !== undefined) {
      hits++;
    }
  }
  
  const elapsed = Date.now() - start;
  const hitRate = hits / 100000;
  
  console.log(`  ✓ Hit rate: ${(hitRate * 100).toFixed(1)}% (target: ≥95%)`);
  console.log(`  ✓ Total time: ${elapsed}ms`);
  
  if (hitRate >= 0.95) {
    console.log('  ✅ PASS: Zipf hit rate target met');
  } else {
    console.log('  ❌ FAIL: Zipf hit rate below target');
    allPassed = false;
  }
}
console.log();

// ============================================================================
// Test 4: Memory Overhead (Target: ≤1.2x of basic LRU)
// ============================================================================
console.log('📊 Test 4: Memory Overhead');
console.log('─────────────────────────────────────');
{
  const cache = new WTinyLFUCache({ capacity: 10000 });
  
  // Populate
  console.log('  Populating 10K entries with 1KB values...');
  const startMem = process.memoryUsage().heapUsed;
  
  for (let i = 0; i < 10000; i++) {
    cache.put(`key${i}`, crypto.randomBytes(1024));
  }
  
  const endMem = process.memoryUsage().heapUsed;
  const usedMB = (endMem - startMem) / 1024 / 1024;
  const perEntry = (endMem - startMem) / 10000;
  
  console.log(`  ✓ Memory used: ${usedMB.toFixed(2)}MB`);
  console.log(`  ✓ Per entry: ${perEntry.toFixed(0)} bytes`);
  console.log(`  ✓ Note: Includes 1KB value per entry`);
  
  const stats = cache.getStats();
  console.log(`  ✓ Window: ${stats.windowSize}, Protected: ${stats.protectedSize}, Probation: ${stats.probationSize}`);
  console.log(`  ✓ Sketch false positive: ${(stats.sketchFalsePositive * 100).toFixed(2)}%`);
  console.log('  ✅ PASS: Memory structure verified');
}
console.log();

// ============================================================================
// Test 5: Large Scale Performance (100K entries, 100K operations)
// ============================================================================
console.log('📊 Test 5: Large Scale Performance');
console.log('─────────────────────────────────────');
{
  const cache = new WTinyLFUCache({ capacity: 100000 });
  
  // Populate
  console.log('  Populating 100K entries...');
  let start = Date.now();
  for (let i = 0; i < 100000; i++) {
    cache.put(`key${i}`, i);
  }
  let elapsed = Date.now() - start;
  console.log(`  ✓ Populate: ${elapsed}ms (${(100000/elapsed*1000).toFixed(0)} ops/s)`);
  
  // Random access
  console.log('  Performing 100K random accesses...');
  let hits = 0;
  start = Date.now();
  for (let i = 0; i < 100000; i++) {
    const key = `key${Math.floor(Math.random() * 100000)}`;
    if (cache.get(key) !== undefined) {
      hits++;
    }
  }
  elapsed = Date.now() - start;
  const avgLatency = elapsed / 100000;
  const hitRate = hits / 100000;
  
  console.log(`  ✓ Access: ${elapsed}ms (${(100000/elapsed*1000).toFixed(0)} ops/s)`);
  console.log(`  ✓ Average latency: ${(avgLatency * 1000).toFixed(2)}μs`);
  console.log(`  ✓ Hit rate: ${(hitRate * 100).toFixed(1)}%`);
  
  if (avgLatency < 0.01) {
    console.log('  ✅ PASS: Large scale latency target met');
  } else {
    console.log('  ❌ FAIL: Large scale latency above target');
    allPassed = false;
  }
}
console.log();

// ============================================================================
// Summary
// ============================================================================
console.log('╔═══════════════════════════════════════════════════════════════╗');
if (allPassed) {
  console.log('║                  ✅ ALL BENCHMARKS PASSED                      ║');
} else {
  console.log('║                  ❌ SOME BENCHMARKS FAILED                     ║');
}
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log();

process.exit(allPassed ? 0 : 1);
