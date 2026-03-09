#!/usr/bin/env node
/**
 * memory-profiler.mjs
 * Wave 1: 内存分析工具 - 3分钟诊断报告
 * 
 * 每秒采样RSS，生成CSV，计算泄漏斜率
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DURATION_MS = 180000;  // 3分钟
const INTERVAL_MS = 1000;    // 每秒采样

async function runProfiler() {
  console.log('🔬 Memory Profiler Starting...');
  console.log(`Duration: ${DURATION_MS / 1000}s, Interval: ${INTERVAL_MS}ms`);
  console.log('');

  const samples = [];
  const startTime = Date.now();

  // 启动被测进程
  const testProcess = spawn('node', [
    '--expose-gc',
    join(__dirname, '../../node_modules/.bin/jest'),
    'tests/stress/3min-stress.test.ts',
    '--testNamePattern', '3分钟高频压力',
    '--forceExit',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: join(__dirname, '../..'),
  });

  // 采样循环
  const sampleInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const elapsed = Date.now() - startTime;
    samples.push({
      timestamp: new Date().toISOString(),
      elapsedSec: (elapsed / 1000).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(2),
      heapMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
    });
  }, INTERVAL_MS);

  // 等待测试完成
  await new Promise((resolve) => {
    testProcess.on('close', resolve);
    setTimeout(() => {
      testProcess.kill();
      resolve();
    }, DURATION_MS + 30000);
  });

  clearInterval(sampleInterval);

  // 生成CSV
  const csvHeader = 'timestamp,elapsedSec,rssMB,heapMB\n';
  const csvBody = samples.map(s => `${s.timestamp},${s.elapsedSec},${s.rssMB},${s.heapMB}`).join('\n');
  const csvPath = join(__dirname, '../../memory-profile.csv');
  writeFileSync(csvPath, csvHeader + csvBody);

  // 计算泄漏斜率
  const rssValues = samples.map(s => parseFloat(s.rssMB));
  const initialRSS = rssValues[0];
  const finalRSS = rssValues[rssValues.length - 1];
  const slope = (finalRSS - initialRSS) / (samples.length || 1);
  const growthPct = ((finalRSS - initialRSS) / initialRSS * 100).toFixed(1);

  // 输出诊断报告
  console.log('\n📊 Memory Diagnostic Report');
  console.log('=' .repeat(40));
  console.log(`Samples:     ${samples.length}`);
  console.log(`Initial RSS: ${initialRSS.toFixed(2)} MB`);
  console.log(`Final RSS:   ${finalRSS.toFixed(2)} MB`);
  console.log(`Growth:      ${growthPct}%`);
  console.log(`Slope:       ${slope.toFixed(3)} MB/s`);
  console.log(`Status:      ${slope < 0.1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=' .repeat(40));
  console.log(`CSV saved: ${csvPath}`);
}

runProfiler().catch(err => {
  console.error('Profiler error:', err);
  process.exit(1);
});
