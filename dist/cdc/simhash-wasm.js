"use strict";
/**
 * simhash-wasm.ts - B-01: SimHash WASM封装+降级 (≤200行)
 * 提供统一API，自动选择WASM SIMD或JS实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimHashWasm = void 0;
exports.createSimHash = createSimHash;
const simhash_loader_1 = require("../wasm/simhash-loader");
const crypto_1 = require("crypto");
class SimHashWasm {
    constructor(options = {}) {
        this.backend = 'js';
        this.initialized = false;
        this.dimensions = 128;
        this.loader = new simhash_loader_1.SimHashWasmLoader();
        this.backend = options.backend || 'auto';
        this.dimensions = options.dimensions || 128;
    }
    /** 初始化 */
    async init() {
        if (this.initialized)
            return;
        if (this.backend === 'auto') {
            const wasmOk = await this.loader.init();
            this.backend = wasmOk ? 'wasm' : 'js';
        }
        else if (this.backend === 'wasm') {
            const ok = await this.loader.init();
            if (!ok)
                throw new Error('WASM init failed and no fallback allowed');
        }
        this.initialized = true;
        console.log(`SimHash backend: ${this.backend}`);
    }
    /** 计算向量哈希 */
    hash(vector) {
        if (!this.initialized)
            throw new Error('Not initialized');
        if (this.backend === 'wasm' && this.loader.isWasmReady) {
            return this.wasmHash(vector);
        }
        return this.jsHash(vector);
    }
    wasmHash(vector) {
        // 简化: 投影到128位
        const result = new Uint8Array(16);
        for (let i = 0; i < this.dimensions && i < vector.length; i++) {
            const byteIdx = Math.floor(i / 8);
            const bitIdx = i % 8;
            if (vector[i] > 0) {
                result[byteIdx] |= (1 << bitIdx);
            }
        }
        return result;
    }
    jsHash(vector) {
        // 标准SimHash算法
        const bits = new Int32Array(this.dimensions);
        // 加权累加
        for (let i = 0; i < vector.length; i++) {
            const hash = this.hashSingle(vector[i]);
            for (let b = 0; b < this.dimensions; b++) {
                bits[b] += (hash & (1 << b)) ? vector[i] : -vector[i];
            }
        }
        // 生成指纹
        const result = new Uint8Array(16);
        for (let b = 0; b < this.dimensions; b++) {
            if (bits[b] > 0) {
                result[Math.floor(b / 8)] |= (1 << (b % 8));
            }
        }
        return result;
    }
    hashSingle(val) {
        const buf = Buffer.alloc(4);
        buf.writeFloatLE(val, 0);
        return (0, crypto_1.createHash)('md5').update(buf).digest().readUInt32LE(0);
    }
    /** 汉明距离 */
    distance(a, b) {
        if (!this.initialized)
            throw new Error('Not initialized');
        return this.loader.hammingDistance(a, b);
    }
    /** 批量距离计算 */
    batchDistance(query, candidates) {
        if (!this.initialized)
            throw new Error('Not initialized');
        return this.loader.batchDistance(query, candidates);
    }
    /** 查找相似项 */
    findSimilar(query, candidates, threshold = 3) {
        const distances = this.batchDistance(query, candidates);
        const matches = [];
        for (let i = 0; i < distances.length; i++) {
            if (distances[i] <= threshold) {
                matches.push(i);
            }
        }
        return matches;
    }
    /** 当前后端 */
    get currentBackend() {
        return this.backend;
    }
    /** 是否使用WASM */
    get isWasm() {
        return this.backend === 'wasm' && this.loader.isWasmReady;
    }
    /** 降级到JS */
    fallbackToJs() {
        this.backend = 'js';
        console.log('Fallback to JS backend');
    }
}
exports.SimHashWasm = SimHashWasm;
// 便捷函数
async function createSimHash(options) {
    const sh = new SimHashWasm(options);
    await sh.init();
    return sh;
}
exports.default = SimHashWasm;
//# sourceMappingURL=simhash-wasm.js.map