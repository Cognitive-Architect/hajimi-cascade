/**
 * simhash.bench.ts - B-01: SimHash性能测试 (≤100行)
 * 目标: ≥500MB/s WASM SIMD吞吐量
 */

import { createSimHash } from '../../src/cdc/simhash-wasm';

async function benchmark() {
  console.log('=== SimHash WASM Benchmark ===\n');
  
  const simhash = await createSimHash({ backend: 'auto' });
  console.log(`Backend: ${simhash.currentBackend}`);
  
  // 准备测试数据 (100MB)
  const dataSize = 100 * 1024 * 1024;
  const vectorSize = 768;
  const numVectors = Math.floor(dataSize / (vectorSize * 4));
  const vectors: Float32Array[] = [];
  
  for (let i = 0; i < numVectors; i++) {
    vectors.push(new Float32Array(vectorSize).map(() => Math.random() * 2 - 1));
  }
  
  console.log(`Vectors: ${numVectors}, Size: ${(dataSize / 1024 / 1024).toFixed(1)}MB\n`);
  
  // Benchmark: 哈希计算
  const start = process.hrtime.bigint();
  const hashes = vectors.map(v => simhash.hash(v));
  const end = process.hrtime.bigint();
  
  const elapsedMs = Number(end - start) / 1e6;
  const throughput = dataSize / (elapsedMs / 1000) / (1024 * 1024);
  
  console.log('--- Hash Performance ---');
  console.log(`Time: ${elapsedMs.toFixed(2)}ms`);
  console.log(`Throughput: ${throughput.toFixed(1)} MB/s`);
  console.log(`Target: ≥500 MB/s ${throughput >= 500 ? '✅' : '❌'}`);
  
  // Benchmark: 汉明距离
  const query = hashes[0];
  const candidates = hashes.slice(1);
  
  const distStart = process.hrtime.bigint();
  const distances = simhash.batchDistance(query, candidates.slice(0, 1000));
  const distEnd = process.hrtime.bigint();
  
  const distMs = Number(distEnd - distStart) / 1e6;
  console.log(`\n--- Distance Performance ---`);
  console.log(`1000 distances in ${distMs.toFixed(2)}ms`);
  console.log(`Avg: ${(distMs / 1000).toFixed(3)}ms/op`);
  
  // 验证正确性
  const wasmDist = simhash.distance(hashes[0], hashes[1]);
  let jsDist = 0;
  for (let i = 0; i < 16; i++) {
    jsDist += popcnt(hashes[0][i] ^ hashes[1][i]);
  }
  
  console.log(`\n--- Correctness ---`);
  console.log(`WASM distance: ${wasmDist}`);
  console.log(`JS distance: ${jsDist}`);
  console.log(`Match: ${wasmDist === jsDist ? '✅' : '❌'}`);
  
  // 最终断言
  console.log(`\n=== Result ===`);
  if (throughput >= 500 && wasmDist === jsDist) {
    console.log('✅ B-01 PASSED');
    process.exit(0);
  } else {
    console.log('❌ B-01 FAILED');
    process.exit(1);
  }
}

function popcnt(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >> 24;
}

benchmark().catch(console.error);
