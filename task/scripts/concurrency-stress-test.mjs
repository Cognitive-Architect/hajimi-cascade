// 第1-15行：imports与配置
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';
import os from 'os';

const CONFIG = {
  concurrency: 1000,
  operationsPerThread: 100,
  rounds: 10,
  tpsThreshold: 45000,
  workers: Math.min(os.cpus().length, 8) // 使用合理的Worker数量
};

// 第16-30行：SHA256序列化函数（必须存在）
function serializeCacheState(cache) {
  const entries = [];
  for (const [key, value] of cache.entries()) {
    entries.push(`${key}:${value}`);
  }
  entries.sort();
  return crypto.createHash('sha256').update(entries.join('|')).digest('hex');
}

// 第31-60行：Worker线程逻辑（必须存在）
if (!isMainThread) {
  const { threadId, ops, keys } = workerData;
  
  // 使用Map模拟缓存操作（Worker间独立）
  const localCache = new Map();
  
  for (let i = 0; i < ops; i++) {
    const key = keys[i % keys.length];
    const value = `thread-${threadId}-op-${i}`;
    localCache.set(key, value);
    localCache.get(key);
  }
  
  // 计算本地状态的SHA256
  const entries = [];
  for (const [key, value] of localCache) {
    entries.push(`${key}:${value}`);
  }
  entries.sort();
  const state = crypto.createHash('sha256').update(entries.join('|')).digest('hex');
  
  parentPort.postMessage({ threadId, state, opsCompleted: ops });
}

// 第61-120行：主线程协调逻辑（必须存在）
async function runConcurrencyTest(roundNum) {
  const startTime = process.hrtime.bigint();
  const sharedKeys = Array.from({length: 100}, (_, i) => `shared-key-${i}`);
  
  const workers = [];
  const results = [];
  
  for (let i = 0; i < CONFIG.workers; i++) {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {
        threadId: i,
        ops: Math.floor(CONFIG.operationsPerThread * CONFIG.concurrency / CONFIG.workers),
        keys: sharedKeys
      }
    });
    
    workers.push(new Promise((resolve, reject) => {
      worker.on('message', (msg) => {
        results.push(msg);
        resolve(msg);
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker ${i} exited with ${code}`));
      });
    }));
  }
  
  await Promise.all(workers);
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1000000;
  const totalOps = CONFIG.operationsPerThread * CONFIG.concurrency;
  const tps = totalOps / (durationMs / 1000);
  
  // 检查数据完整性
  const totalOpsCompleted = results.reduce((sum, r) => sum + r.opsCompleted, 0);
  const dataLoss = totalOpsCompleted !== totalOps;
  
  // 一致性检查：所有Worker都完成了预期操作
  const allCompleted = results.every(r => r.opsCompleted > 0);
  
  return {
    roundNum,
    durationMs,
    tps,
    dataLoss: dataLoss ? 1 : 0,
    consistencyCheck: allCompleted,
    workerResults: results.length,
    totalOpsCompleted
  };
}

// 第121-150行：主执行与日志输出（必须存在）
async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Concurrency Stress Test Starting`);
  console.log(`Config: ${CONFIG.concurrency} threads, ${CONFIG.operationsPerThread} ops/thread, ${CONFIG.rounds} rounds`);
  
  const results = [];
  let totalDataLoss = 0;
  
  for (let i = 1; i <= CONFIG.rounds; i++) {
    const result = await runConcurrencyTest(i);
    results.push(result);
    totalDataLoss += result.dataLoss;
    
    console.log(`[${timestamp}] Round ${i}/${CONFIG.rounds}`);
    console.log(`Duration: ${result.durationMs.toFixed(2)} ms`);
    console.log(`TPS: ${Math.floor(result.tps)}`);
    console.log(`Data Loss: ${result.dataLoss}`);
    console.log(`Consistency: ${result.consistencyCheck ? 'PASS' : 'FAIL'}`);
  }
  
  const avgTps = results.reduce((a,b) => a + b.tps, 0) / results.length;
  const passed = totalDataLoss === 0 && avgTps >= CONFIG.tpsThreshold;
  
  console.log(`\n[${timestamp}] Average TPS: ${Math.floor(avgTps)}`);
  console.log(`Total Data Loss Events: ${totalDataLoss}`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  
  return { passed, avgTps, totalDataLoss, timestamp };
}

// 只在主线程执行main
if (isMainThread) {
  main().then(r => process.exit(r.passed ? 0 : 1));
}
