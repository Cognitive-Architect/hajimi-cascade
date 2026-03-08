"use strict";
/**
 * HCTX Reader 测试
 *
 * 验证 RISK-H-002 修复：Fail-fast 兼容策略
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const hctx_reader_js_1 = require("../format/hctx-reader.js");
const simhash_chunker_js_1 = require("../cdc/simhash-chunker.js");
// ============================================================================
// RISK-H-002: Fail-fast 兼容策略测试
// ============================================================================
(0, node_test_1.describe)('RISK-H-002: Fail-fast 兼容策略', () => {
    (0, node_test_1.describe)('魔数校验', () => {
        (0, node_test_1.it)('应接受 HCTX_MAGIC_V1', () => {
            const header = createTestHeader({ magic: hctx_reader_js_1.HCTX_MAGIC_V1 });
            const buf = (0, hctx_reader_js_1.serializeHeader)(header);
            const result = (0, hctx_reader_js_1.parseHeader)(buf);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.magic, hctx_reader_js_1.HCTX_MAGIC_V1);
        });
        (0, node_test_1.it)('应接受 HCTX_MAGIC_V2', () => {
            const header = createTestHeader({ magic: hctx_reader_js_1.HCTX_MAGIC_V2 });
            const buf = (0, hctx_reader_js_1.serializeHeader)(header);
            const result = (0, hctx_reader_js_1.parseHeader)(buf);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.magic, hctx_reader_js_1.HCTX_MAGIC_V2);
        });
        (0, node_test_1.it)('应拒绝未知魔数（Fail-fast 核心）', () => {
            const header = createTestHeader({ magic: 0xDEADBEEF });
            const buf = (0, hctx_reader_js_1.serializeHeader)(header);
            const result = (0, hctx_reader_js_1.parseHeader)(buf);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.INVALID_MAGIC);
        });
        (0, node_test_1.it)('错误信息应包含期望的魔数列表', () => {
            const header = createTestHeader({ magic: 0xDEADBEEF });
            const buf = (0, hctx_reader_js_1.serializeHeader)(header);
            const result = (0, hctx_reader_js_1.parseHeader)(buf);
            // 检查错误信息包含魔数相关信息
            node_assert_1.default.ok(result.error.message.includes('0x'));
            node_assert_1.default.ok(result.error.message.toLowerCase().includes('magic'));
        });
    });
    (0, node_test_1.describe)('最小兼容版本检查（Fail-fast 核心）', () => {
        (0, node_test_1.it)('应接受兼容的版本', () => {
            const header = createTestHeader({
                minCompatibleVersion: hctx_reader_js_1.READER_MIN_COMPATIBLE_VERSION
            });
            const result = (0, hctx_reader_js_1.checkCompatibility)(header);
            node_assert_1.default.strictEqual(result.success, true);
        });
        (0, node_test_1.it)('应拒绝要求更高版本的文件（Fail-fast）', () => {
            const header = createTestHeader({
                minCompatibleVersion: hctx_reader_js_1.READER_VERSION + 0x100 // 要求更高版本
            });
            const result = (0, hctx_reader_js_1.checkCompatibility)(header);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.MIN_VERSION_TOO_HIGH);
            node_assert_1.default.ok(result.error.message.includes('upgrade'));
        });
        (0, node_test_1.it)('错误信息应指导用户升级', () => {
            const header = createTestHeader({
                minCompatibleVersion: 0x0500 // 要求 v5.0
            });
            const result = (0, hctx_reader_js_1.checkCompatibility)(header);
            // 检查错误信息包含版本相关信息
            node_assert_1.default.ok(result.error.message.toLowerCase().includes('version'));
            node_assert_1.default.ok(result.error.message.toLowerCase().includes('upgrade'));
        });
    });
    (0, node_test_1.describe)('Hash Type 验证', () => {
        (0, node_test_1.it)('应接受 LEGACY_SIMHASH (0x01)', () => {
            const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.LEGACY_SIMHASH });
            const result = (0, hctx_reader_js_1.checkCompatibility)(header);
            node_assert_1.default.strictEqual(result.success, true);
        });
        (0, node_test_1.it)('应接受 CASCADE_MD5 (0x02)', () => {
            const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.CASCADE_MD5 });
            const result = (0, hctx_reader_js_1.checkCompatibility)(header);
            node_assert_1.default.strictEqual(result.success, true);
        });
        (0, node_test_1.it)('应拒绝未知的 hash type', () => {
            const buf = Buffer.alloc(hctx_reader_js_1.HEADER_SIZE);
            // RISK-H-007: 使用大端序
            buf.writeUInt32BE(hctx_reader_js_1.HCTX_MAGIC_V2, 0);
            buf.writeUInt16BE(0x0300, 4);
            buf.writeUInt8(0xFF, 6); // 未知的 hash type
            buf.writeUInt8(0, 7);
            buf.writeUInt32BE(hctx_reader_js_1.READER_MIN_COMPATIBLE_VERSION, 8);
            buf.writeBigUInt64BE(0n, 12);
            buf.writeBigUInt64BE(BigInt(hctx_reader_js_1.HEADER_SIZE), 20);
            buf.writeUInt32BE(0, 28);
            const result = (0, hctx_reader_js_1.parseHeader)(buf);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.UNKNOWN_HASH_TYPE);
        });
    });
    (0, node_test_1.describe)('元数据偏移验证', () => {
        (0, node_test_1.it)('应拒绝过小的元数据偏移', () => {
            const header = createTestHeader({
                hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
                chunkCount: 10n,
                metadataOffset: BigInt(hctx_reader_js_1.HEADER_SIZE + 100) // 太小，应该需要 HEADER + 320
            });
            const result = (0, hctx_reader_js_1.parseHeader)((0, hctx_reader_js_1.serializeHeader)(header));
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.INVALID_METADATA_OFFSET);
        });
    });
});
// ============================================================================
// Header 序列化/反序列化测试
// ============================================================================
(0, node_test_1.describe)('Header 序列化/反序列化', () => {
    (0, node_test_1.it)('应保持所有字段完整', () => {
        const original = {
            magic: hctx_reader_js_1.HCTX_MAGIC_V2,
            version: 0x0300,
            hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
            flags: 0x01,
            minCompatibleVersion: 0x0200,
            chunkCount: 1000n,
            metadataOffset: 32032n,
            reserved: 0
        };
        const header = createTestHeader(original);
        const buf = (0, hctx_reader_js_1.serializeHeader)(header);
        const result = (0, hctx_reader_js_1.parseHeader)(buf);
        node_assert_1.default.strictEqual(result.success, true);
        const parsed = result.data;
        node_assert_1.default.strictEqual(parsed.magic, original.magic);
        node_assert_1.default.strictEqual(parsed.version, original.version);
        node_assert_1.default.strictEqual(parsed.hashType, original.hashType);
        node_assert_1.default.strictEqual(parsed.flags, original.flags);
        node_assert_1.default.strictEqual(parsed.minCompatibleVersion, original.minCompatibleVersion);
        node_assert_1.default.strictEqual(parsed.chunkCount, original.chunkCount);
        node_assert_1.default.strictEqual(parsed.metadataOffset, original.metadataOffset);
        node_assert_1.default.strictEqual(parsed.reserved, original.reserved);
    });
    (0, node_test_1.it)('应正确序列化 BigInt 字段（chunkCount）', () => {
        // 使用小于 Number.MAX_SAFE_INTEGER 的值测试正常情况
        // Number.MAX_SAFE_INTEGER = 9007199254740991 ≈ 0x1FFFFFFFFFFFFF
        const safeChunkCount = 0xfffffffffffffn; // ~4.5e15，在安全范围内
        const header = createTestHeader({
            chunkCount: safeChunkCount
        });
        const buf = (0, hctx_reader_js_1.serializeHeader)(header);
        const result = (0, hctx_reader_js_1.parseHeader)(buf);
        node_assert_1.default.strictEqual(result.success, true);
        node_assert_1.default.strictEqual(result.data.chunkCount, safeChunkCount);
    });
    (0, node_test_1.it)('应拒绝过小的缓冲区', () => {
        const result = (0, hctx_reader_js_1.parseHeader)(Buffer.alloc(31));
        node_assert_1.default.strictEqual(result.success, false);
        node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.BUFFER_TOO_SMALL);
    });
});
// ============================================================================
// 版本能力检测测试
// ============================================================================
(0, node_test_1.describe)('版本能力检测', () => {
    (0, node_test_1.it)('LEGACY_SIMHASH 应报告不支持级联', () => {
        const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.LEGACY_SIMHASH });
        const caps = (0, hctx_reader_js_1.getVersionCapabilities)(header);
        node_assert_1.default.strictEqual(caps.hashType, 0x01);
        node_assert_1.default.strictEqual(caps.supportsCascade, false);
        node_assert_1.default.strictEqual(caps.supportsSeedConfig, false);
        node_assert_1.default.strictEqual(caps.maxHashSize, 8);
    });
    (0, node_test_1.it)('CASCADE_MD5 应报告支持级联', () => {
        const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.CASCADE_MD5 });
        const caps = (0, hctx_reader_js_1.getVersionCapabilities)(header);
        node_assert_1.default.strictEqual(caps.hashType, 0x02);
        node_assert_1.default.strictEqual(caps.supportsCascade, true);
        node_assert_1.default.strictEqual(caps.supportsSeedConfig, true);
        node_assert_1.default.strictEqual(caps.maxHashSize, 32);
    });
    (0, node_test_1.it)('CASCADE_SHA256 应报告支持级联', () => {
        const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.CASCADE_SHA256 });
        const caps = (0, hctx_reader_js_1.getVersionCapabilities)(header);
        node_assert_1.default.strictEqual(caps.hashType, 0x03);
        node_assert_1.default.strictEqual(caps.supportsCascade, true);
        node_assert_1.default.strictEqual(caps.maxHashSize, 48);
    });
    (0, node_test_1.it)('CASCADE_BLAKE3 应报告支持级联', () => {
        const header = createTestHeader({ hashType: hctx_reader_js_1.HashType.CASCADE_BLAKE3 });
        const caps = (0, hctx_reader_js_1.getVersionCapabilities)(header);
        node_assert_1.default.strictEqual(caps.hashType, 0x04);
        node_assert_1.default.strictEqual(caps.supportsCascade, true);
        node_assert_1.default.strictEqual(caps.maxHashSize, 48);
    });
});
// ============================================================================
// Chunk 条目解析测试
// ============================================================================
(0, node_test_1.describe)('Chunk 条目解析', () => {
    const createTestChunks = (count) => {
        return Array.from({ length: count }, (_, i) => ({
            simhash: BigInt(i) % simhash_chunker_js_1.UINT64_MASK,
            md5: Buffer.from(`0000000000000000000000000000000${i.toString(16).padStart(2, '0')}`, 'hex'),
            length: 8192 + i,
            seed: 0x12345678 + i
        }));
    };
    (0, node_test_1.describe)('LEGACY_SIMHASH (8B entry)', () => {
        (0, node_test_1.it)('应正确解析 V1 格式条目', () => {
            const chunks = createTestChunks(5);
            const header = createTestHeader({
                hashType: hctx_reader_js_1.HashType.LEGACY_SIMHASH,
                chunkCount: 5n
            });
            // 手动构建 V1 格式数据 - RISK-H-007: 使用大端序
            const chunksBuf = Buffer.alloc(5 * 8);
            for (let i = 0; i < 5; i++) {
                chunksBuf.writeBigUInt64BE(chunks[i].simhash, i * 8);
            }
            const result = (0, hctx_reader_js_1.parseChunks)(chunksBuf, header);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.length, 5);
            // V1 格式只有 simhash 有效，其他为默认值
            for (let i = 0; i < 5; i++) {
                node_assert_1.default.strictEqual(result.data[i].simhash, chunks[i].simhash);
                node_assert_1.default.strictEqual(result.data[i].md5.length, 16);
                node_assert_1.default.strictEqual(result.data[i].length, 0);
                node_assert_1.default.strictEqual(result.data[i].seed, 0);
            }
        });
    });
    (0, node_test_1.describe)('CASCADE_MD5 (32B entry)', () => {
        (0, node_test_1.it)('应正确解析 V2 格式条目', () => {
            const chunks = createTestChunks(3);
            const header = createTestHeader({
                hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
                chunkCount: 3n
            });
            // 构建 V2 格式数据 - RISK-H-007: 使用大端序
            const chunksBuf = Buffer.alloc(3 * 32);
            for (let i = 0; i < 3; i++) {
                const offset = i * 32;
                chunksBuf.writeBigUInt64BE(chunks[i].simhash, offset);
                chunksBuf.set(chunks[i].md5, offset + 8);
                chunksBuf.writeUInt32BE(chunks[i].length, offset + 24);
                chunksBuf.writeUInt32BE(chunks[i].seed, offset + 28);
            }
            const result = (0, hctx_reader_js_1.parseChunks)(chunksBuf, header);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.length, 3);
            for (let i = 0; i < 3; i++) {
                node_assert_1.default.strictEqual(result.data[i].simhash, chunks[i].simhash);
                node_assert_1.default.ok(result.data[i].md5.equals(chunks[i].md5));
                node_assert_1.default.strictEqual(result.data[i].length, chunks[i].length);
                node_assert_1.default.strictEqual(result.data[i].seed, chunks[i].seed);
            }
        });
        (0, node_test_1.it)('应拒绝过小的缓冲区', () => {
            const header = createTestHeader({
                hashType: hctx_reader_js_1.HashType.CASCADE_MD5,
                chunkCount: 10n
            });
            const result = (0, hctx_reader_js_1.parseChunks)(Buffer.alloc(100), header);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.BUFFER_TOO_SMALL);
        });
    });
});
// ============================================================================
// 完整文件读写测试
// ============================================================================
(0, node_test_1.describe)('完整文件读写', () => {
    const createTestChunks = (count) => {
        return Array.from({ length: count }, (_, i) => ({
            simhash: (0, simhash_chunker_js_1.randomSimHash)(),
            md5: Buffer.from(Array(16).fill(0).map((_, j) => (i * 16 + j) % 256)),
            length: 8192 + i * 100,
            seed: 0x12345678
        }));
    };
    (0, node_test_1.it)('应正确写入和读取 V2 格式文件', () => {
        const chunks = createTestChunks(10);
        const fileBuf = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
        const result = (0, hctx_reader_js_1.readHctxFile)(fileBuf);
        node_assert_1.default.strictEqual(result.success, true);
        node_assert_1.default.strictEqual(result.data.chunks.length, 10);
        node_assert_1.default.strictEqual(result.data.capabilities.supportsCascade, true);
    });
    (0, node_test_1.it)('应正确写入和读取 V1 格式文件', () => {
        const chunks = createTestChunks(5);
        const fileBuf = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.LEGACY_SIMHASH, {
            magic: hctx_reader_js_1.HCTX_MAGIC_V1,
            version: 0x0100,
            minCompatibleVersion: 0x0100
        });
        const result = (0, hctx_reader_js_1.readHctxFile)(fileBuf);
        node_assert_1.default.strictEqual(result.success, true);
        node_assert_1.default.strictEqual(result.data.chunks.length, 5);
        node_assert_1.default.strictEqual(result.data.capabilities.supportsCascade, false);
    });
    (0, node_test_1.it)('应拒绝损坏的文件（魔数错误）', () => {
        const chunks = createTestChunks(5);
        const fileBuf = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
        // 破坏魔数 - RISK-H-007: 使用大端序写入
        fileBuf.writeUInt32BE(0xDEADBEEF, 0);
        const result = (0, hctx_reader_js_1.readHctxFile)(fileBuf);
        node_assert_1.default.strictEqual(result.success, false);
        node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.INVALID_MAGIC);
    });
    (0, node_test_1.it)('应拒绝不兼容版本的文件', () => {
        const chunks = createTestChunks(5);
        const fileBuf = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5, {
            minCompatibleVersion: 0x0500 // 要求 v5.0
        });
        const result = (0, hctx_reader_js_1.readHctxFile)(fileBuf);
        node_assert_1.default.strictEqual(result.success, false);
        node_assert_1.default.strictEqual(result.error.code, hctx_reader_js_1.HctxErrorCode.MIN_VERSION_TOO_HIGH);
    });
});
// ============================================================================
// 交叉版本兼容性测试（新旧版本互操作）
// ============================================================================
(0, node_test_1.describe)('交叉版本兼容性测试', () => {
    const createTestChunks = (count) => {
        return Array.from({ length: count }, (_, i) => ({
            simhash: BigInt(i * 0x100000000) + BigInt(i),
            md5: Buffer.from(`0000000000000000000000000000000${i}`, 'hex').subarray(0, 16),
            length: 8192,
            seed: 0x12345678
        }));
    };
    (0, node_test_1.describe)('新读取器读旧文件（V1 -> V3）', () => {
        (0, node_test_1.it)('应成功读取 V1 格式文件', () => {
            const chunks = createTestChunks(5);
            const v1File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.LEGACY_SIMHASH, {
                magic: hctx_reader_js_1.HCTX_MAGIC_V1,
                version: 0x0100,
                minCompatibleVersion: 0x0100
            });
            const result = (0, hctx_reader_js_1.readHctxFile)(v1File);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.header.magic, hctx_reader_js_1.HCTX_MAGIC_V1);
            node_assert_1.default.strictEqual(result.data.header.hashType, hctx_reader_js_1.HashType.LEGACY_SIMHASH);
        });
        (0, node_test_1.it)('应正确降级 V1 条目', () => {
            const chunks = createTestChunks(3);
            const v1File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.LEGACY_SIMHASH, {
                magic: hctx_reader_js_1.HCTX_MAGIC_V1,
                version: 0x0100,
                minCompatibleVersion: 0x0100
            });
            const result = (0, hctx_reader_js_1.readHctxFile)(v1File);
            node_assert_1.default.strictEqual(result.success, true);
            // V1 格式只有 simhash 有效
            for (let i = 0; i < 3; i++) {
                node_assert_1.default.strictEqual(typeof result.data.chunks[i].simhash, 'bigint');
            }
        });
    });
    (0, node_test_1.describe)('降级文件生成（V2 -> V1）', () => {
        (0, node_test_1.it)('应生成兼容旧读取器的文件', () => {
            const chunks = createTestChunks(5);
            const downgradeFile = (0, hctx_reader_js_1.createDowngradeFile)(chunks);
            const result = (0, hctx_reader_js_1.readHctxFile)(downgradeFile);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.header.magic, hctx_reader_js_1.HCTX_MAGIC_V1);
            node_assert_1.default.strictEqual(result.data.capabilities.supportsCascade, false);
        });
    });
    (0, node_test_1.describe)('Fail-fast 行为验证', () => {
        (0, node_test_1.it)('旧读取器遇到 HCX2 魔数应立即报错', () => {
            // 模拟旧读取器行为：只识别 HCTX_MAGIC_V1
            const chunks = createTestChunks(5);
            const v2File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
            // 验证魔数是 HCX2 - RISK-H-007: 使用大端序读取
            node_assert_1.default.strictEqual(v2File.readUInt32BE(0), hctx_reader_js_1.HCTX_MAGIC_V2);
            // 旧读取器（只支持 V1）会拒绝此文件
            const magic = v2File.readUInt32BE(0);
            node_assert_1.default.notStrictEqual(magic, hctx_reader_js_1.HCTX_MAGIC_V1);
        });
        (0, node_test_1.it)('新读取器应识别 V2 格式', () => {
            const chunks = createTestChunks(5);
            const v2File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
            const result = (0, hctx_reader_js_1.readHctxFile)(v2File);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data.header.magic, hctx_reader_js_1.HCTX_MAGIC_V2);
        });
    });
    (0, node_test_1.describe)('版本协商', () => {
        (0, node_test_1.it)('应正确报告文件版本信息', () => {
            const chunks = createTestChunks(5);
            const v2File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
            const info = (0, hctx_reader_js_1.getFileVersionInfo)(v2File);
            node_assert_1.default.ok(info.includes('HCX2'));
            node_assert_1.default.ok(info.includes('CASCADE_MD5'));
        });
        (0, node_test_1.it)('应正确识别级联格式', () => {
            const chunks = createTestChunks(5);
            const v2File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.CASCADE_MD5);
            const v1File = (0, hctx_reader_js_1.createHctxFile)(chunks, hctx_reader_js_1.HashType.LEGACY_SIMHASH, {
                magic: hctx_reader_js_1.HCTX_MAGIC_V1,
                version: 0x0100,
                minCompatibleVersion: 0x0100
            });
            node_assert_1.default.strictEqual((0, hctx_reader_js_1.isCascadeFormat)(v2File), true);
            node_assert_1.default.strictEqual((0, hctx_reader_js_1.isCascadeFormat)(v1File), false);
        });
    });
});
// ============================================================================
// 辅助函数
// ============================================================================
function createTestHeader(overrides = {}) {
    const chunkCount = overrides.chunkCount ?? 0n;
    const hashType = overrides.hashType ?? hctx_reader_js_1.HashType.CASCADE_MD5;
    const entrySize = hashType === hctx_reader_js_1.HashType.LEGACY_SIMHASH ? 8 :
        hashType === hctx_reader_js_1.HashType.CASCADE_MD5 ? 32 : 48;
    return {
        magic: overrides.magic ?? hctx_reader_js_1.HCTX_MAGIC_V2,
        version: overrides.version ?? hctx_reader_js_1.READER_VERSION,
        hashType,
        flags: overrides.flags ?? 0,
        minCompatibleVersion: overrides.minCompatibleVersion ?? hctx_reader_js_1.READER_MIN_COMPATIBLE_VERSION,
        chunkCount,
        metadataOffset: overrides.metadataOffset ?? BigInt(hctx_reader_js_1.HEADER_SIZE) + chunkCount * BigInt(entrySize),
        reserved: overrides.reserved ?? 0
    };
}
//# sourceMappingURL=hctx-reader.test.js.map