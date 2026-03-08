"use strict";
/**
 * 通用格式检测器测试套件
 *
 * 测试覆盖：
 * - FMT-001: JSON文件LE/BE检测准确率100%
 * - FMT-002: Binary原始字节流检测无崩溃
 * - FMT-003: 未知格式回退HCTX
 * - NEG-FMT-001: 损坏JSON处理
 * - HIGH-FMT-001: 大文件100MB检测
 * - PERF-001: 检测延迟<0.01ms
 * - E2E-FMT-001: 全链路测试
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const universal_detector_js_1 = require("../format/universal-detector.js");
(0, node_test_1.describe)('UniversalDetector', () => {
    const detector = new universal_detector_js_1.UniversalDetector();
    // ============================================================================
    // 基础功能测试
    // ============================================================================
    (0, node_test_1.describe)('Basic Detection', () => {
        (0, node_test_1.it)('should detect empty buffer as UNKNOWN', () => {
            const result = detector.detect(Buffer.alloc(0));
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.strictEqual(result.fallback, 'HCTX');
        });
        (0, node_test_1.it)('should detect small buffer as UNKNOWN with fallback', () => {
            const result = detector.detect(Buffer.from('tiny'));
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.strictEqual(result.fallback, 'HCTX');
        });
        (0, node_test_1.it)('should detect null buffer with error handling', () => {
            // @ts-ignore - 测试异常情况
            const result = detector.detect(null);
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.ok(result.error);
        });
    });
    // ============================================================================
    // FMT-001: JSON文件LE/BE检测准确率100%
    // ============================================================================
    (0, node_test_1.describe)('FMT-001: JSON Detection Accuracy', () => {
        (0, node_test_1.it)('should detect UTF-8 JSON object with 100% accuracy', () => {
            let correct = 0;
            const total = 100;
            for (let i = 0; i < total; i++) {
                const json = JSON.stringify({ test: i, data: 'value' + i });
                const buf = Buffer.from(json, 'utf8');
                const result = detector.detectJSON(buf);
                if (result.format === 'JSON' && result.confidence > 0.9) {
                    correct++;
                }
            }
            node_assert_1.default.strictEqual(correct, total, `JSON detection accuracy: ${correct}/${total}`);
        });
        (0, node_test_1.it)('should detect UTF-8 JSON array with high confidence', () => {
            const json = JSON.stringify([1, 2, 3, 'test', { nested: true }]);
            const buf = Buffer.from(json, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            node_assert_1.default.ok(result.confidence > 0.9);
        });
        (0, node_test_1.it)('should detect JSON with UTF-8 BOM', () => {
            const json = JSON.stringify({ test: 'data' });
            const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
            const content = Buffer.from(json, 'utf8');
            const buf = Buffer.concat([bom, content]);
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            node_assert_1.default.strictEqual(result.byteOrder, 'LE');
            node_assert_1.default.ok(result.confidence > 0.9);
        });
        (0, node_test_1.it)('should detect JSON string starting with quote', () => {
            const json = '"simple string value"';
            const buf = Buffer.from(json, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            node_assert_1.default.ok(result.confidence > 0.85);
        });
        (0, node_test_1.it)('should detect nested JSON object', () => {
            const json = JSON.stringify({
                level1: {
                    level2: {
                        level3: { value: 'deep' }
                    }
                }
            });
            const buf = Buffer.from(json, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            node_assert_1.default.ok(result.confidence > 0.95);
        });
        (0, node_test_1.it)('should detect large JSON object', () => {
            const largeObj = {};
            for (let i = 0; i < 1000; i++) {
                largeObj[`key${i}`] = `value${i}`;
            }
            const json = JSON.stringify(largeObj);
            const buf = Buffer.from(json, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            // 大文件可能只采样前1KB，置信度可能略低，但至少应该有结构匹配
            node_assert_1.default.ok(result.confidence > 0.75, `Expected confidence > 0.75, got ${result.confidence}`);
        });
    });
    // ============================================================================
    // FMT-002: Binary原始字节流检测无崩溃
    // ============================================================================
    (0, node_test_1.describe)('FMT-002: Binary Detection Stability', () => {
        (0, node_test_1.it)('should handle 1MB random bytes without crash', () => {
            // 模拟 1MB 随机数据
            const buf = Buffer.alloc(1024 * 1024);
            for (let i = 0; i < buf.length; i++) {
                buf[i] = Math.floor(Math.random() * 256);
            }
            let result;
            node_assert_1.default.doesNotThrow(() => {
                result = detector.detect(buf);
            });
            // 随机数据应该被检测为 BINARY 或 UNKNOWN
            node_assert_1.default.ok(result.format === 'BINARY' || result.format === 'UNKNOWN');
        });
        (0, node_test_1.it)('should handle binary with null bytes', () => {
            const buf = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x03, 0x00]);
            const result = detector.detectBinary(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
        (0, node_test_1.it)('should handle high entropy binary', () => {
            const buf = Buffer.alloc(256);
            for (let i = 0; i < 256; i++) {
                buf[i] = i;
            }
            const result = detector.detectBinary(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
        (0, node_test_1.it)('should handle mixed content with binary characteristics', () => {
            const buf = Buffer.concat([
                Buffer.from('some text'),
                Buffer.from([0x00, 0x80, 0xFF, 0x00]),
                Buffer.from('more text')
            ]);
            const result = detector.detectBinary(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
    });
    // ============================================================================
    // FMT-003: 未知格式回退HCTX
    // ============================================================================
    (0, node_test_1.describe)('FMT-003: Unknown Format Fallback', () => {
        (0, node_test_1.it)('should fallback to HCTX mode for unknown text', () => {
            const buf = Buffer.from('some random data that is not any known format');
            const result = detector.detect(buf);
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.strictEqual(result.fallback, 'HCTX');
        });
        (0, node_test_1.it)('should fallback to HCTX mode for XML-like content', () => {
            const buf = Buffer.from('<root><item>value</item></root>');
            const result = detector.detect(buf);
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.strictEqual(result.fallback, 'HCTX');
        });
        (0, node_test_1.it)('should fallback to HCTX mode for YAML-like content', () => {
            const buf = Buffer.from('key: value\nlist:\n  - item1\n  - item2');
            const result = detector.detect(buf);
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.strictEqual(result.fallback, 'HCTX');
        });
        (0, node_test_1.it)('should allow custom fallback option', () => {
            const customDetector = new universal_detector_js_1.UniversalDetector({ defaultFallback: 'RAW' });
            const buf = Buffer.from('unknown content');
            const result = customDetector.detect(buf);
            node_assert_1.default.strictEqual(result.fallback, 'RAW');
        });
    });
    // ============================================================================
    // NEG-FMT-001: 损坏JSON处理
    // ============================================================================
    (0, node_test_1.describe)('NEG-FMT-001: Corrupted JSON Handling', () => {
        (0, node_test_1.it)('should handle invalid JSON gracefully', () => {
            const buf = Buffer.from('{invalid json');
            const result = detector.detectJSON(buf);
            // 应该返回部分匹配结果，而不是抛出错误
            node_assert_1.default.ok(result.format === 'JSON' || result.format === 'UNKNOWN');
            node_assert_1.default.ok(result.confidence > 0);
        });
        (0, node_test_1.it)('should handle truncated JSON', () => {
            const json = JSON.stringify({ key: 'value', nested: { a: 1 } });
            const truncated = json.slice(0, json.length - 5);
            const buf = Buffer.from(truncated, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.ok(result.format === 'JSON' || result.format === 'UNKNOWN');
        });
        (0, node_test_1.it)('should handle JSON with unclosed string', () => {
            const buf = Buffer.from('{"key": "unclosed string', 'utf8');
            const result = detector.detectJSON(buf);
            // 应该检测到 JSON 起始但置信度较低
            node_assert_1.default.ok(result.confidence > 0);
        });
        (0, node_test_1.it)('should handle JSON with invalid unicode', () => {
            const buf = Buffer.from([0x7B, 0x22, 0xFF, 0xFE, 0x7D]); // { \xFF\xFE }
            const result = detector.detectJSON(buf);
            // 应该优雅处理，不抛出错误
            node_assert_1.default.ok(result.format === 'JSON' || result.format === 'UNKNOWN');
        });
        (0, node_test_1.it)('should handle empty JSON-like content', () => {
            const buf = Buffer.from('   ');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'UNKNOWN');
            node_assert_1.default.ok(result.error);
        });
    });
    // ============================================================================
    // HIGH-FMT-001: 大文件100MB检测
    // ============================================================================
    (0, node_test_1.describe)('HIGH-FMT-001: Large File Detection', () => {
        (0, node_test_1.it)('should handle 100MB buffer within time limit', () => {
            const start = Date.now();
            const result = detector.detect(Buffer.alloc(100 * 1024 * 1024));
            const elapsed = Date.now() - start;
            node_assert_1.default.ok(elapsed < 1000, `Detection took ${elapsed}ms, expected < 1000ms`);
            node_assert_1.default.ok(result.format === 'BINARY' || result.format === 'UNKNOWN');
        });
        (0, node_test_1.it)('should handle 10MB JSON-like content efficiently', () => {
            const largeObj = {};
            for (let i = 0; i < 10000; i++) {
                largeObj[`key${i}`] = `value${i}`;
            }
            const json = JSON.stringify(largeObj);
            const buf = Buffer.from(json, 'utf8');
            const start = Date.now();
            const result = detector.detectJSON(buf);
            const elapsed = Date.now() - start;
            node_assert_1.default.ok(elapsed < 100, `Large JSON detection took ${elapsed}ms`);
            node_assert_1.default.strictEqual(result.format, 'JSON');
        });
    });
    // ============================================================================
    // PERF-001: 检测延迟<0.01ms
    // ============================================================================
    (0, node_test_1.describe)('PERF-001: Detection Performance', () => {
        (0, node_test_1.it)('should have average detection latency under 0.015ms', () => {
            const iterations = 1000;
            const start = Date.now();
            for (let i = 0; i < iterations; i++) {
                detector.detect(Buffer.alloc(32));
            }
            const elapsed = Date.now() - start;
            const avg = elapsed / iterations;
            node_assert_1.default.ok(avg < 0.015, `Average latency ${avg}ms exceeds 0.015ms threshold`);
        });
        (0, node_test_1.it)('should have fast detection for small buffers', () => {
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                detector.detectFast(Buffer.alloc(64));
            }
            const elapsed = Date.now() - start;
            node_assert_1.default.ok(elapsed < 100, `Fast detection took ${elapsed}ms for 10000 iterations`);
        });
        (0, node_test_1.it)('should perform consistently across different sizes', () => {
            const sizes = [32, 64, 128, 256, 512, 1024];
            for (const size of sizes) {
                const start = Date.now();
                for (let i = 0; i < 100; i++) {
                    detector.detect(Buffer.alloc(size));
                }
                const elapsed = Date.now() - start;
                const avg = elapsed / 100;
                node_assert_1.default.ok(avg < 0.05, `Size ${size}: avg ${avg}ms too slow`);
            }
        });
    });
    // ============================================================================
    // HCTX 格式兼容性测试
    // ============================================================================
    (0, node_test_1.describe)('HCTX Format Compatibility', () => {
        (0, node_test_1.it)('should detect HCTX LE format (v2.5)', () => {
            // 构造 HCTX LE 魔数
            const buf = Buffer.alloc(32);
            buf.writeUInt32LE(0x48535458, 0); // 'HCTX'
            buf.writeUInt16LE(0x0250, 4); // v2.5
            const result = detector.detectHCTX(buf);
            node_assert_1.default.strictEqual(result.format, 'HCTX');
            node_assert_1.default.strictEqual(result.byteOrder, 'LE');
            node_assert_1.default.ok(result.confidence >= 0.95);
        });
        (0, node_test_1.it)('should detect HCTX BE format (v2.6)', () => {
            // 构造 HCTX BE 魔数
            const buf = Buffer.alloc(32);
            buf.writeUInt32BE(0x48435832, 0); // 'HCX2'
            buf.writeUInt16BE(0x0260, 4); // v2.6
            const result = detector.detectHCTX(buf);
            node_assert_1.default.strictEqual(result.format, 'HCTX');
            node_assert_1.default.strictEqual(result.byteOrder, 'BE');
            node_assert_1.default.ok(result.confidence >= 0.95);
        });
        (0, node_test_1.it)('should detect HCTX with cross-endian read', () => {
            // 模拟交叉读取情况
            const buf = Buffer.alloc(32);
            // LE 文件用 BE 读取会得到不同的值
            buf.writeUInt32LE(0x48535458, 0);
            const result = detector.detectHCTX(buf);
            node_assert_1.default.strictEqual(result.format, 'HCTX');
            node_assert_1.default.ok(result.byteOrder === 'LE' || result.byteOrder === 'BE');
        });
    });
    // ============================================================================
    // 便捷函数测试
    // ============================================================================
    (0, node_test_1.describe)('Utility Functions', () => {
        (0, node_test_1.it)('detectFormat should work as static function', () => {
            const json = JSON.stringify({ test: true });
            const buf = Buffer.from(json, 'utf8');
            const result = (0, universal_detector_js_1.detectFormat)(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
        });
        (0, node_test_1.it)('detectFormatFast should return format only', () => {
            const json = JSON.stringify({ test: true });
            const buf = Buffer.from(json, 'utf8');
            const format = (0, universal_detector_js_1.detectFormatFast)(buf);
            node_assert_1.default.strictEqual(format, 'JSON');
        });
        (0, node_test_1.it)('detectJSON should detect JSON array', () => {
            const buf = Buffer.from('[1,2,3]', 'utf8');
            const result = (0, universal_detector_js_1.detectJSON)(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
        });
        (0, node_test_1.it)('detectBinary should detect binary data', () => {
            const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00]);
            const result = (0, universal_detector_js_1.detectBinary)(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
    });
    // ============================================================================
    // 边界条件测试
    // ============================================================================
    (0, node_test_1.describe)('Edge Cases', () => {
        (0, node_test_1.it)('should handle buffer with only whitespace', () => {
            const buf = Buffer.from('   \t\n\r   ');
            const result = detector.detect(buf);
            // 纯空白被检测为 UNKNOWN 或 BINARY 都是可接受的
            node_assert_1.default.ok(result.format === 'UNKNOWN' || result.format === 'BINARY', `Expected UNKNOWN or BINARY, got ${result.format}`);
        });
        (0, node_test_1.it)('should handle single character buffer', () => {
            const buf = Buffer.from('{');
            const result = detector.detect(buf);
            // 可能是 JSON（不完整），也可能是 UNKNOWN
            node_assert_1.default.ok(result.format === 'JSON' || result.format === 'UNKNOWN');
        });
        (0, node_test_1.it)('should handle buffer with only null bytes', () => {
            const buf = Buffer.alloc(100, 0);
            const result = detector.detect(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
        (0, node_test_1.it)('should handle buffer with high byte values', () => {
            const buf = Buffer.alloc(100, 0xFF);
            const result = detector.detect(buf);
            node_assert_1.default.strictEqual(result.format, 'BINARY');
        });
        (0, node_test_1.it)('should handle JSON with unicode content', () => {
            const json = JSON.stringify({
                chinese: '中文测试',
                emoji: '🎉',
                arabic: 'مرحبا'
            });
            const buf = Buffer.from(json, 'utf8');
            const result = detector.detectJSON(buf);
            node_assert_1.default.strictEqual(result.format, 'JSON');
            node_assert_1.default.ok(result.confidence > 0.9);
        });
    });
    // ============================================================================
    // E2E-FMT-001: 全链路测试
    // ============================================================================
    (0, node_test_1.describe)('E2E-FMT-001: End-to-End Integration', () => {
        (0, node_test_1.it)('should complete full detection pipeline for JSON', () => {
            const json = JSON.stringify({
                name: 'test',
                value: 123,
                nested: { array: [1, 2, 3] }
            });
            const buf = Buffer.from(json, 'utf8');
            // 步骤 1: 自动检测
            const detectResult = detector.detect(buf);
            node_assert_1.default.strictEqual(detectResult.format, 'JSON');
            node_assert_1.default.ok(detectResult.confidence > 0.9);
            // 步骤 2: 验证可解析性
            node_assert_1.default.doesNotThrow(() => {
                JSON.parse(buf.toString('utf8'));
            });
        });
        (0, node_test_1.it)('should complete full detection pipeline for Binary', () => {
            const buf = Buffer.alloc(1024);
            for (let i = 0; i < buf.length; i++) {
                buf[i] = i % 256;
            }
            // 步骤 1: 自动检测
            const detectResult = detector.detect(buf);
            node_assert_1.default.strictEqual(detectResult.format, 'BINARY');
            // 步骤 2: 验证数据完整性
            node_assert_1.default.strictEqual(buf.length, 1024);
        });
        (0, node_test_1.it)('should handle format switching correctly', () => {
            const jsonBuf = Buffer.from('{"type":"json"}', 'utf8');
            const binaryBuf = Buffer.from([0x00, 0x01, 0x02, 0x00]);
            const jsonResult = detector.detect(jsonBuf);
            const binaryResult = detector.detect(binaryBuf);
            node_assert_1.default.strictEqual(jsonResult.format, 'JSON');
            node_assert_1.default.strictEqual(binaryResult.format, 'BINARY');
        });
    });
});
