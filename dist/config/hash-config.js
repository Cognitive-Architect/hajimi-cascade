"use strict";
/**
 * hash-config.ts - B-03: 哈希配置集成 (≤80行)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HASH_CONFIG = void 0;
exports.loadHashConfig = loadHashConfig;
exports.applyHashConfig = applyHashConfig;
exports.validateConfig = validateConfig;
const hash_factory_1 = require("../crypto/hash-factory");
exports.DEFAULT_HASH_CONFIG = {
    strategy: 'auto',
    enableBlake3: true,
    backwardCompat: true,
};
/** 从环境变量加载配置 */
function loadHashConfig() {
    return {
        strategy: process.env.HASH_STRATEGY || 'auto',
        enableBlake3: process.env.ENABLE_BLAKE3 !== 'false',
        backwardCompat: process.env.BACKWARD_COMPAT !== 'false',
    };
}
/** 应用配置，返回策略实例 */
function applyHashConfig(config = {}) {
    const cfg = { ...exports.DEFAULT_HASH_CONFIG, ...config };
    const strategy = (0, hash_factory_1.createHashStrategy)(cfg.strategy);
    return { config: cfg, strategy };
}
/** 配置验证 */
function validateConfig(cfg) {
    return ['legacy', 'modern', 'auto'].includes(cfg.strategy);
}
exports.default = { loadHashConfig, applyHashConfig, DEFAULT_HASH_CONFIG: exports.DEFAULT_HASH_CONFIG };
//# sourceMappingURL=hash-config.js.map