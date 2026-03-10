/**
 * simhash-wasm.ts - B-01: SimHash WASM封装+降级 (≤200行)
 * 提供统一API，自动选择WASM SIMD或JS实现
 */
export type SimHashBackend = 'wasm' | 'js' | 'auto';
export interface SimHashOptions {
    backend?: SimHashBackend;
    dimensions?: number;
}
export declare class SimHashWasm {
    private loader;
    private backend;
    private initialized;
    private dimensions;
    constructor(options?: SimHashOptions);
    /** 初始化 */
    init(): Promise<void>;
    /** 计算向量哈希 */
    hash(vector: Float32Array): Uint8Array;
    private wasmHash;
    private jsHash;
    private hashSingle;
    /** 汉明距离 */
    distance(a: Uint8Array, b: Uint8Array): number;
    /** 批量距离计算 */
    batchDistance(query: Uint8Array, candidates: Uint8Array[]): number[];
    /** 查找相似项 */
    findSimilar(query: Uint8Array, candidates: Uint8Array[], threshold?: number): number[];
    /** 当前后端 */
    get currentBackend(): string;
    /** 是否使用WASM */
    get isWasm(): boolean;
    /** 降级到JS */
    fallbackToJs(): void;
}
export declare function createSimHash(options?: SimHashOptions): Promise<SimHashWasm>;
export default SimHashWasm;
//# sourceMappingURL=simhash-wasm.d.ts.map