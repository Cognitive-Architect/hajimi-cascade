// 第1-10行：imports与配置
import { WTinyLFUCacheV2 } from '../src/storage/w-tinylfu-cache-v2.js';

// 适配层：V2使用put而不是set
class WTinyLFUCache {
  constructor(options) {
    this.cache = new WTinyLFUCacheV2(options);
  }
  set(key, value) {
    this.cache.put(key, value);
  }
  get(key) {
    return this.cache.get(key);
  }
  clear() {
    this.cache.clear();
  }
}

const CONFIG = {
  rounds: 3,
  operations: 100000,
  varianceThreshold: 0.001, // 0.1%
  growthThreshold: 0.01     // 1%
};

// 第11-20行：measureRSS函数（必须存在）
function measureRSS() {
  const usage = process.memoryUsage();
  return usage.rss / 1024 / 1024; // 转换为MB
}

// 第21-50行：runMemoryTest函数（必须存在）
async function runMemoryTest(roundNum, ops, cache) {
  const initialRSS = measureRSS();
  let peakRSS = initialRSS;
  
  // 必须执行的操作序列 - 使用完全相同的key和value
  for (let i = 0; i < ops; i++) {
    cache.set(`key-${i}`, `value-${i}-`.repeat(100));
    if (i % 1000 === 0) {
      const current = measureRSS();
      if (current > peakRSS) peakRSS = current;
    }
  }
  
  // 必须强制GC（如果可用）
  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 1000));
  
  const finalRSS = measureRSS();
  const growth = initialRSS > 0 ? (finalRSS - initialRSS) / initialRSS : 0;
  
  return { initialRSS, peakRSS, finalRSS, growth };
}

// 第51-80行：主执行逻辑（必须存在）
async function main() {
  const results = [];
  const timestamp = new Date().toISOString();
  
  // 预创建并预热cache到稳态
  const cache = new WTinyLFUCache({ capacity: 10000 });
  
  // 预热到稳态
  for (let i = 0; i < 50000; i++) {
    cache.set(`key-${i}`, `value-${i}-`.repeat(100));
  }
  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 2000));
  
  for (let i = 1; i <= CONFIG.rounds; i++) {
    const result = await runMemoryTest(i, CONFIG.operations, cache);
    results.push(result);
    // 必须实时输出到控制台
    console.log(`[${timestamp}] Round ${i}/${CONFIG.rounds}`);
    console.log(`Initial RSS: ${result.initialRSS.toFixed(2)} MB`);
    console.log(`Peak RSS: ${result.peakRSS.toFixed(2)} MB`);
    console.log(`Final RSS: ${result.finalRSS.toFixed(2)} MB`);
    console.log(`Growth Rate: ${(result.growth * 100).toFixed(2)}%`);
  }
  
  // 方差计算（必须存在）
  const avgGrowth = results.reduce((a,b) => a + b.growth, 0) / results.length;
  const variance = results.length > 0 ? 
    Math.sqrt(results.reduce((sq, n) => sq + Math.pow(n.growth - avgGrowth, 2), 0) / results.length) : 0;
  
  // 最终判定（必须输出）
  const passed = Math.abs(avgGrowth) < CONFIG.growthThreshold && variance < CONFIG.varianceThreshold;
  console.log(`\n[${timestamp}] Variance: ${(variance * 100).toFixed(4)}%`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  
  return { results, avgGrowth, variance, passed, timestamp };
}

// 必须执行main
main().then(r => process.exit(r.passed ? 0 : 1));
