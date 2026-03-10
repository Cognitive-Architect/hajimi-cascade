#!/usr/bin/env node
/**
 * regression-gate.mjs - Wave 2: 性能回归门禁
 * 
 * 基准对比、10%阈值阻断、历史趋势、详细报告
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGRESSION_THRESHOLD = 0.10; // 10%阈值

/** 解析性能输出 */
function parsePerfOutput(text) {
  const opsMatch = text.match(/(\d+(?:\.\d+)?)\s+ops\/s/);
  const msMatch = text.match(/(\d+(?:\.\d+)?)\s+ms/);
  const mbpsMatch = text.match(/(\d+(?:\.\d+)?)\s+MB\/s/);
  
  return {
    opsPerSec: opsMatch ? parseFloat(opsMatch[1]) : 0,
    durationMs: msMatch ? parseFloat(msMatch[1]) : 0,
    throughputMBps: mbpsMatch ? parseFloat(mbpsMatch[1]) : 0,
  };
}

/** 加载基准数据 */
function loadBaseline(path) {
  if (!existsSync(path)) {
    console.log('⚠️ No baseline found, creating new baseline');
    return null;
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

/** 计算回归百分比 */
function calculateRegression(current, baseline) {
  if (!baseline || baseline === 0) return 0;
  return (current - baseline) / baseline;
}

/** 主函数 */
function main() {
  const baselinePath = process.argv[2];
  const currentPath = process.argv[3];
  
  if (!currentPath) {
    console.error('Usage: node regression-gate.mjs <baseline.json> <current.txt>');
    process.exit(1);
  }

  // 加载数据
  const baseline = baselinePath ? loadBaseline(baselinePath) : null;
  const currentText = readFileSync(currentPath, 'utf-8');
  const current = parsePerfOutput(currentText);

  console.log('\n📊 Performance Regression Report');
  console.log('=' .repeat(50));
  console.log(`Current:  ${current.opsPerSec.toFixed(0)} ops/s, ${current.durationMs.toFixed(1)}ms, ${current.throughputMBps.toFixed(1)} MB/s`);
  
  if (baseline) {
    console.log(`Baseline: ${baseline.opsPerSec?.toFixed(0) || 'N/A'} ops/s`);
  }

  // 检查回归
  let hasRegression = false;
  const regressions = [];

  if (baseline && baseline.opsPerSec) {
    const opsRegression = calculateRegression(baseline.opsPerSec, current.opsPerSec);
    const thresholdPct = (REGRESSION_THRESHOLD * 100).toFixed(1);
    
    console.log(`\nRegression Threshold: ${thresholdPct}%`);
    console.log(`Ops/s Change: ${(opsRegression * 100).toFixed(2)}%`);
    
    // 负值表示性能下降（当前 < 基线）
    if (opsRegression < -REGRESSION_THRESHOLD) {
      hasRegression = true;
      regressions.push({
        metric: 'ops/sec',
        change: opsRegression,
        baseline: baseline.opsPerSec,
        current: current.opsPerSec,
      });
    }
  }

  // 输出结果
  console.log('\n' + '=' .repeat(50));
  if (hasRegression) {
    console.log('❌ REGRESSION DETECTED - Blocking merge');
    regressions.forEach(r => {
      console.log(`  ${r.metric}: ${(r.change * 100).toFixed(2)}% (threshold: ${(REGRESSION_THRESHOLD * 100).toFixed(1)}%)`);
    });
    process.exit(1);
  } else {
    console.log('✅ No significant regression detected');
    
    // 保存新基线
    const newBaselinePath = join(__dirname, '../../perf-baseline.json');
    writeFileSync(newBaselinePath, JSON.stringify(current, null, 2));
    console.log(`💾 New baseline saved to ${newBaselinePath}`);
    process.exit(0);
  }
}

main();
