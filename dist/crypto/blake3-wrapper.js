"use strict";
/**
 * blake3-wrapper.ts - B-02: BLAKE3真实现 (≤80行)
 * @debt BLAKE3-v2.9.1-001: 已清偿，现为真BLAKE3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blake3Wrapper = void 0;
exports.blake3Hash = blake3Hash;
exports.blake3HashHex = blake3HashHex;
const blake3_jit_1 = require("blake3-jit");
class Blake3Wrapper {
    constructor() {
        this.reset();
    }
    /** 重置哈希状态 */
    reset() {
        this.hasher = undefined;
    }
    /** 增量更新数据 */
    update(data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (!this.hasher) {
            this.hasher = (0, blake3_jit_1.createHasher)();
        }
        this.hasher.update(buf);
        return this;
    }
    /** 计算最终哈希值 */
    digest() {
        if (!this.hasher) {
            return Buffer.from((0, blake3_jit_1.hash)(Buffer.alloc(0)));
        }
        return Buffer.from(this.hasher.finalize());
    }
    /** 计算十六进制哈希 */
    digestHex() {
        return this.digest().toString('hex');
    }
    /** 静态一次性哈希 */
    static hash(data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        return Buffer.from((0, blake3_jit_1.hash)(buf));
    }
    /** 静态十六进制哈希 */
    static hashHex(data) {
        return Blake3Wrapper.hash(data).toString('hex');
    }
}
exports.Blake3Wrapper = Blake3Wrapper;
/** 便捷函数: 一次性哈希 */
function blake3Hash(data) {
    return Blake3Wrapper.hash(data);
}
/** 便捷函数: 十六进制哈希 */
function blake3HashHex(data) {
    return Blake3Wrapper.hashHex(data);
}
exports.default = Blake3Wrapper;
//# sourceMappingURL=blake3-wrapper.js.map