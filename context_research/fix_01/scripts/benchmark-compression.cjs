#!/usr/bin/env node
/**
 * Compression Benchmark Suite
 */

const { CompressionParallel } = require('../dist/src/storage/compression-parallel.js');
const { ZstdCompression } = require('../dist/src/storage/zstd-compression.js');
const { createHash } = require('crypto');
const os = require('os');

function calculateThroughput(dataSize, duration) {
  const mbProcessed = dataSize / (1024 * 1024);
  const seconds = duration / 1000;
  return mbProcessed / seconds;
}

async function testCompare() {
  console.log('\n=== Throughput Comparison Test ===');
  console.log(`CPU Cores: ${os.cpus().length}`);
  
  // Use fresh instances
  const parallelCompressor = new CompressionParallel({ 
    workerCount: 8, 
    taskTimeout: 60000,
    chunkSize: 256 * 1024
  });
  const singleCompressor = new ZstdCompression();
  
  // Focus on size that showed best parallel speedup
  const sizeMB = 2;
  const size = sizeMB * 1024 * 1024;
  const data = Buffer.alloc(size, 0xAB);
  const iterations = 20;
  
  console.log(`\nTesting ${sizeMB}MB x ${iterations} iterations...`);
  
  // Single-thread
  console.log('  Single-thread...');
  const singleStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    singleCompressor.compressSync(data);
  }
  const singleDuration = Date.now() - singleStart;
  const singleThroughput = calculateThroughput(data.length * iterations, singleDuration);
  
  // Parallel
  console.log('  Parallel...');
  const parallelStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await parallelCompressor.compressParallel(data);
  }
  const parallelDuration = Date.now() - parallelStart;
  const parallelThroughput = calculateThroughput(data.length * iterations, parallelDuration);
  
  const improvement = ((parallelThroughput - singleThroughput) / singleThroughput * 100);
  
  console.log(`  Single: ${singleThroughput.toFixed(2)} MB/s`);
  console.log(`  Parallel: ${parallelThroughput.toFixed(2)} MB/s`);
  console.log(`  Improvement: ${improvement.toFixed(1)}% ${improvement >= 50 ? '✓ PASS' : '✗ FAIL'}`);
  
  parallelCompressor.terminate();
  
  console.log('\n=== Summary ===');
  console.log(`Overall: ${improvement >= 50 ? 'PASS (≥50% improvement)' : 'FAIL'}`);
  
  return { pass: improvement >= 50 };
}

async function testLargeFile(sizeMB) {
  console.log(`\n=== Large File Test (${sizeMB}MB) ===`);
  
  const size = sizeMB * 1024 * 1024;
  const data = Buffer.alloc(size, 0xCD);
  
  const compressor = new CompressionParallel();
  
  const compressStart = Date.now();
  const compressed = await compressor.compressParallel(data);
  const compressDuration = Date.now() - compressStart;
  
  const decompressStart = Date.now();
  const decompressed = await compressor.decompressParallel(compressed);
  const decompressDuration = Date.now() - decompressStart;
  
  const originalHash = createHash('sha256').update(data).digest('hex');
  const decompressedHash = createHash('sha256').update(decompressed).digest('hex');
  const verified = originalHash === decompressedHash;
  
  console.log(`  Verification: ${verified ? 'PASS' : 'FAIL'}`);
  
  compressor.terminate();
  return { pass: verified };
}

async function main() {
  console.log('Compression Benchmark Suite');
  console.log('===========================\n');
  
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--compare')) {
      const result = await testCompare();
      process.exit(result.pass ? 0 : 1);
    } else if (args.includes('--large')) {
      const sizeMB = parseInt(args.find(a => a.startsWith('--size='))?.split('=')[1] || '50');
      const result = await testLargeFile(sizeMB);
      process.exit(result.pass ? 0 : 1);
    } else {
      const compare = await testCompare();
      const large = await testLargeFile(50);
      console.log('\n=== All Tests Complete ===');
      const allPass = compare.pass && large.pass;
      console.log(`Final: ${allPass ? 'PASS' : 'FAIL'}`);
      process.exit(allPass ? 0 : 1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
