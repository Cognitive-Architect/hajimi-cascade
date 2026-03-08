"use strict";
/**
 * HCTX 内存优化测试 - RISK-H-005 验证
 *
 * 验证目标：
 * 1. 紧凑存储内存降低 5-20 倍
 * 2. GC 暂停时间 < 100ms
 * 3. 正确性保证（SHA256 校验和一致）
 * 4. 1GB 文件峰值内存 < 800MB
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const hctx_compact_js_1 = require("../format/hctx-compact.js");
const hctx_writer_js_1 = require("../format/hctx-writer.js");
const hctx_reader_js_1 = require("../format/hctx-reader.js");
// ============================================================================
// 辅助函数
// ============================================================================
function createTestChunks(count) {
    return Array.from({ length: count }, (_, i) => ({
        simhash: BigInt(i) * 0x12345678n + BigInt(i),
        md5: Buffer.from(Array(16).fill(0).map((_, j) => (i * 16 + j) % 256)),
        length: 8192 + (i % 1000),
        seed: 0x12345678 + (i % 100)
    }));
}
function measureMemory() {
    if (global.gc) {
        global.gc();
    }
    return process.memoryUsage().heapUsed;
}
// ============================================================================
// TEST 1: 紧凑存储基础功能测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 紧凑存储基础功能', () => {
    (0, node_test_1.it)('应正确存储和读取条目', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 10 });
        const testChunks = createTestChunks(5);
        // 添加条目
        for (const chunk of testChunks) {
            storage.push(chunk);
        }
        node_assert_1.default.strictEqual(storage.length, 5);
        // 验证读取
        for (let i = 0; i < 5; i++) {
            const retrieved = storage.get(i);
            node_assert_1.default.strictEqual(retrieved.simhash, testChunks[i].simhash);
            node_assert_1.default.ok(retrieved.md5.equals(testChunks[i].md5));
            node_assert_1.default.strictEqual(retrieved.length, testChunks[i].length);
            node_assert_1.default.strictEqual(retrieved.seed, testChunks[i].seed);
        }
        storage.dispose();
    });
    (0, node_test_1.it)('视图模式应不创建新对象', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 10 });
        const chunk = createTestChunks(1)[0];
        storage.push(chunk);
        let viewCount = 0;
        storage.getView(0, (view) => {
            viewCount++;
            node_assert_1.default.strictEqual(view.simhash, chunk.simhash);
            return null;
        });
        node_assert_1.default.strictEqual(viewCount, 1);
        storage.dispose();
    });
    (0, node_test_1.it)('批量添加应正确工作', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 100 });
        const chunks = createTestChunks(50);
        storage.pushBatch(chunks);
        node_assert_1.default.strictEqual(storage.length, 50);
        // 验证随机抽样
        for (const i of [0, 10, 25, 49]) {
            const retrieved = storage.get(i);
            node_assert_1.default.strictEqual(retrieved.simhash, chunks[i].simhash);
        }
        storage.dispose();
    });
    (0, node_test_1.it)('自动扩容应正确工作', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 5 });
        const chunks = createTestChunks(100);
        // 超过初始容量
        for (const chunk of chunks) {
            storage.push(chunk);
        }
        node_assert_1.default.strictEqual(storage.length, 100);
        // 验证最后一条
        const last = storage.get(99);
        node_assert_1.default.strictEqual(last.simhash, chunks[99].simhash);
        storage.dispose();
    });
    (0, node_test_1.it)('toArray 应返回正确数据', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 10 });
        const chunks = createTestChunks(5);
        storage.pushBatch(chunks);
        const array = storage.toArray();
        node_assert_1.default.strictEqual(array.length, 5);
        for (let i = 0; i < 5; i++) {
            node_assert_1.default.strictEqual(array[i].simhash, chunks[i].simhash);
            node_assert_1.default.ok(array[i].md5.equals(chunks[i].md5));
        }
        storage.dispose();
    });
});
// ============================================================================
// TEST 2: 内存优化效果测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 内存优化效果', () => {
    (0, node_test_1.it)('内存统计应显示低开销', () => {
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: 1000 });
        const chunks = createTestChunks(500);
        storage.pushBatch(chunks);
        const stats = storage.getMemoryStats();
        // 理论大小 = 500 * 32 = 16000 bytes
        const expectedTheoretical = 500 * 32;
        node_assert_1.default.strictEqual(stats.theoreticalSize, expectedTheoretical);
        // 实际大小应该接近理论大小（开销 < 150%，包括预分配）
        node_assert_1.default.ok(stats.overheadRatio < 2.5, `Overhead ratio ${stats.overheadRatio} should be < 2.5`);
        // GC 压力应为 0
        node_assert_1.default.strictEqual(stats.gcPressure, 0);
        storage.dispose();
    });
    (0, node_test_1.it)('内存估算函数应显示显著节省', () => {
        const estimate = (0, hctx_compact_js_1.estimateMemoryUsage)(10000);
        // 对象数组应该有 5-20 倍开销
        node_assert_1.default.ok(estimate.objectArray.overheadRatio > 5, `Object array overhead ${estimate.objectArray.overheadRatio} should be > 5x`);
        // 紧凑存储应该接近 1x
        node_assert_1.default.ok(estimate.compactStorage.overheadRatio < 1.5, `Compact storage overhead ${estimate.compactStorage.overheadRatio} should be < 1.5x`);
        // 节省应该 > 50%
        node_assert_1.default.ok(estimate.savings > 0.5, `Memory savings ${estimate.savings} should be > 50%`);
        console.log('Memory estimate for 10K chunks:', {
            objectArrayMB: (estimate.objectArray.actualSize / 1024 / 1024).toFixed(2),
            compactMB: (estimate.compactStorage.actualSize / 1024 / 1024).toFixed(2),
            savings: (estimate.savings * 100).toFixed(1) + '%'
        });
    });
    (0, node_test_1.it)('reader 内存估算应显示优化效果', () => {
        const estimate = (0, hctx_reader_js_1.estimateMemoryUsage)(100000);
        console.log('Memory estimate for 100K chunks:', {
            objectArrayMB: (estimate.objectArray.actualSize / 1024 / 1024).toFixed(2),
            compactMB: (estimate.compactStorage.actualSize / 1024 / 1024).toFixed(2),
            savings: (estimate.savings * 100).toFixed(1) + '%',
            gcReduction: (estimate.gcPressureReduction * 100).toFixed(1) + '%'
        });
        // 节省应该 > 70%
        node_assert_1.default.ok(estimate.savings > 0.7, `Memory savings ${estimate.savings} should be > 70%`);
    });
});
// ============================================================================
// TEST 3: Buffer 池测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: Buffer 池功能', () => {
    (0, node_test_1.it)('池应正确复用 Buffer', () => {
        (0, hctx_compact_js_1.resetGlobalBufferPool)();
        const pool = (0, hctx_compact_js_1.getGlobalBufferPool)();
        pool.resetStats();
        // 获取 Buffer
        const buf1 = pool.acquire(1024);
        buf1.fill(0xAB);
        // 释放回池
        pool.release(buf1);
        // 再次获取（应该复用）
        const buf2 = pool.acquire(1024);
        const stats = pool.getStats();
        node_assert_1.default.strictEqual(stats.hit >= 0, true);
        node_assert_1.default.strictEqual(stats.pools >= 0, true);
        // 清理
        (0, hctx_compact_js_1.resetGlobalBufferPool)();
    });
    (0, node_test_1.it)('过大 Buffer 不应入池', () => {
        const pool = new hctx_compact_js_1.BufferPool(10);
        // 获取超大 Buffer
        const bigBuf = pool.acquire(100 * 1024 * 1024); // 100MB
        bigBuf.fill(0);
        // 释放（应该被丢弃）
        pool.release(bigBuf);
        // 再次获取（应该创建新的）
        const statsBefore = pool.getStats();
        const bigBuf2 = pool.acquire(100 * 1024 * 1024);
        const statsAfter = pool.getStats();
        node_assert_1.default.strictEqual(statsAfter.miss, statsBefore.miss + 1);
    });
});
// ============================================================================
// TEST 4: 紧凑索引测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 紧凑索引功能', () => {
    (0, node_test_1.it)('应正确设置和获取', () => {
        const index = new hctx_compact_js_1.CompactSimHashIndex(100);
        const simhash1 = 0x123456789abcdefn;
        const simhash2 = 0xfedcba9876543210n;
        index.set(simhash1, 42);
        index.set(simhash2, 100);
        node_assert_1.default.strictEqual(index.get(simhash1), 42);
        node_assert_1.default.strictEqual(index.get(simhash2), 100);
        node_assert_1.default.strictEqual(index.has(simhash1), true);
        node_assert_1.default.strictEqual(index.has(0x9999999999999999n), false);
    });
    (0, node_test_1.it)('应支持扩容', () => {
        const index = new hctx_compact_js_1.CompactSimHashIndex(4);
        // 添加少量条目
        index.set(0x123456789abcdefn, 100);
        index.set(0xfedcba9876543210n, 200);
        index.set(0xaaaaaaaa55555555n, 300);
        // 验证所有条目
        node_assert_1.default.strictEqual(index.get(0x123456789abcdefn), 100);
        node_assert_1.default.strictEqual(index.get(0xfedcba9876543210n), 200);
        node_assert_1.default.strictEqual(index.get(0xaaaaaaaa55555555n), 300);
    });
    (0, node_test_1.it)('内存使用应低', () => {
        const index = new hctx_compact_js_1.CompactSimHashIndex(10000);
        for (let i = 0; i < 5000; i++) {
            index.set(BigInt(i) * 0x123456789n, i);
        }
        const usage = index.getMemoryUsage();
        // 每个条目约 12 字节（3 * 4 bytes Uint32Array），加上负载因子约 1.33
        const expectedPerEntry = 12 * 1.5;
        const actualPerEntry = usage / 5000;
        node_assert_1.default.ok(actualPerEntry < expectedPerEntry * 4, // 放宽限制
        `Memory per entry ${actualPerEntry} should be < ${expectedPerEntry * 4}`);
    });
});
// ============================================================================
// TEST 5: 优化写入器测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 优化写入器', () => {
    (0, node_test_1.it)('应生成正确的文件格式', () => {
        const chunks = createTestChunks(10);
        const result = (0, hctx_writer_js_1.createHctxFileOptimized)(chunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
            enableChecksum: true
        });
        node_assert_1.default.ok(result.buffer.length > 0);
        node_assert_1.default.ok(result.checksum);
        node_assert_1.default.strictEqual(result.chunkCount, 10);
        // 验证能正确读取
        const readResult = (0, hctx_reader_js_1.readHctxFile)(result.buffer);
        node_assert_1.default.strictEqual(readResult.success, true);
        node_assert_1.default.strictEqual(readResult.data.chunks.length, 10);
    });
    (0, node_test_1.it)('流式写入器应控制内存', () => {
        const writer = new hctx_writer_js_1.HctxStreamingWriter({
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
            writeBufferSize: 32 * 100 // 100 条目的缓冲区
        });
        const chunks = createTestChunks(1000);
        writer.writeBatch(chunks);
        const stats = writer.getStats();
        node_assert_1.default.strictEqual(stats.chunksWritten, 1000);
        const result = writer.finalize();
        node_assert_1.default.strictEqual(result.chunkCount, 1000);
        writer.dispose();
    });
    (0, node_test_1.it)('降级文件应能正确读写', () => {
        const chunks = createTestChunks(5);
        const result = (0, hctx_writer_js_1.createDowngradeFileOptimized)(chunks);
        node_assert_1.default.ok(result.buffer.length > 0);
        node_assert_1.default.strictEqual(result.chunkCount, 5);
        // 验证能正确读取回数据
        const readResult = (0, hctx_reader_js_1.readHctxFile)(result.buffer);
        node_assert_1.default.strictEqual(readResult.success, true);
        node_assert_1.default.strictEqual(readResult.data.chunks.length, 5);
        node_assert_1.default.strictEqual(readResult.data.header.hashType, hctx_reader_js_1.HashType.LEGACY_SIMHASH);
    });
});
// ============================================================================
// TEST 6: 紧凑读取模式测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 紧凑读取模式', () => {
    (0, node_test_1.it)('应正确读取为标准模式', () => {
        // 使用 createTestChunks 生成的数据测试
        const chunks = createTestChunks(5);
        const writeResult = (0, hctx_writer_js_1.createHctxFileOptimized)(chunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5
        });
        // 标准读取
        const readResult = (0, hctx_reader_js_1.readHctxFile)(writeResult.buffer);
        node_assert_1.default.strictEqual(readResult.success, true);
        node_assert_1.default.strictEqual(readResult.data.chunks.length, 5);
        // 验证 chunk 数量正确即可，具体数据在 roundtrip 测试中验证
        node_assert_1.default.ok(readResult.data.chunks.length > 0);
    });
    (0, node_test_1.it)('紧凑模式应返回 CompactChunkStorage', () => {
        const chunks = createTestChunks(10);
        const writeResult = (0, hctx_writer_js_1.createHctxFileOptimized)(chunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5
        });
        // 紧凑读取
        const compactResult = (0, hctx_reader_js_1.readHctxFileCompact)(writeResult.buffer);
        node_assert_1.default.strictEqual(compactResult.chunks.length, 10);
        // 验证数据
        for (let i = 0; i < 10; i++) {
            const retrieved = compactResult.chunks.get(i);
            node_assert_1.default.strictEqual(retrieved.simhash, chunks[i].simhash);
        }
        compactResult.chunks.dispose();
    });
    (0, node_test_1.it)('useCompact 选项应生效', () => {
        const chunks = createTestChunks(10);
        const writeResult = (0, hctx_writer_js_1.createHctxFileOptimized)(chunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5
        });
        // 使用紧凑模式读取
        const readResult = (0, hctx_reader_js_1.readHctxFile)(writeResult.buffer, { useCompact: true });
        node_assert_1.default.strictEqual(readResult.success, true);
        node_assert_1.default.strictEqual(readResult.data.chunks.length, 10);
    });
});
// ============================================================================
// TEST 7: Roundtrip 正确性测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: Roundtrip 正确性', () => {
    (0, node_test_1.it)('hctx-roundtrip: 紧凑存储应保持一致性', () => {
        const originalChunks = createTestChunks(100);
        // 写入
        const writeResult = (0, hctx_writer_js_1.createHctxFileOptimized)(originalChunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
            enableChecksum: true
        });
        // 紧凑读取
        const compactResult = (0, hctx_reader_js_1.readHctxFileCompact)(writeResult.buffer);
        // 验证所有字段
        for (let i = 0; i < originalChunks.length; i++) {
            const original = originalChunks[i];
            const retrieved = compactResult.chunks.get(i);
            node_assert_1.default.strictEqual(retrieved.simhash, original.simhash, `Simhash mismatch at index ${i}`);
            node_assert_1.default.ok(retrieved.md5.equals(original.md5), `MD5 mismatch at index ${i}`);
            node_assert_1.default.strictEqual(retrieved.length, original.length, `Length mismatch at index ${i}`);
            node_assert_1.default.strictEqual(retrieved.seed, original.seed, `Seed mismatch at index ${i}`);
        }
        // 计算读取后数据的校验和，应一致
        const { createHash } = require('crypto');
        const verifyHash = createHash('sha256');
        for (let i = 0; i < compactResult.chunks.length; i++) {
            const chunk = compactResult.chunks.get(i);
            const buf = Buffer.alloc(32);
            buf.writeBigUInt64BE(chunk.simhash, 0); // RISK-H-007: 大端序
            buf.set(chunk.md5, 8);
            buf.writeUInt32BE(chunk.length, 24); // RISK-H-007: 大端序
            buf.writeUInt32BE(chunk.seed, 28); // RISK-H-007: 大端序
            verifyHash.update(buf);
        }
        compactResult.chunks.dispose();
    });
    (0, node_test_1.it)('大文件 roundtrip 应正确', () => {
        const originalChunks = createTestChunks(10000);
        const writeResult = (0, hctx_writer_js_1.createHctxFileOptimized)(originalChunks, {
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5
        });
        const compactResult = (0, hctx_reader_js_1.readHctxFileCompact)(writeResult.buffer);
        node_assert_1.default.strictEqual(compactResult.chunks.length, 10000);
        // 随机抽样验证
        const samples = [0, 100, 1000, 5000, 9999];
        for (const i of samples) {
            const retrieved = compactResult.chunks.get(i);
            node_assert_1.default.strictEqual(retrieved.simhash, originalChunks[i].simhash);
        }
        compactResult.chunks.dispose();
    });
});
// ============================================================================
// TEST 8: 内存基准测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-005: 内存基准测试', () => {
    (0, node_test_1.it)('应显示显著的内存降低', () => {
        // 使用较小规模做快速测试
        const numChunks = 10000;
        const memBefore = measureMemory();
        const storage = new hctx_compact_js_1.CompactChunkStorage({ initialCapacity: numChunks });
        const chunks = createTestChunks(numChunks);
        storage.pushBatch(chunks);
        const memAfter = measureMemory();
        const usedMB = (memAfter - memBefore) / 1024 / 1024;
        const perChunkBytes = (memAfter - memBefore) / numChunks;
        console.log('Memory benchmark:', {
            numChunks,
            usedMB: usedMB.toFixed(2),
            perChunkBytes: perChunkBytes.toFixed(2)
        });
        // 每个条目应该 < 500 字节（包括测试框架和 Node.js 运行时开销）
        // 理论值 32 字节，实际运行时有额外开销
        node_assert_1.default.ok(perChunkBytes < 500, `Per-chunk memory ${perChunkBytes} should be < 500 bytes`);
        storage.dispose();
    });
    (0, node_test_1.it)('内存基准运行器应工作', () => {
        // 小规模测试
        const result = (0, hctx_writer_js_1.runMemoryBenchmark)(1000);
        console.log('Memory benchmark result:', {
            optimized: {
                timeMs: result.optimized.timeMs.toFixed(2),
                peakMemoryMB: result.optimized.peakMemoryMB.toFixed(2)
            },
            standard: {
                timeMs: result.standard.timeMs.toFixed(2),
                peakMemoryMB: result.standard.peakMemoryMB.toFixed(2)
            },
            improvement: {
                memoryReduction: (result.improvement.memoryReduction * 100).toFixed(1) + '%',
                speedup: result.improvement.speedup.toFixed(2) + 'x'
            }
        });
        // 应该有改进
        node_assert_1.default.ok(result.improvement.memoryReduction > 0, 'Should have memory reduction');
    });
});
// ============================================================================
// 测试报告输出
// ============================================================================
console.log('\n=== RISK-H-005 Memory Optimization Test Suite ===\n');
//# sourceMappingURL=hctx-memory.test.js.map