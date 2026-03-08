"use strict";
/**
 * SimHash LSH Index 测试套件
 *
 * 测试目标：
 * 1. lsh-index: 单条目候选检索次数 < 100（对比原2081）
 * 2. no-false-negative: 100%相似块被检出（假阴性率 = 0%）
 * 3. API 存在性验证
 * 4. 性能基准测试
 *
 * @module simhash-lsh-index.test
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const simhash_lsh_index_js_1 = require("../cdc/simhash-lsh-index.js");
const simhash_chunker_js_1 = require("../cdc/simhash-chunker.js");
const crypto_1 = require("crypto");
// ============================================================================
// 测试辅助函数
// ============================================================================
/**
 * 生成指定汉明距离的 SimHash
 *
 * @param base - 基础 SimHash
 * @param distance - 目标汉明距离
 * @returns 具有指定距离的 SimHash
 */
function generateSimHashWithDistance(base, distance) {
    let result = base;
    const flipped = new Set();
    while (flipped.size < distance) {
        const bit = (0, crypto_1.randomInt)(0, 64);
        if (!flipped.has(bit)) {
            flipped.add(bit);
            result ^= (1n << BigInt(bit));
        }
    }
    return result & simhash_chunker_js_1.UINT64_MASK;
}
/**
 * 创建测试用的 ChunkHashV2
 *
 * @param simhash - SimHash 值
 * @param id - 用于生成唯一 MD5 的 ID
 * @returns ChunkHashV2 对象
 */
function createTestChunk(simhash, id = 0) {
    // 使用 ID 生成唯一的 MD5（16字节）
    const md5 = Buffer.alloc(16);
    md5.writeUInt32BE(id, 0); // RISK-H-007: 大端序
    md5.writeUInt32BE(id >>> 32, 4); // RISK-H-007: 大端序
    return {
        simhash,
        md5,
        length: 1024,
        seed: 0x12345678
    };
}
/**
 * 生成随机 SimHash 数组
 *
 * @param count - 数量
 * @returns SimHash 数组
 */
function generateRandomSimHashes(count) {
    return Array.from({ length: count }, () => (0, simhash_chunker_js_1.randomSimHash)());
}
// ============================================================================
// 测试套件
// ============================================================================
(0, node_test_1.describe)('simhash-lsh-index', () => {
    // --------------------------------------------------------------------------
    // 测试 1: 基础功能测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('basic functionality', () => {
        let index;
        (0, node_test_1.beforeEach)(() => {
            index = (0, simhash_lsh_index_js_1.createIndex)();
        });
        (0, node_test_1.it)('should create empty index', () => {
            node_assert_1.default.strictEqual(index.size(), 0);
        });
        (0, node_test_1.it)('should add chunk and return id', () => {
            const chunk = createTestChunk(0x123456789abcdef0n);
            const id = index.add(chunk);
            node_assert_1.default.strictEqual(id, 0);
            node_assert_1.default.strictEqual(index.size(), 1);
        });
        (0, node_test_1.it)('should add multiple chunks with incrementing ids', () => {
            const chunk1 = createTestChunk(0x1111111111111111n, 1);
            const chunk2 = createTestChunk(0x2222222222222222n, 2);
            const id1 = index.add(chunk1);
            const id2 = index.add(chunk2);
            node_assert_1.default.strictEqual(id1, 0);
            node_assert_1.default.strictEqual(id2, 1);
            node_assert_1.default.strictEqual(index.size(), 2);
        });
        (0, node_test_1.it)('should retrieve chunk by id', () => {
            const simhash = 0xabcdef1234567890n;
            const chunk = createTestChunk(simhash, 42);
            const id = index.add(chunk);
            const retrieved = index.getChunk(id);
            node_assert_1.default.ok(retrieved);
            node_assert_1.default.strictEqual(retrieved.simhash, simhash);
        });
        (0, node_test_1.it)('should return undefined for non-existent chunk', () => {
            node_assert_1.default.strictEqual(index.getChunk(999), undefined);
        });
        (0, node_test_1.it)('should clear all data', () => {
            index.add(createTestChunk(0x1111n, 1));
            index.add(createTestChunk(0x2222n, 2));
            index.clear();
            node_assert_1.default.strictEqual(index.size(), 0);
            node_assert_1.default.strictEqual(index.getChunk(0), undefined);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 2: lookup计数测试（核心性能指标）
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('lsh-index lookup count', () => {
        (0, node_test_1.it)('should have lookups < 100 per query (vs naive 2081)', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const stats = { lookups: 0, candidateCount: 0, popcntChecks: 0, durationMs: 0 };
            // 添加 1000 个随机 chunks
            const chunks = generateRandomSimHashes(1000).map((hash, i) => createTestChunk(hash, i));
            index.addBatch(chunks);
            // 执行 100 次随机查询
            let maxLookups = 0;
            let totalLookups = 0;
            for (let i = 0; i < 100; i++) {
                const queryStats = { lookups: 0, candidateCount: 0, popcntChecks: 0, durationMs: 0 };
                const queryHash = (0, simhash_chunker_js_1.randomSimHash)();
                index.query(queryHash, simhash_chunker_js_1.HAMMING_THRESHOLD, queryStats);
                maxLookups = Math.max(maxLookups, queryStats.lookups);
                totalLookups += queryStats.lookups;
            }
            const avgLookups = totalLookups / 100;
            // 断言：单查询 lookup 次数应 <= 4（段数），远低于 2081
            node_assert_1.default.ok(maxLookups <= 4, `Max lookups ${maxLookups} should be <= 4 (vs naive 2081)`);
            node_assert_1.default.ok(avgLookups <= 4, `Avg lookups ${avgLookups} should be <= 4`);
            console.log(`  Lookup stats: max=${maxLookups}, avg=${avgLookups.toFixed(2)} (vs naive 2081)`);
            console.log(`  Speedup: ${(2081 / avgLookups).toFixed(0)}x`);
        });
        (0, node_test_1.it)('should demonstrate 8-segment config has lookups <= 8', () => {
            const index = new simhash_lsh_index_js_1.LshIndex(simhash_lsh_index_js_1.LSH_CONFIG_8SEG);
            // 添加测试数据
            const chunks = generateRandomSimHashes(500).map((hash, i) => createTestChunk(hash, i));
            index.addBatch(chunks);
            const queryStats = { lookups: 0, candidateCount: 0, popcntChecks: 0, durationMs: 0 };
            index.query((0, simhash_chunker_js_1.randomSimHash)(), simhash_chunker_js_1.HAMMING_THRESHOLD, queryStats);
            // 8段配置应该有 <= 8 次 lookups
            node_assert_1.default.ok(queryStats.lookups <= 8, `8-segment lookups ${queryStats.lookups} should be <= 8`);
            console.log(`  8-segment lookup count: ${queryStats.lookups}`);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 3: 正确性测试（无假阴性）
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('no-false-negative', () => {
        (0, node_test_1.it)('should detect identical simhash (distance = 0)', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const simhash = 0x123456789abcdef0n;
            const chunk = createTestChunk(simhash, 1);
            index.add(chunk);
            const results = index.query(simhash);
            node_assert_1.default.strictEqual(results.length, 1);
            node_assert_1.default.strictEqual(results[0].distance, 0);
        });
        (0, node_test_1.it)('should detect distance = 1 neighbors', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const baseHash = 0xaaaaaaaa55555555n;
            // 添加基础 chunk
            index.add(createTestChunk(baseHash, 1));
            // 生成距离为1的 simhash
            const neighbor1 = baseHash ^ (1n << 5n);
            // 查询邻居
            const results = index.query(neighbor1);
            node_assert_1.default.ok(results.length >= 1, 'Should find at least the similar chunk');
            node_assert_1.default.ok(results.some(r => r.distance === 1), 'Should find distance=1 match');
        });
        (0, node_test_1.it)('should detect distance = 2 neighbors', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const baseHash = 0xf0f0f0f00f0f0f0fn;
            index.add(createTestChunk(baseHash, 1));
            // 生成距离为2的 simhash
            const neighbor2 = baseHash ^ (1n << 10n) ^ (1n << 20n);
            const results = index.query(neighbor2);
            node_assert_1.default.ok(results.length >= 1, 'Should find similar chunks');
            node_assert_1.default.ok(results.some(r => r.distance === 2), 'Should find distance=2 match');
        });
        (0, node_test_1.it)('should NOT miss any similar chunk (exhaustive test)', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const baseHash = 0x123456789abcdef0n;
            // 添加基础 chunk
            index.add(createTestChunk(baseHash, 0));
            // 测试所有距离 < 3 的情况
            let falseNegatives = 0;
            let totalTests = 0;
            // 距离 0（完全匹配）
            totalTests++;
            const results0 = index.query(baseHash);
            if (!results0.some(r => r.distance === 0)) {
                falseNegatives++;
            }
            // 距离 1（所有单 bit 翻转）
            for (let bit = 0; bit < 64; bit++) {
                totalTests++;
                const neighbor = baseHash ^ (1n << BigInt(bit));
                const results = index.query(neighbor);
                if (!results.some(r => r.distance === 1)) {
                    falseNegatives++;
                    if (falseNegatives <= 3) {
                        console.log(`  False negative at bit ${bit}`);
                    }
                }
            }
            // 距离 2（抽样测试，因为 C(64,2) = 2016）
            const testedPairs = new Set();
            for (let i = 0; i < 200; i++) {
                let bit1, bit2;
                do {
                    bit1 = (0, crypto_1.randomInt)(0, 64);
                    bit2 = (0, crypto_1.randomInt)(0, 64);
                } while (bit1 === bit2 || testedPairs.has(`${bit1},${bit2}`));
                testedPairs.add(`${bit1},${bit2}`);
                totalTests++;
                const neighbor = baseHash ^ (1n << BigInt(bit1)) ^ (1n << BigInt(bit2));
                const results = index.query(neighbor);
                if (!results.some(r => r.distance === 2)) {
                    falseNegatives++;
                }
            }
            node_assert_1.default.strictEqual(falseNegatives, 0, `Found ${falseNegatives} false negatives out of ${totalTests} tests`);
            console.log(`  Exhaustive test: ${totalTests} cases, ${falseNegatives} false negatives`);
        });
        (0, node_test_1.it)('should verify LSH mathematical guarantee', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const baseHash = 0xaaaaaaaa55555555n;
            // 测试多组相似 chunk
            const testCases = [
                { distance: 0, count: 1 },
                { distance: 1, count: 10 },
                { distance: 2, count: 20 }
            ];
            for (const { distance, count } of testCases) {
                for (let i = 0; i < count; i++) {
                    const simhash = generateSimHashWithDistance(baseHash, distance);
                    const chunk = createTestChunk(simhash, i);
                    index.add(chunk);
                    // 验证 LSH 保证
                    node_assert_1.default.ok(index.verifyLshGuarantee(baseHash, simhash), `LSH guarantee should hold for distance ${distance}`);
                }
            }
            // 查询并验证所有相似项都被找到
            const results = index.query(baseHash, simhash_chunker_js_1.HAMMING_THRESHOLD);
            node_assert_1.default.strictEqual(results.length, 31, 'Should find all 31 similar chunks (1+10+20)');
            const dist0 = results.filter(r => r.distance === 0).length;
            const dist1 = results.filter(r => r.distance === 1).length;
            const dist2 = results.filter(r => r.distance === 2).length;
            node_assert_1.default.strictEqual(dist0, 1);
            node_assert_1.default.strictEqual(dist1, 10);
            node_assert_1.default.strictEqual(dist2, 20);
            console.log(`  Found: ${dist0} exact, ${dist1} dist-1, ${dist2} dist-2 matches`);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 4: 段分割测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('segment splitting', () => {
        (0, node_test_1.it)('should correctly split into 4 segments of 16 bits', () => {
            const simhash = 0x123456789abcdef0n;
            const segments = (0, simhash_lsh_index_js_1.splitInto4Segments)(simhash);
            node_assert_1.default.strictEqual(segments.length, 4);
            node_assert_1.default.strictEqual(segments[0], 0x1234); // bits 63-48
            node_assert_1.default.strictEqual(segments[1], 0x5678); // bits 47-32
            node_assert_1.default.strictEqual(segments[2], 0x9ABC); // bits 31-16
            node_assert_1.default.strictEqual(segments[3], 0xDEF0); // bits 15-0
        });
        (0, node_test_1.it)('should correctly split into 8 segments of 8 bits', () => {
            const simhash = 0x123456789abcdef0n;
            const segments = (0, simhash_lsh_index_js_1.splitInto8Segments)(simhash);
            node_assert_1.default.strictEqual(segments.length, 8);
            node_assert_1.default.strictEqual(segments[0], 0x12);
            node_assert_1.default.strictEqual(segments[1], 0x34);
            node_assert_1.default.strictEqual(segments[2], 0x56);
            node_assert_1.default.strictEqual(segments[3], 0x78);
            node_assert_1.default.strictEqual(segments[4], 0x9A);
            node_assert_1.default.strictEqual(segments[5], 0xBC);
            node_assert_1.default.strictEqual(segments[6], 0xDE);
            node_assert_1.default.strictEqual(segments[7], 0xF0);
        });
        (0, node_test_1.it)('should handle edge case: all zeros', () => {
            const segments = (0, simhash_lsh_index_js_1.splitInto4Segments)(0n);
            node_assert_1.default.deepStrictEqual(segments, [0, 0, 0, 0]);
        });
        (0, node_test_1.it)('should handle edge case: all ones', () => {
            const segments = (0, simhash_lsh_index_js_1.splitInto4Segments)(simhash_chunker_js_1.UINT64_MASK);
            node_assert_1.default.deepStrictEqual(segments, [0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
        });
        (0, node_test_1.it)('splitIntoSegments should match splitInto4Segments', () => {
            const simhash = (0, simhash_chunker_js_1.randomSimHash)();
            const generic = (0, simhash_lsh_index_js_1.splitIntoSegments)(simhash, 4, 16);
            const fast = (0, simhash_lsh_index_js_1.splitInto4Segments)(simhash);
            node_assert_1.default.deepStrictEqual(generic, Array.from(fast));
        });
    });
    // --------------------------------------------------------------------------
    // 测试 5: 性能基准测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('performance benchmarks', () => {
        (0, node_test_1.it)('should handle 10K chunks efficiently', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const chunkCount = 10000;
            // 批量添加
            const startAdd = performance.now();
            const chunks = generateRandomSimHashes(chunkCount).map((hash, i) => createTestChunk(hash, i));
            index.addBatch(chunks);
            const addTime = performance.now() - startAdd;
            // 批量查询
            const queryCount = 1000;
            const startQuery = performance.now();
            for (let i = 0; i < queryCount; i++) {
                index.query((0, simhash_chunker_js_1.randomSimHash)());
            }
            const queryTime = performance.now() - startQuery;
            const avgQueryTime = queryTime / queryCount;
            console.log(`  10K chunks: add=${addTime.toFixed(2)}ms, ` +
                `query avg=${avgQueryTime.toFixed(3)}ms`);
            // 断言性能在合理范围内
            node_assert_1.default.ok(avgQueryTime < 10, `Avg query time ${avgQueryTime}ms should be < 10ms`);
        });
        (0, node_test_1.it)('should demonstrate TB-scale speedup', () => {
            const comparison = (0, simhash_lsh_index_js_1.compareLookupComplexity)(1e8); // 100M chunks ~ 100GB
            console.log(`  TB-scale lookup comparison:`);
            console.log(`    Naive: ${comparison.naive.toExponential(2)} lookups`);
            console.log(`    LSH-4: ${comparison.lsh4.toExponential(2)} lookups`);
            console.log(`    Speedup: ${comparison.speedup4.toFixed(0)}x`);
            node_assert_1.default.strictEqual(comparison.speedup4, 2081 / 4);
            node_assert_1.default.strictEqual(comparison.speedup8, 2081 / 8);
        });
        (0, node_test_1.it)('should estimate processing time under 10 minutes for 1TB', () => {
            const estimate = (0, simhash_lsh_index_js_1.estimateProcessingTime)(1, 1024, 100);
            console.log(`  1TB processing estimate:`);
            console.log(`    Total chunks: ${estimate.totalChunks.toExponential(2)}`);
            console.log(`    Naive time: ${estimate.naiveMinutes.toFixed(1)} minutes`);
            console.log(`    LSH time: ${estimate.lshMinutes.toFixed(1)} minutes`);
            console.log(`    Speedup: ${estimate.speedup.toFixed(0)}x`);
            // 断言：LSH 处理时间 < 10 分钟
            node_assert_1.default.ok(estimate.lshMinutes < 10, `LSH processing time ${estimate.lshMinutes.toFixed(1)}min should be < 10min`);
            // 断言：比朴素方法快 75 倍以上
            node_assert_1.default.ok(estimate.speedup >= 75, `Speedup ${estimate.speedup} should be >= 75x`);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 6: 统计信息测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('statistics', () => {
        (0, node_test_1.it)('should provide accurate index stats', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            // 添加 1000 个随机 chunks
            const chunks = generateRandomSimHashes(1000).map((hash, i) => createTestChunk(hash, i));
            index.addBatch(chunks);
            const stats = index.getStats();
            node_assert_1.default.strictEqual(stats.totalEntries, 1000);
            node_assert_1.default.strictEqual(stats.segments.length, 4);
            // 每段应该有接近 2^16 = 65536 个可能的 key
            // 1000 个随机值应该分布在不同的 bucket 中
            for (const seg of stats.segments) {
                node_assert_1.default.ok(seg.uniqueKeys > 0);
                node_assert_1.default.ok(seg.avgBucketSize > 0);
                node_assert_1.default.ok(seg.maxBucketSize >= seg.avgBucketSize);
            }
            console.log(`  Index stats: ${stats.totalEntries} entries`);
            console.log(`  Memory estimate: ${(stats.estimatedMemoryBytes / 1024 / 1024).toFixed(2)} MB`);
        });
        (0, node_test_1.it)('should track query statistics', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            // 添加测试数据
            index.addBatch(generateRandomSimHashes(100).map((hash, i) => createTestChunk(hash, i)));
            // 执行查询
            for (let i = 0; i < 10; i++) {
                index.query((0, simhash_chunker_js_1.randomSimHash)());
            }
            const queryStats = index.getQueryStats();
            node_assert_1.default.strictEqual(queryStats.totalQueries, 10);
            node_assert_1.default.ok(queryStats.avgLookupsPerQuery <= 4);
            console.log(`  Query stats: ${queryStats.totalQueries} queries, ` +
                `${queryStats.avgLookupsPerQuery} avg lookups`);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 7: 边界情况测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('edge cases', () => {
        (0, node_test_1.it)('should handle empty index query', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const results = index.query((0, simhash_chunker_js_1.randomSimHash)());
            node_assert_1.default.deepStrictEqual(results, []);
        });
        (0, node_test_1.it)('should handle query with no matches', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            // 添加一些 chunks
            index.add(createTestChunk(0x0000000000000000n, 1));
            index.add(createTestChunk(0x1111111111111111n, 2));
            // 查询完全不同的 simhash（距离应该 > 3）
            const distantHash = 0xffffffffffffffffn;
            const results = index.query(distantHash);
            // 可能返回候选，但距离应该都 >= 3
            node_assert_1.default.ok(results.length === 0 || results.every(r => r.distance >= 3));
        });
        (0, node_test_1.it)('should handle batch add with empty array', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const ids = index.addBatch([]);
            node_assert_1.default.deepStrictEqual(ids, []);
            node_assert_1.default.strictEqual(index.size(), 0);
        });
        (0, node_test_1.it)('should work with 8-segment configuration', () => {
            const index = new simhash_lsh_index_js_1.LshIndex(simhash_lsh_index_js_1.LSH_CONFIG_8SEG);
            const chunk = createTestChunk(0x123456789abcdef0n, 1);
            const id = index.add(chunk);
            const results = index.query(chunk.simhash);
            node_assert_1.default.strictEqual(results.length, 1);
            node_assert_1.default.strictEqual(results[0].distance, 0);
        });
        (0, node_test_1.it)('should handle hasSimilar correctly', () => {
            const index = (0, simhash_lsh_index_js_1.createIndex)();
            const simhash = 0xaaaaaaaa55555555n;
            index.add(createTestChunk(simhash, 1));
            node_assert_1.default.ok(index.hasSimilar(simhash));
            // 距离为 1 的应该也相似
            const similar = simhash ^ (1n << 10n);
            node_assert_1.default.ok(index.hasSimilar(similar));
            // 完全不同的应该不相似（概率极高）
            const different = 0x55555555aaaaaaaan;
            node_assert_1.default.ok(!index.hasSimilar(different) || (0, simhash_chunker_js_1.hammingDistance)(simhash, different) < 3);
        });
    });
    // --------------------------------------------------------------------------
    // 测试 8: 内存优化版测试
    // --------------------------------------------------------------------------
    (0, node_test_1.describe)('memory optimized index', () => {
        (0, node_test_1.it)('should create memory optimized index', () => {
            const index = (0, simhash_lsh_index_js_1.createMemoryOptimizedIndex)();
            const chunk = createTestChunk(0x123456789abcdef0n, 1);
            const id = index.add(chunk);
            node_assert_1.default.strictEqual(id, 0);
            node_assert_1.default.strictEqual(index.size(), 1);
            const results = index.query(chunk.simhash);
            node_assert_1.default.strictEqual(results.length, 1);
        });
    });
});
// ============================================================================
// 单独测试：API 存在性验证
// ============================================================================
(0, node_test_1.describe)('API exports', () => {
    (0, node_test_1.it)('should export all required functions and classes', () => {
        node_assert_1.default.ok(simhash_lsh_index_js_1.LshIndex, 'LshIndex class should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.createIndex, 'createIndex function should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.createMemoryOptimizedIndex, 'createMemoryOptimizedIndex should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.splitIntoSegments, 'splitIntoSegments should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.splitInto4Segments, 'splitInto4Segments should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.splitInto8Segments, 'splitInto8Segments should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.compareLookupComplexity, 'compareLookupComplexity should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.estimateProcessingTime, 'estimateProcessingTime should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.DEFAULT_LSH_CONFIG, 'DEFAULT_LSH_CONFIG should be exported');
        node_assert_1.default.ok(simhash_lsh_index_js_1.LSH_CONFIG_8SEG, 'LSH_CONFIG_8SEG should be exported');
    });
    (0, node_test_1.it)('should have correct LshIndex methods', () => {
        const index = (0, simhash_lsh_index_js_1.createIndex)();
        node_assert_1.default.strictEqual(typeof index.add, 'function');
        node_assert_1.default.strictEqual(typeof index.addBatch, 'function');
        node_assert_1.default.strictEqual(typeof index.query, 'function');
        node_assert_1.default.strictEqual(typeof index.hasSimilar, 'function');
        node_assert_1.default.strictEqual(typeof index.getChunk, 'function');
        node_assert_1.default.strictEqual(typeof index.size, 'function');
        node_assert_1.default.strictEqual(typeof index.getStats, 'function');
        node_assert_1.default.strictEqual(typeof index.getQueryStats, 'function');
        node_assert_1.default.strictEqual(typeof index.clear, 'function');
        node_assert_1.default.strictEqual(typeof index.verifyLshGuarantee, 'function');
    });
});
// 测试完成标记
console.log('SimHash LSH Index test suite loaded');
//# sourceMappingURL=simhash-lsh-index.test.js.map