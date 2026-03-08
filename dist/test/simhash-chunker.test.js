"use strict";
/**
 * SimHash Chunker 测试
 *
 * 验证 RISK-H-001 修复：BigInt 全程化
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const simhash_chunker_js_1 = require("../cdc/simhash-chunker.js");
// ============================================================================
// RISK-H-001: BigInt 全程化测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-001: BigInt 全程化修复', () => {
    (0, node_test_1.describe)('popcnt64 - 64 位汉明权重计算', () => {
        (0, node_test_1.it)('应正确计算 0n 的 popcount', () => {
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(0n), 0);
        });
        (0, node_test_1.it)('应正确计算 64 位全 1 的 popcount', () => {
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(simhash_chunker_js_1.UINT64_MASK), 64);
        });
        (0, node_test_1.it)('应正确计算单个位为 1 的值', () => {
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(1n), 1);
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(1n << 63n), 1);
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(1n << 32n), 1);
        });
        (0, node_test_1.it)('应正确处理高 32 位和低 32 位混合的值', () => {
            // 高 32 位有 16 个 1 (0xFFFF0000)，低 32 位有 16 个 1 (0xFF00FF00)
            // 总计 32 个 1
            const hi = 0xffff0000n << 32n; // 高 32 位
            const lo = 0xff00ff00n; // 低 32 位
            const value = (hi | lo) & simhash_chunker_js_1.UINT64_MASK;
            // 0xFFFF0000 有 16 个 1
            // 0xFF00FF00 有 16 个 1
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(value), 32);
        });
        (0, node_test_1.it)('应自动截断超出 64 位的值', () => {
            const value = simhash_chunker_js_1.UINT64_MASK | (1n << 100n);
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.popcnt64)(value), 64);
        });
    });
    (0, node_test_1.describe)('hammingDistance - 汉明距离计算', () => {
        (0, node_test_1.it)('相同值的汉明距离应为 0', () => {
            const a = 0x123456789abcdef0n;
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.hammingDistance)(a, a), 0);
        });
        (0, node_test_1.it)('相差 1 位的值汉明距离应为 1', () => {
            const a = 0n;
            const b = 1n;
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.hammingDistance)(a, b), 1);
        });
        (0, node_test_1.it)('相差 3 位的值汉明距离应为 3', () => {
            const a = 0n;
            const b = 7n;
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.hammingDistance)(a, b), 3);
        });
        (0, node_test_1.it)('互补值的汉明距离应为 64', () => {
            const a = 0n;
            const b = simhash_chunker_js_1.UINT64_MASK;
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.hammingDistance)(a, b), 64);
        });
        (0, node_test_1.it)('应正确处理高位差异', () => {
            const a = 0n;
            const b = 1n << 63n;
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.hammingDistance)(a, b), 1);
        });
    });
    (0, node_test_1.describe)('isSimilar - 相似性判断', () => {
        (0, node_test_1.it)('汉明距离小于阈值应判定为相似', () => {
            const a = 0n;
            const b = 3n; // distance = 2
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.isSimilar)(a, b), true);
        });
        (0, node_test_1.it)('汉明距离等于阈值应判定为不相似', () => {
            const a = 0n;
            const b = 7n; // distance = 3
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.isSimilar)(a, b), false);
        });
        (0, node_test_1.it)('汉明距离大于阈值应判定为不相似', () => {
            const a = 0n;
            const b = 15n; // distance = 4
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.isSimilar)(a, b), false);
        });
        (0, node_test_1.it)('应支持自定义阈值', () => {
            const a = 0n;
            const b = 15n; // distance = 4
            node_assert_1.default.strictEqual((0, simhash_chunker_js_1.isSimilar)(a, b, 5), true);
        });
    });
    (0, node_test_1.describe)('assertSimHashType - 类型断言（CI 门禁）', () => {
        (0, node_test_1.it)('应接受有效的 bigint', () => {
            node_assert_1.default.doesNotThrow(() => (0, simhash_chunker_js_1.assertSimHashType)(0n));
            node_assert_1.default.doesNotThrow(() => (0, simhash_chunker_js_1.assertSimHashType)(simhash_chunker_js_1.UINT64_MASK));
        });
        (0, node_test_1.it)('应拒绝 Number 类型（RISK-H-001 关键断言）', () => {
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.assertSimHashType)(123), /RISK-H-001 VIOLATION/);
        });
        (0, node_test_1.it)('应拒绝 string 类型', () => {
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.assertSimHashType)('123'), /RISK-H-001 VIOLATION/);
        });
        (0, node_test_1.it)('应拒绝超出 uint64 范围的 bigint', () => {
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.assertSimHashType)(-1n), /out of uint64 range/);
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.assertSimHashType)(simhash_chunker_js_1.UINT64_MASK + 1n), /out of uint64 range/);
        });
    });
});
// ============================================================================
// 序列化/反序列化测试 - BigInt 全程化
// ============================================================================
(0, node_test_1.describe)('序列化/反序列化 - BigInt 全程化', () => {
    (0, node_test_1.describe)('ChunkHashV2', () => {
        const sampleChunk = {
            simhash: 0x123456789abcdef0n,
            md5: Buffer.from('0123456789ABCDEF0123456789ABCDEF', 'hex'),
            length: 8192,
            seed: 0xDEADBEEF
        };
        (0, node_test_1.it)('应正确序列化为 32 字节 Buffer', () => {
            const buf = (0, simhash_chunker_js_1.serializeChunkHashV2)(sampleChunk);
            node_assert_1.default.strictEqual(buf.length, 32);
        });
        (0, node_test_1.it)('反序列化应保持 simhash 为 bigint（RISK-H-001 关键）', () => {
            const buf = (0, simhash_chunker_js_1.serializeChunkHashV2)(sampleChunk);
            const parsed = (0, simhash_chunker_js_1.deserializeChunkHashV2)(buf);
            // 关键断言：类型必须是 bigint，不是 number
            node_assert_1.default.strictEqual(typeof parsed.simhash, 'bigint');
            node_assert_1.default.strictEqual(parsed.simhash, sampleChunk.simhash);
        });
        (0, node_test_1.it)('反序列化应保持所有字段完整', () => {
            const buf = (0, simhash_chunker_js_1.serializeChunkHashV2)(sampleChunk);
            const parsed = (0, simhash_chunker_js_1.deserializeChunkHashV2)(buf);
            node_assert_1.default.strictEqual(parsed.simhash, sampleChunk.simhash);
            node_assert_1.default.ok(parsed.md5.equals(sampleChunk.md5));
            node_assert_1.default.strictEqual(parsed.length, sampleChunk.length);
            node_assert_1.default.strictEqual(parsed.seed, sampleChunk.seed);
        });
        (0, node_test_1.it)('应正确处理高位全 1 的 simhash', () => {
            const chunk = {
                simhash: simhash_chunker_js_1.UINT64_MASK,
                md5: Buffer.alloc(16),
                length: 0,
                seed: 0
            };
            const buf = (0, simhash_chunker_js_1.serializeChunkHashV2)(chunk);
            const parsed = (0, simhash_chunker_js_1.deserializeChunkHashV2)(buf);
            node_assert_1.default.strictEqual(parsed.simhash, simhash_chunker_js_1.UINT64_MASK);
        });
        (0, node_test_1.it)('应拒绝非 16 字节的 MD5', () => {
            const badChunk = {
                simhash: 0n,
                md5: Buffer.alloc(15),
                length: 0,
                seed: 0
            };
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.serializeChunkHashV2)(badChunk), /MD5 must be 16 bytes/);
        });
        (0, node_test_1.it)('应拒绝非 32 字节的缓冲区', () => {
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.deserializeChunkHashV2)(Buffer.alloc(31)), /Invalid ChunkHashV2 buffer size/);
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.deserializeChunkHashV2)(Buffer.alloc(33)), /Invalid ChunkHashV2 buffer size/);
        });
    });
    (0, node_test_1.describe)('ChunkHashV1 - 向后兼容', () => {
        (0, node_test_1.it)('应正确序列化/反序列化 V1 格式', () => {
            const simhash = 0x123456789abcdef0n;
            const buf = (0, simhash_chunker_js_1.serializeChunkHashV1)(simhash);
            node_assert_1.default.strictEqual(buf.length, 8);
            const parsed = (0, simhash_chunker_js_1.deserializeChunkHashV1)(buf);
            node_assert_1.default.strictEqual(typeof parsed, 'bigint');
            node_assert_1.default.strictEqual(parsed, simhash);
        });
        (0, node_test_1.it)('应拒绝非 8 字节的 V1 缓冲区', () => {
            node_assert_1.default.throws(() => (0, simhash_chunker_js_1.deserializeChunkHashV1)(Buffer.alloc(7)), /Invalid ChunkHashV1 buffer size/);
        });
    });
});
// ============================================================================
// SimHash 计算测试
// ============================================================================
(0, node_test_1.describe)('SimHashHasher', () => {
    (0, node_test_1.it)('应使用种子生成确定性结果', () => {
        const hasher1 = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const hasher2 = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const content = Buffer.from('Hello, World!');
        const hash1 = hasher1.hash(content);
        const hash2 = hasher2.hash(content);
        node_assert_1.default.strictEqual(hash1, hash2);
    });
    (0, node_test_1.it)('不同种子应产生不同结果', () => {
        const hasher1 = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const hasher2 = new simhash_chunker_js_1.SimHashHasher({ seed: 0x87654321 });
        const content = Buffer.from('Hello, World!');
        const hash1 = hasher1.hash(content);
        const hash2 = hasher2.hash(content);
        node_assert_1.default.notStrictEqual(hash1, hash2);
    });
    (0, node_test_1.it)('应拒绝无效的种子值', () => {
        node_assert_1.default.throws(() => new simhash_chunker_js_1.SimHashHasher({ seed: -1 }), /seed must be 32-bit unsigned integer/);
        node_assert_1.default.throws(() => new simhash_chunker_js_1.SimHashHasher({ seed: 0x100000000 }), /seed must be 32-bit unsigned integer/);
        node_assert_1.default.throws(() => new simhash_chunker_js_1.SimHashHasher({ seed: 1.5 }), /seed must be 32-bit unsigned integer/);
    });
    (0, node_test_1.it)('返回的 simhash 应为 bigint', () => {
        const hasher = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const content = Buffer.from('Test content');
        const hash = hasher.hash(content);
        node_assert_1.default.strictEqual(typeof hash, 'bigint');
        node_assert_1.default.ok(hash >= 0n && hash <= simhash_chunker_js_1.UINT64_MASK);
    });
    (0, node_test_1.it)('相似内容应产生相近的 simhash', () => {
        const hasher = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const content1 = Buffer.from('The quick brown fox jumps over the lazy dog');
        const content2 = Buffer.from('The quick brown fox jumps over the lazy cat');
        const hash1 = hasher.hash(content1);
        const hash2 = hasher.hash(content2);
        const dist = (0, simhash_chunker_js_1.hammingDistance)(hash1, hash2);
        // 相似内容的汉明距离应该较小
        node_assert_1.default.ok(dist < 20, `Expected distance < 20, got ${dist}`);
    });
});
// ============================================================================
// 级联哈希比较测试
// ============================================================================
(0, node_test_1.describe)('级联哈希比较', () => {
    const createChunk = (simhash, md5Hex, length, seed) => ({
        simhash,
        md5: Buffer.from(md5Hex, 'hex'),
        length,
        seed
    });
    (0, node_test_1.describe)('compareChunks', () => {
        (0, node_test_1.it)('汉明距离 >= 3 应返回 UNIQUE', () => {
            const a = createChunk(0n, '00000000000000000000000000000000', 100, 0);
            const b = createChunk(7n, '00000000000000000000000000000000', 100, 0);
            const result = (0, simhash_chunker_js_1.compareChunks)(a, b, {
                hashType: 0x02,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 32
            });
            node_assert_1.default.strictEqual(result, 'UNIQUE');
        });
        (0, node_test_1.it)('不支持级联时应返回 UNCERTAIN', () => {
            const a = createChunk(0n, '00000000000000000000000000000000', 100, 0);
            const b = createChunk(1n, '11111111111111111111111111111111', 100, 0);
            const result = (0, simhash_chunker_js_1.compareChunks)(a, b, {
                hashType: 0x01,
                supportsCascade: false,
                supportsSeedConfig: false,
                maxHashSize: 8
            });
            node_assert_1.default.strictEqual(result, 'UNCERTAIN');
        });
        (0, node_test_1.it)('SimHash 相似但 MD5 不同应返回 UNIQUE', () => {
            const a = createChunk(0n, '00000000000000000000000000000000', 100, 0);
            const b = createChunk(1n, '11111111111111111111111111111111', 100, 0);
            const result = (0, simhash_chunker_js_1.compareChunks)(a, b, {
                hashType: 0x02,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 32
            });
            node_assert_1.default.strictEqual(result, 'UNIQUE');
        });
        (0, node_test_1.it)('MD5 匹配但 length 不同应返回 UNIQUE', () => {
            const a = createChunk(0n, '00000000000000000000000000000000', 100, 0);
            const b = createChunk(1n, '00000000000000000000000000000000', 200, 0);
            const result = (0, simhash_chunker_js_1.compareChunks)(a, b, {
                hashType: 0x02,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 32
            });
            node_assert_1.default.strictEqual(result, 'UNIQUE');
        });
        (0, node_test_1.it)('SimHash + MD5 + length 都匹配应返回 DUPLICATE', () => {
            const a = createChunk(0n, '00000000000000000000000000000000', 100, 0);
            const b = createChunk(1n, '00000000000000000000000000000000', 100, 0);
            const result = (0, simhash_chunker_js_1.compareChunks)(a, b, {
                hashType: 0x02,
                supportsCascade: true,
                supportsSeedConfig: true,
                maxHashSize: 32
            });
            node_assert_1.default.strictEqual(result, 'DUPLICATE');
        });
    });
});
// ============================================================================
// 辅助函数测试
// ============================================================================
(0, node_test_1.describe)('辅助函数', () => {
    (0, node_test_1.describe)('computeMD5', () => {
        (0, node_test_1.it)('应正确计算 MD5', () => {
            const content = Buffer.from('Hello, World!');
            const md5 = (0, simhash_chunker_js_1.computeMD5)(content);
            node_assert_1.default.strictEqual(md5.length, 16);
            node_assert_1.default.strictEqual(md5.toString('hex'), '65a8e27d8879283831b664bd8b7f0ad4');
        });
    });
    (0, node_test_1.describe)('createChunkHashV2', () => {
        (0, node_test_1.it)('应创建完整的 ChunkHashV2', () => {
            const content = Buffer.from('Test content for chunk hash');
            const seed = 0x12345678;
            const chunk = (0, simhash_chunker_js_1.createChunkHashV2)(content, seed);
            node_assert_1.default.strictEqual(typeof chunk.simhash, 'bigint');
            node_assert_1.default.strictEqual(chunk.md5.length, 16);
            node_assert_1.default.strictEqual(chunk.length, content.length);
            node_assert_1.default.strictEqual(chunk.seed, seed);
        });
    });
    (0, node_test_1.describe)('randomSimHash', () => {
        (0, node_test_1.it)('应生成有效的 simhash', () => {
            const hash = (0, simhash_chunker_js_1.randomSimHash)();
            node_assert_1.default.strictEqual(typeof hash, 'bigint');
            node_assert_1.default.ok(hash >= 0n && hash <= simhash_chunker_js_1.UINT64_MASK);
        });
        (0, node_test_1.it)('应生成不同的值', () => {
            const hash1 = (0, simhash_chunker_js_1.randomSimHash)();
            const hash2 = (0, simhash_chunker_js_1.randomSimHash)();
            node_assert_1.default.notStrictEqual(hash1, hash2);
        });
    });
});
// ============================================================================
// 边界情况测试
// ============================================================================
(0, node_test_1.describe)('边界情况', () => {
    (0, node_test_1.it)('应处理空内容', () => {
        const hasher = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const hash = hasher.hash(Buffer.alloc(0));
        node_assert_1.default.strictEqual(typeof hash, 'bigint');
    });
    (0, node_test_1.it)('应处理极大内容', () => {
        const hasher = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const hash = hasher.hash(Buffer.alloc(1024 * 1024)); // 1MB
        node_assert_1.default.strictEqual(typeof hash, 'bigint');
        node_assert_1.default.ok(hash >= 0n && hash <= simhash_chunker_js_1.UINT64_MASK);
    });
    (0, node_test_1.it)('应处理所有字节值', () => {
        const hasher = new simhash_chunker_js_1.SimHashHasher({ seed: 0x12345678 });
        const content = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
        const hash = hasher.hash(content);
        node_assert_1.default.strictEqual(typeof hash, 'bigint');
    });
});
//# sourceMappingURL=simhash-chunker.test.js.map