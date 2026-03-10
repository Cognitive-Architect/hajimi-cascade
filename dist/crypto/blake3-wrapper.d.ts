/**
 * blake3-wrapper.ts - B-02: BLAKE3真实现 (≤80行)
 * @debt BLAKE3-v2.9.1-001: 已清偿，现为真BLAKE3
 */
export declare class Blake3Wrapper {
    private hasher?;
    constructor();
    /** 重置哈希状态 */
    reset(): void;
    /** 增量更新数据 */
    update(data: Buffer | string): this;
    /** 计算最终哈希值 */
    digest(): Buffer;
    /** 计算十六进制哈希 */
    digestHex(): string;
    /** 静态一次性哈希 */
    static hash(data: Buffer | string): Buffer;
    /** 静态十六进制哈希 */
    static hashHex(data: Buffer | string): string;
}
/** 便捷函数: 一次性哈希 */
export declare function blake3Hash(data: Buffer | string): Buffer;
/** 便捷函数: 十六进制哈希 */
export declare function blake3HashHex(data: Buffer | string): string;
export default Blake3Wrapper;
//# sourceMappingURL=blake3-wrapper.d.ts.map