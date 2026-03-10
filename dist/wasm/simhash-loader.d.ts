/**
 * simhash-loader.ts - B-01: WASM运行时绑定 (≤150行)
 * 负责WASM模块加载、内存管理、JS回退
 */
export interface WasmExports {
    memory: WebAssembly.Memory;
    hamming_distance: (q: number, c: number) => number;
    batch_distance: (q: number, cand: number, n: number, out: number) => void;
    filter_candidates: (q: number, cand: number, n: number, thresh: number, matches: number) => number;
    hash_equals: (a: number, b: number) => number;
    simd_supported: () => number;
}
export declare class SimHashWasmLoader {
    private wasm?;
    private exports?;
    private memory?;
    private useWasm;
    /** 检测环境是否支持WASM SIMD */
    static supportsSimd(): Promise<boolean>;
    /** 初始化WASM模块 */
    init(wasmPath?: string): Promise<boolean>;
    /** 分配内存 */
    alloc(size: number): number;
    /** 写入哈希数据 */
    writeHash(ptr: number, hash: Uint8Array): void;
    /** 汉明距离 (WASM或JS回退) */
    hammingDistance(a: Uint8Array, b: Uint8Array): number;
    /** JS回退实现 */
    private jsHammingDistance;
    private popcnt;
    /** 批量距离计算 */
    batchDistance(query: Uint8Array, candidates: Uint8Array[]): number[];
    get isWasmReady(): boolean;
}
export default SimHashWasmLoader;
//# sourceMappingURL=simhash-loader.d.ts.map