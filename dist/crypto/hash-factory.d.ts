/**
 * hash-factory.ts - B-03: 哈希策略工厂 (≤120行)
 * 支持MD5(v2.8兼容)和BLAKE3(v2.9新)双模式
 */
export type HashAlgorithm = 'md5' | 'blake3' | 'auto';
export type HashStrategy = 'legacy' | 'modern' | 'auto';
export interface HashFactory {
    hash(data: Uint8Array): Uint8Array;
    hashHex(data: Uint8Array): string;
    algorithm: HashAlgorithm;
}
/** 策略工厂 */
export declare function createHashStrategy(strategy?: HashStrategy): HashFactory;
/** 版本检测 */
export declare function detectVersion(hashHex: string): 'v2.8' | 'v2.9' | 'unknown';
/** 交叉验证 */
export declare function crossVerify(data: Uint8Array): {
    md5: string;
    blake3: string;
    match: boolean;
};
declare const _default: {
    createHashStrategy: typeof createHashStrategy;
    detectVersion: typeof detectVersion;
    crossVerify: typeof crossVerify;
};
export default _default;
//# sourceMappingURL=hash-factory.d.ts.map