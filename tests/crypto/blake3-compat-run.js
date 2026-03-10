/**
 * blake3-compat-run.js - BLAKE3兼容性手动测试
 * 验证与标准b3sum输出一致
 */

const { hash, createHasher } = require('blake3-jit');

class Blake3Wrapper {
  constructor() {
    this.reset();
  }

  reset() {
    this.hasher = undefined;
  }

  update(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!this.hasher) {
      this.hasher = createHasher();
    }
    this.hasher.update(buf);
    return this;
  }

  digest() {
    if (!this.hasher) {
      return Buffer.from(hash(Buffer.alloc(0)));
    }
    return Buffer.from(this.hasher.finalize());
  }

  digestHex() {
    return this.digest().toString('hex');
  }

  static hash(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.from(hash(buf));
  }

  static hashHex(data) {
    return Blake3Wrapper.hash(data).toString('hex');
  }
}

function blake3HashHex(data) {
  return Blake3Wrapper.hashHex(data);
}

// 测试向量
const testVectors = [
  { input: '', name: 'empty' },
  { input: 'hello', name: 'hello' },
  { input: 'hello world', name: 'hello world' },
  { input: 'The quick brown fox jumps over the lazy dog', name: 'fox' },
];

console.log('=== BLAKE3 Compatibility Tests ===\n');

// 1. 标准测试向量
console.log('1. Standard test vectors:');
for (const { input, name } of testVectors) {
  const result = blake3HashHex(input);
  console.log(`   ${name}: ${result.substring(0, 32)}...`);
}

// 2. 增量更新测试
console.log('\n2. Incremental update test:');
const w1 = new Blake3Wrapper();
w1.update('hello').update(' ').update('world');
const incremental = w1.digestHex();
const oneshot = blake3HashHex('hello world');
console.log(`   Incremental: ${incremental}`);
console.log(`   One-shot:    ${oneshot}`);
console.log(`   Match: ${incremental === oneshot ? '✅ PASS' : '❌ FAIL'}`);

// 3. Buffer输入测试
console.log('\n3. Buffer input test:');
const buf = Buffer.from('test data');
const r1 = Blake3Wrapper.hashHex(buf);
const r2 = blake3HashHex('test data');
console.log(`   Match: ${r1 === r2 ? '✅ PASS' : '❌ FAIL'}`);

// 4. 输出长度验证
console.log('\n4. Output length verification:');
const hashResult = Blake3Wrapper.hash('test');
console.log(`   Output length: ${hashResult.length} bytes (expected: 32)`);
console.log(`   ${hashResult.length === 32 ? '✅ PASS' : '❌ FAIL'}`);

// 5. 性能对比 (简单测试)
console.log('\n5. Simple performance test:');
const start = Date.now();
for (let i = 0; i < 10000; i++) {
  blake3HashHex(`test data ${i}`);
}
const elapsed = Date.now() - start;
console.log(`   10,000 hashes in ${elapsed}ms (${(10000/elapsed).toFixed(0)} ops/ms)`);

console.log('\n=== All BLAKE3 tests completed ===');
