"use strict";
/**
 * 交叉版本兼容性测试 (DEBT-VALIDATION-004)
 *
 * 测试场景：
 * 1. v1-reader 读 v2.6 文件 → 应抛出 InvalidMagic 或 VersionTooHigh
 * 2. v2.6-reader 读 v1 文件 → 应成功（向后兼容）
 * 3. v2.6-reader 读 v2.0 文件 → 应成功
 * 4. v2.0-reader 读 v2.6 文件 → 应抛出 MIN_VERSION_TOO_HIGH
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readHctxFile, createHctxFile, createDowngradeFile, HashType, HCTX_MAGIC_V1, HCTX_MAGIC_V2 } from '../format/hctx-reader.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// 创建require函数用于加载CommonJS模块 - 使用绝对路径
const requireModule = createRequire(import.meta.url);
// 动态加载 legacy readers (使用绝对路径)
const v1ReaderPath = join(__dirname, 'fixtures', 'readers', 'v1.legacy.js');
const v20ReaderPath = join(__dirname, 'fixtures', 'readers', 'v2.0.legacy.js');
const v1Reader = requireModule(v1ReaderPath);
const v20Reader = requireModule(v20ReaderPath);
// 测试数据
const testChunks = [
    { simhash: 0x1234567890abcdefn, md5: Buffer.from('0123456789ABCDEF0123456789ABCDEF', 'hex'), length: 1024, seed: 42 },
    { simhash: 0xfedcba0987654321n, md5: Buffer.from('FEDCBA0987654321FEDCBA0987654321', 'hex'), length: 2048, seed: 84 }
];
describe('DEBT-VALIDATION-004: 交叉版本兼容性测试', () => {
    describe('场景1: v1-reader 读 v2.6 文件', () => {
        it('应抛出 InvalidMagic 错误 (v1不认识HCX2魔数)', () => {
            // 生成 v2.6 格式文件
            const v26File = createHctxFile(testChunks, HashType.CASCADE_MD5, {
                magic: HCTX_MAGIC_V2,
                version: 0x0260,
                minCompatibleVersion: 0x0260
            });
            // v1 reader 尝试读取，应抛出异常
            assert.throws(() => {
                v1Reader.readV1File(v26File);
            }, (err) => {
                assert.strictEqual(err.code, v1Reader.ErrorCode.INVALID_MAGIC);
                assert.ok(err.message.includes('Invalid magic'));
                return true;
            });
        });
    });
    describe('场景2: v2.6-reader 读 v1 文件', () => {
        it('应成功读取 (向后兼容)', () => {
            // 生成 v1 格式文件 (降级文件)
            const v1Chunks = [
                { simhash: 0x1234567890abcdefn, md5: Buffer.alloc(16), length: 0, seed: 0 },
                { simhash: 0xfedcba0987654321n, md5: Buffer.alloc(16), length: 0, seed: 0 }
            ];
            const v1File = createDowngradeFile(v1Chunks);
            // v2.6 reader (当前读取器) 读取 v1 文件
            const result = readHctxFile(v1File);
            assert.strictEqual(result.success, true);
            assert.ok(result.data);
            assert.strictEqual(result.data.header.magic, HCTX_MAGIC_V1);
            assert.strictEqual(result.data.header.hashType, HashType.LEGACY_SIMHASH);
            assert.strictEqual(result.data.chunks.length, 2);
        });
    });
    describe('场景3: v2.6-reader 读 v2.0 文件', () => {
        it('应成功读取 (向前兼容)', () => {
            // 生成 v2.0 格式文件
            const v20File = createHctxFile(testChunks, HashType.CASCADE_MD5, {
                magic: HCTX_MAGIC_V2,
                version: 0x0200,
                minCompatibleVersion: 0x0200
            });
            // v2.6 reader 读取 v2.0 文件
            const result = readHctxFile(v20File);
            assert.strictEqual(result.success, true);
            assert.ok(result.data);
            assert.strictEqual(result.data.header.magic, HCTX_MAGIC_V2);
            assert.strictEqual(result.data.header.version, 0x0200);
            assert.strictEqual(result.data.chunks.length, 2);
        });
    });
    describe('场景4: v2.0-reader 读 v2.6 文件', () => {
        it('应抛出 MIN_VERSION_TOO_HIGH 错误 (Fail-fast)', () => {
            // 生成 v2.6 格式文件
            const v26File = createHctxFile(testChunks, HashType.CASCADE_MD5, {
                magic: HCTX_MAGIC_V2,
                version: 0x0260,
                minCompatibleVersion: 0x0260
            });
            // v2.0 reader 尝试读取，应抛出 MIN_VERSION_TOO_HIGH
            assert.throws(() => {
                v20Reader.readV20File(v26File);
            }, (err) => {
                assert.strictEqual(err.code, v20Reader.ErrorCode.MIN_VERSION_TOO_HIGH);
                assert.ok(err.message.includes('minimum compatible version'));
                return true;
            });
        });
    });
    describe('额外场景: v2.0-reader 读 v1 文件 (向后兼容验证)', () => {
        it('应成功读取 v1 格式', () => {
            // 使用 v1 reader 创建 v1 文件
            const v1Chunks = [
                { simhash: 0x1234567890abcdefn },
                { simhash: 0xfedcba0987654321n }
            ];
            const v1File = v1Reader.createV1File(v1Chunks);
            // v2.0 reader 读取 v1 文件
            const result = v20Reader.readV20File(v1File);
            assert.strictEqual(result.version, 'v2.0');
            assert.strictEqual(result.header.magic, 'HCTX');
            assert.strictEqual(result.header.fileVersion, '1.0');
            assert.strictEqual(result.header.hashType, 'LEGACY_SIMHASH');
            assert.strictEqual(result.chunks.length, 2);
        });
    });
    describe('额外场景: v2.6-reader 读取能力验证', () => {
        it('应正确识别 v2.6 文件格式', () => {
            // 生成 v2.6 格式文件
            const v26File = createHctxFile(testChunks, HashType.CASCADE_MD5, {
                magic: HCTX_MAGIC_V2,
                version: 0x0260,
                minCompatibleVersion: 0x0200 // 要求最低v2.0读取器
            });
            const result = readHctxFile(v26File);
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data.header.version, 0x0260);
            assert.strictEqual(result.data.header.minCompatibleVersion, 0x0200);
            assert.strictEqual(result.data.capabilities.supportsCascade, true);
        });
    });
});
//# sourceMappingURL=cross-version.test.mjs.map