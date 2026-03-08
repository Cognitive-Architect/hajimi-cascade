/**
 * CASCADE-SHA256 类型定义 (Hash Type 0x03)
 *
 * 工单: B-08/09 UPGRADE-ROADMAP-001
 * 安全级别: 宇宙级 (2^-256 冲突率)
 *
 * @module hash-v3
 */
/**
 * CASCADE_SHA256 hash type identifier
 *
 * 0x03: SimHash-64 + SHA256-256 (48B entry)
 */
export declare const CASCADE_SHA256 = 3;
/**
 * SHA256 entry size in bytes
 *
 * 结构: SimHash-64 (8B) + SHA256-256 (32B) + length (4B) + seed (4B) = 48B
 */
export declare const SHA256_ENTRY_SIZE = 48;
/**
 * 各字段偏移量定义
 */
export declare const OFFSETS: {
    readonly SIMHASH: 0;
    readonly SHA256: 8;
    readonly LENGTH: 40;
    readonly SEED: 44;
};
/**
 * 各字段大小定义
 */
export declare const SIZES: {
    readonly SIMHASH: 8;
    readonly SHA256: 32;
    readonly LENGTH: 4;
    readonly SEED: 4;
};
/**
 * ChunkHashV3 - SHA256 级联哈希条目
 *
 * 结构体布局 (大端序 - RISK-H-007):
 * ```
 * offset 0-7:   simhash (uint64 BE)  - SimHash-64 指纹
 * offset 8-39:  sha256 (32 bytes)    - SHA256-256 哈希
 * offset 40-43: length (uint32 BE)   - Chunk 原始数据长度
 * offset 44-47: seed (uint32 BE)     - 哈希种子/配置标识
 * ```
 * 总计: 48 bytes
 */
export interface ChunkHashV3 {
    /** SimHash-64 指纹 (8 bytes, offset 0-7) */
    simhash: bigint;
    /** SHA256-256 哈希 (32 bytes, offset 8-39) */
    sha256: Buffer;
    /** Chunk 原始数据长度 (4 bytes, offset 40-43) */
    length: number;
    /** 哈希种子/配置标识 (4 bytes, offset 44-47) */
    seed: number;
}
/**
 * ChunkHashV3 元数据 (不包含实际哈希值)
 */
export interface ChunkHashV3Meta {
    length: number;
    seed: number;
}
/**
 * 创建空的 ChunkHashV3 对象
 *
 * @returns 初始化为零值的 ChunkHashV3
 */
export declare function createEmptyChunkHashV3(): ChunkHashV3;
/**
 * 序列化 ChunkHashV3 为 Buffer
 *
 * @param chunk - ChunkHashV3 对象
 * @returns 48 字节 Buffer
 */
export declare function serializeChunkHashV3(chunk: ChunkHashV3): Buffer;
/**
 * 从 Buffer 反序列化 ChunkHashV3
 *
 * @param buf - 输入缓冲区（至少 48 字节）
 * @returns ChunkHashV3 对象
 * @throws Error 如果缓冲区大小不足
 */
export declare function deserializeChunkHashV3(buf: Buffer): ChunkHashV3;
/**
 * 验证 ChunkHashV3 对象的有效性
 *
 * @param chunk - 待验证的对象
 * @returns 验证结果
 */
export declare function validateChunkHashV3(chunk: ChunkHashV3): {
    valid: boolean;
    errors: string[];
};
/**
 * 计算 ChunkHashV3 的字符串表示（用于调试）
 *
 * @param chunk - ChunkHashV3 对象
 * @returns 人类可读的字符串
 */
export declare function chunkHashV3ToString(chunk: ChunkHashV3): string;
/**
 * 比较两个 ChunkHashV3 是否相等
 *
 * @param a - 第一个 ChunkHashV3
 * @param b - 第二个 ChunkHashV3
 * @returns 是否相等
 */
export declare function equalChunkHashV3(a: ChunkHashV3, b: ChunkHashV3): boolean;
declare const _default: {
    CASCADE_SHA256: number;
    SHA256_ENTRY_SIZE: number;
    OFFSETS: {
        readonly SIMHASH: 0;
        readonly SHA256: 8;
        readonly LENGTH: 40;
        readonly SEED: 44;
    };
    SIZES: {
        readonly SIMHASH: 8;
        readonly SHA256: 32;
        readonly LENGTH: 4;
        readonly SEED: 4;
    };
    createEmptyChunkHashV3: typeof createEmptyChunkHashV3;
    serializeChunkHashV3: typeof serializeChunkHashV3;
    deserializeChunkHashV3: typeof deserializeChunkHashV3;
    validateChunkHashV3: typeof validateChunkHashV3;
    chunkHashV3ToString: typeof chunkHashV3ToString;
    equalChunkHashV3: typeof equalChunkHashV3;
};
export default _default;
//# sourceMappingURL=hash-v3.d.ts.map