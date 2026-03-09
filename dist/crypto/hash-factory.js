"use strict";
/**
 * hash-factory.ts - B-03: 哈希策略工厂 (≤120行)
 * 支持MD5(v2.8兼容)和BLAKE3(v2.9新)双模式
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHashStrategy = createHashStrategy;
exports.detectVersion = detectVersion;
exports.crossVerify = crossVerify;
const blake3_wrapper_1 = require("./blake3-wrapper");
const crypto_1 = require("crypto");
/** 传统MD5策略(v2.8兼容) */
class LegacyStrategy {
    constructor() {
        this.algorithm = 'md5';
    }
    hash(data) {
        return new Uint8Array((0, crypto_1.createHash)('md5').update(data).digest());
    }
    hashHex(data) {
        return (0, crypto_1.createHash)('md5').update(data).digest('hex');
    }
}
/** 现代BLAKE3策略(v2.9) */
class ModernStrategy {
    constructor() {
        this.algorithm = 'blake3';
    }
    hash(data) {
        return (0, blake3_wrapper_1.blake3Hash)(Buffer.from(data));
    }
    hashHex(data) {
        return (0, blake3_wrapper_1.blake3HashHex)(Buffer.from(data));
    }
}
/** 自动选择策略 */
class AutoStrategy {
    constructor() {
        this.algorithm = 'auto';
        this.useModern = true;
    }
    hash(data) {
        return this.useModern ? (0, blake3_wrapper_1.blake3Hash)(Buffer.from(data)) : new LegacyStrategy().hash(data);
    }
    hashHex(data) {
        return this.useModern ? (0, blake3_wrapper_1.blake3HashHex)(Buffer.from(data)) : new LegacyStrategy().hashHex(data);
    }
}
/** 策略工厂 */
function createHashStrategy(strategy = 'auto') {
    switch (strategy) {
        case 'legacy': return new LegacyStrategy();
        case 'modern': return new ModernStrategy();
        case 'auto': return new AutoStrategy();
        default: return new AutoStrategy();
    }
}
/** 版本检测 */
function detectVersion(hashHex) {
    if (hashHex.length === 32)
        return 'v2.8';
    if (hashHex.length === 64)
        return 'v2.9';
    return 'unknown';
}
/** 交叉验证 */
function crossVerify(data) {
    const md5 = (0, crypto_1.createHash)('md5').update(data).digest('hex');
    const b3 = (0, blake3_wrapper_1.blake3HashHex)(Buffer.from(data));
    return { md5, blake3: b3, match: false };
}
exports.default = { createHashStrategy, detectVersion, crossVerify };
//# sourceMappingURL=hash-factory.js.map