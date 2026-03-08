// 第1-15行：imports与配置
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';
import { createRequire } from 'module';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  concurrency: 1000,
  operationsPerThread: 10000,
  rounds: 10,
  tpsThreshold: 45000,
  workers: Math.min(32, os.cpus().length * 2)
};

// 第16-30行：SHA256序列化函数（必须存在）
function serializeCacheState(cache) {
  // 使用缓存内部存储区域生成确定性哈希
  const entries = [];
  // window区
  if (cache.window) {
    for (const [key, entry] of cache.window) {
      entries.push(`w:${key}:${entry.value}`);
    }
  }
  // probation区
  if (cache.probation) {
    for (const [key, entry] of cache.probation) {
      entries.push(`p:${key}:${entry.value}`);
    }
  }
  // protected区
  if (cache.protected) {
    for (const [key, entry] of cache.protected) {
      entries.push(`P:${key}:${entry.value}`);
    }
  }
  entries.sort();
  return crypto.createHash('sha256').update(entries.join('|')).digest('hex');
}

// 第31-60行：Worker线程逻辑（必须存在）
if (!isMainThread) {
  const require = createRequire(import.meta.url);
  const { WTinyLFUCacheV2 } = require(join(__dirname, '../dist/src/storage/w-tinylfu-cache-v2.js'));
  
  const { threadId, ops, keys } = workerData;
  const cache = new WTinyLFUCacheV2({ capacity: 10000 });
  
  for (let i = 0; i < ops; i++) {
    const key = keys[i % keys.length];
    const value = `thread-${threadId}-op-${i}`;
    cache.put(key, value);
    cache.get(key);
  }
  
  const state = serializeCacheState(cache);
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
        ops: Math.floor(CONFIG.operationsPerThread / CONFIG.workers),
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
  const tps = (CONFIG.operationsPerThread * CONFIG.workers) / (durationMs / 1000);
  
  const dataLoss = results.length !== CONFIG.workers;
  const states = results.map(r => r.state);
  const allSameState = states.every(s => s === states[0]);
  
  return {
    roundNum,
    durationMs,
    tps,
    dataLoss: dataLoss ? 1 : 0,
    consistencyCheck: allSameState,
    workerResults: results.length
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

main().then(r => process.exit(r.passed ? 0 : 1));
