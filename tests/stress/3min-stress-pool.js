/**
 * 3min-stress-pool.js - 3分钟Pool压力测试
 * 验证RSS波动<10%
 */

const { BufferPool } = require('../../dist/utils/buffer-pool');

const POOL_SIZE = 1024 * 1024; // 1MB
const TEST_DURATION_MS = 3 * 60 * 1000; // 3分钟
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

function getRSS() {
  return process.memoryUsage().rss;
}

async function runStressTest(usePool) {
  console.log(`=== 3-Minute Stress Test ${usePool ? 'WITH Pool' : 'WITHOUT Pool'} ===\n`);
  
  const pool = usePool ? new BufferPool(100) : null;
  const rssStart = getRSS();
  let rssPeak = rssStart;
  let iterations = 0;
  const startTime = Date.now();
  
  console.log(`Start RSS: ${(rssStart / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Test duration: ${TEST_DURATION_MS / 1000}s`);
  console.log('Running...\n');
  
  const reportInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const currentRSS = getRSS();
    if (currentRSS > rssPeak) rssPeak = currentRSS;
    const progress = ((elapsed * 1000) / TEST_DURATION_MS * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${progress}% | RSS: ${(currentRSS / 1024 / 1024).toFixed(2)} MB | Iterations: ${iterations}`);
  }, 1000);
  
  while (Date.now() - startTime < TEST_DURATION_MS) {
    // Simulate chunk processing
    if (usePool && pool) {
      const buf = pool.acquire(CHUNK_SIZE);
      // Simulate processing
      for (let i = 0; i < CHUNK_SIZE; i += 1024) {
        buf[i] = i % 256;
      }
      pool.release(buf);
    } else {
      // Without pool - allocate new buffer each time
      const buf = Buffer.alloc(CHUNK_SIZE);
      for (let i = 0; i < CHUNK_SIZE; i += 1024) {
        buf[i] = i % 256;
      }
      // Buffer goes out of scope, GC will collect
    }
    
    iterations++;
    
    // Small delay to prevent complete CPU saturation
    if (iterations % 1000 === 0) {
      await new Promise(r => setTimeout(r, 1));
    }
  }
  
  clearInterval(reportInterval);
  
  // Force GC if available
  if (global.gc) {
    global.gc();
    await new Promise(r => setTimeout(r, 100));
  }
  
  const rssEnd = getRSS();
  const rssFluctuation = ((rssPeak - rssStart) / rssStart * 100);
  
  console.log('\n\n=== Results ===');
  console.log(`Iterations: ${iterations.toLocaleString()}`);
  console.log(`RSS Start:  ${(rssStart / 1024 / 1024).toFixed(2)} MB`);
  console.log(`RSS Peak:   ${(rssPeak / 1024 / 1024).toFixed(2)} MB`);
  console.log(`RSS End:    ${(rssEnd / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Fluctuation: ${rssFluctuation.toFixed(2)}%`);
  
  return {
    usePool,
    rssStart,
    rssPeak,
    rssEnd,
    rssFluctuation,
    iterations,
    pass: rssFluctuation < 10
  };
}

async function main() {
  const args = process.argv.slice(2);
  const usePool = args.includes('--pool');
  const noPool = args.includes('--no-pool');
  
  let result;
  
  if (usePool) {
    result = await runStressTest(true);
  } else if (noPool) {
    result = await runStressTest(false);
  } else {
    // Run both for comparison
    console.log('Running comparison test...\n');
    result = await runStressTest(true);
    console.log('\n' + '='.repeat(50) + '\n');
    const resultNoPool = await runStressTest(false);
    
    console.log('\n=== Comparison ===');
    console.log(`Pool RSS fluctuation:    ${result.rssFluctuation.toFixed(2)}%`);
    console.log(`No-Pool RSS fluctuation: ${resultNoPool.rssFluctuation.toFixed(2)}%`);
    console.log(`Memory saved: ${((resultNoPool.rssPeak - result.rssPeak) / 1024 / 1024).toFixed(2)} MB`);
    
    // Save report
    const fs = require('fs');
    const report = `# 3-Minute Pool Stress Test Report

## Test Environment
- Node.js: ${process.version}
- Platform: ${process.platform}
- Test Date: ${new Date().toISOString()}

## Test Configuration
- Duration: 3 minutes
- Chunk Size: ${CHUNK_SIZE / 1024} KB
- Pool Max Size: 100 buffers

## Results With Pool
- RSS Start: ${(result.rssStart / 1024 / 1024).toFixed(2)} MB
- RSS Peak: ${(result.rssPeak / 1024 / 1024).toFixed(2)} MB
- RSS End: ${(result.rssEnd / 1024 / 1024).toFixed(2)} MB
- Fluctuation: ${result.rssFluctuation.toFixed(2)}%
- Iterations: ${result.iterations.toLocaleString()}
- Status: ${result.pass ? '✅ PASS' : '❌ FAIL'}

## Results Without Pool
- RSS Start: ${(resultNoPool.rssStart / 1024 / 1024).toFixed(2)} MB
- RSS Peak: ${(resultNoPool.rssPeak / 1024 / 1024).toFixed(2)} MB
- RSS End: ${(resultNoPool.rssEnd / 1024 / 1024).toFixed(2)} MB
- Fluctuation: ${resultNoPool.rssFluctuation.toFixed(2)}%
- Iterations: ${resultNoPool.iterations.toLocaleString()}

## Conclusion
${result.pass ? '✅ **PASS**: RSS fluctuation < 10%' : '❌ **FAIL**: RSS fluctuation >= 10%'}

## Verification Command
\`\`\`bash
node tests/stress/3min-stress-pool.js --pool
\`\`\`
`;
    
    fs.writeFileSync(__dirname + '/3min-stress-pool.result.md', report);
    console.log('\n✅ Report saved to tests/stress/3min-stress-pool.result.md');
    
    process.exit(result.pass ? 0 : 1);
  }
  
  process.exit(result.pass ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
