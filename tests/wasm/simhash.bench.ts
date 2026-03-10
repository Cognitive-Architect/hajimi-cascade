/**
 * simhash.bench.ts - WASM SIMD吞吐量基准测试
 * 目标: ≥500MB/s
 */

import { SimHashWasmLoader } from '../../src/wasm/simhash-loader';
import { join } from 'path';

function jsHammingDistance(a: Uint8Array, b: Uint8Array): number {
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const xor = a[i] ^ b[i];
    dist += (xor.toString(2).match(/1/g) || []).length;
  }
  return dist;
}

async function benchmark() {
  const loader = new SimHashWasmLoader();
  const wasmPath = join(__dirname, '../../src/wasm/simhash-simd.wasm');
  const wasmReady = await loader.init(wasmPath);
  
  // 生成测试数据: 10000对128位哈希
  const pairs: [Uint8Array, Uint8Array][] = [];
  for (let i = 0; i < 10000; i++) {
    const a = new Uint8Array(16);
    const b = new Uint8Array(16);
    for (let j = 0; j < 16; j++) {
      a[j] = Math.floor(Math.random() * 256);
      b[j] = Math.floor(Math.random() * 256);
    }
    pairs.push([a, b]);
  }
  
  const dataSizeMB = (10000 * 32) / (1024 * 1024); // 32 bytes per pair
  
  // JS版本基准
  console.log('Running JS benchmark...');
  const jsStart = process.hrtime.bigint();
  for (const [a, b] of pairs) {
    jsHammingDistance(a, b);
  }
  const jsEnd = process.hrtime.bigint();
  const jsTimeMs = Number(jsEnd - jsStart) / 1e6;
  const jsThroughput = dataSizeMB / (jsTimeMs / 1000);
  
  console.log(`JS Version: ${jsTimeMs.toFixed(2)}ms, ${jsThroughput.toFixed(2)} MB/s`);
  
  // WASM版本基准
  if (wasmReady) {
    console.log('Running WASM benchmark...');
    const wasmStart = process.hrtime.bigint();
    for (const [a, b] of pairs) {
      loader.hammingDistance(a, b);
    }
    const wasmEnd = process.hrtime.bigint();
    const wasmTimeMs = Number(wasmEnd - wasmStart) / 1e6;
    const wasmThroughput = dataSizeMB / (wasmTimeMs / 1000);
    const speedup = wasmThroughput / jsThroughput;
    
    console.log(`WASM SIMD: ${wasmTimeMs.toFixed(2)}ms, ${wasmThroughput.toFixed(2)} MB/s`);
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    
    // 生成报告
    const report = `# WASM SIMD SimHash Benchmark Report

## 测试环境
- CPU: $(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d':' -f2 | xargs)
- Node.js: $(node --version)
- 测试时间: ${new Date().toISOString()}

## 测试结果

| 版本 | 时间(ms) | 吞吐量(MB/s) | 加速比 |
|:---|---:|---:|---:|
| Pure JS | ${jsTimeMs.toFixed(2)} | ${jsThroughput.toFixed(2)} | 1.0x |
| WASM SIMD | ${wasmTimeMs.toFixed(2)} | ${wasmThroughput.toFixed(2)} | ${speedup.toFixed(2)}x |

## 结论
${wasmThroughput >= 500 ? '✅ **PASS**: WASM吞吐量 ≥ 500 MB/s' : '❌ **FAIL**: WASM吞吐量 < 500 MB/s'}
${speedup >= 3 ? '✅ **PASS**: SIMD加速比 ≥ 3x' : '⚠️ 加速比 < 3x'}

## 验证命令
\`\`\`bash
node tests/wasm/simhash.bench.ts
\`\`\`
`;
    
    const fs = require('fs');
    fs.writeFileSync(join(__dirname, 'simhash.bench.result.md'), report);
    console.log('\n✅ Report saved to tests/wasm/simhash.bench.result.md');
    
    if (wasmThroughput < 500) {
      console.error('❌ FAIL: Throughput < 500 MB/s');
      process.exit(1);
    }
  } else {
    console.log('⚠️ WASM not available, skipping WASM benchmark');
  }
}

benchmark().catch(console.error);
