/**
 * SimHash LSH (Locality Sensitive Hashing) Index
 *
 * 解决 RISK-H-003: "查邻居"爆炸问题
 *
 * 原方案问题：
 * - 对每个 chunk 枚举 2081 个邻居（C(64,0)+C(64,1)+C(64,2)）
 * - TB级（1e8 chunks）时总 lookup = 2.081e11次
 *
 * 本方案：
 * - 将64位simhash切成4段16位，建立4个倒排索引
 * - 查询复杂度从 O(2081) 降至 O(1) ~ O(k)，k为平均桶大小
 * - 假阴性率为 0%（只要汉明距离<3，必在同一桶中）
 *
 * 数学保证：
 * - 4段16位，汉明距离 < 3 的两个simhash
 * - 至少有一段完全相同（鸽巢原理：3位变化无法影响全部4段）
 * - 因此通过并集查询不会漏检
 *
 * @module simhash-lsh-index
 */
import { SimHashValue, ChunkHashV2 } from './simhash-chunker.js';
/**
 * 段索引类型 - 16位段值映射到 chunk ID 列表
 */
export type SegmentIndex = Map<number, number[]>;
/**
 * LSH 索引配置
 */
export interface LshIndexConfig {
    /** 段数，默认 4（4段 × 16位） */
    numSegments: number;
    /** 每段位宽，默认 16 */
    bitsPerSegment: number;
    /** 汉明距离阈值，默认 3 */
    hammingThreshold: number;
    /** 是否启用内存优化（使用 Uint32Array 替代数组） */
    memoryOptimized: boolean;
}
/**
 * 候选检索结果
 */
export interface CandidateResult {
    /** 候选 chunk ID */
    chunkId: number;
    /** 汉明距离（已预计算） */
    distance: number;
}
/**
 * 查询统计（用于性能监控）
 */
export interface QueryStats {
    /** 本次查询的 lookup 次数 */
    lookups: number;
    /** 候选集大小 */
    candidateCount: number;
    /** 精确 popcnt 验证次数 */
    popcntChecks: number;
    /** 查询耗时 (ms) */
    durationMs: number;
}
/**
 * 索引统计
 */
export interface IndexStats {
    /** 总条目数 */
    totalEntries: number;
    /** 段统计 */
    segments: {
        segmentIndex: number;
        uniqueKeys: number;
        avgBucketSize: number;
        maxBucketSize: number;
    }[];
    /** 内存估算（字节） */
    estimatedMemoryBytes: number;
}
/** 默认配置：4段 × 16位 */
export declare const DEFAULT_LSH_CONFIG: LshIndexConfig;
/** 替代配置：8段 × 8位（更细粒度，适合大规模数据） */
export declare const LSH_CONFIG_8SEG: LshIndexConfig;
/**
 * 将64位 SimHash 分割成多段
 *
 * 例如：4段 × 16位
 * - seg[0] = bits 63-48 (高16位)
 * - seg[1] = bits 47-32
 * - seg[2] = bits 31-16
 * - seg[3] = bits 15-0  (低16位)
 *
 * @param simhash - 64位 SimHash 值
 * @param numSegments - 段数
 * @param bitsPerSegment - 每段位宽
 * @returns 段值数组
 */
export declare function splitIntoSegments(simhash: SimHashValue, numSegments?: number, bitsPerSegment?: number): number[];
/**
 * 4段16位分割（快速路径）
 *
 * @param simhash - 64位 SimHash 值
 * @returns 4个16位段值
 */
export declare function splitInto4Segments(simhash: SimHashValue): [number, number, number, number];
/**
 * 8段8位分割（快速路径）
 *
 * @param simhash - 64位 SimHash 值
 * @returns 8个8位段值
 */
export declare function splitInto8Segments(simhash: SimHashValue): number[];
/**
 * LSH 索引 - 多段倒排索引实现
 *
 * 核心设计：
 * 1. 将64位simhash分成多段（默认4段×16位）
 * 2. 每段建立独立的倒排索引: segmentValue -> chunkIds[]
 * 3. 查询时取所有段的并集作为候选集
 * 4. 对候选集做精确popcnt验证
 *
 * 数学保证（假阴性率 = 0%）：
 * - 对于汉明距离 d < 3 的两个simhash a, b
 * - 根据鸽巢原理：d位差异最多影响 d 个段
 * - 当 numSegments = 4, d < 3 时，至少存在 4-d >= 2 个段相同
 * - 因此查询时的并集操作一定能捕获到相似项
 */
export declare class LshIndex {
    private config;
    private segments;
    private chunks;
    private nextChunkId;
    private queryCount;
    private totalLookups;
    /**
     * 创建 LSH 索引
     *
     * @param config - 索引配置，使用默认配置覆盖
     */
    constructor(config?: Partial<LshIndexConfig>);
    /**
     * 添加 chunk 到索引
     *
     * @param chunk - ChunkHashV2 对象
     * @returns 分配的 chunk ID
     */
    add(chunk: ChunkHashV2): number;
    /**
     * 批量添加 chunks
     *
     * @param chunks - ChunkHashV2 数组
     * @returns 分配的 chunk ID 数组
     */
    addBatch(chunks: ChunkHashV2[]): number[];
    /**
     * 查询相似候选
     *
     * 算法：
     * 1. 将查询 simhash 分割成段
     * 2. 从每个段索引中获取候选 chunk IDs
     * 3. 取并集作为候选集
     * 4. 对候选集做精确汉明距离验证
     * 5. 返回满足阈值的结果
     *
     * @param simhash - 查询 SimHash
     * @param threshold - 汉明距离阈值（默认从配置）
     * @param stats - 可选的统计对象
     * @returns 相似候选列表（已按距离排序）
     */
    query(simhash: SimHashValue, threshold?: number, stats?: QueryStats): CandidateResult[];
    /**
     * 快速检查是否存在相似 chunk（存在性查询）
     *
     * @param simhash - 查询 SimHash
     * @param threshold - 汉明距离阈值
     * @returns 是否存在相似 chunk
     */
    hasSimilar(simhash: SimHashValue, threshold?: number): boolean;
    /**
     * 根据 chunk ID 获取 chunk 数据
     *
     * @param chunkId - chunk ID
     * @returns ChunkHashV2 或 undefined
     */
    getChunk(chunkId: number): ChunkHashV2 | undefined;
    /**
     * 获取索引中的总条目数
     */
    size(): number;
    /**
     * 获取索引统计信息
     */
    getStats(): IndexStats;
    /**
     * 获取查询统计
     */
    getQueryStats(): {
        totalQueries: number;
        avgLookupsPerQuery: number;
    };
    /**
     * 清空索引
     */
    clear(): void;
    /**
     * 数学正确性验证
     *
     * 验证 LSH 索引的关键性质：
     * 对于汉明距离 < threshold 的任意两个 simhash，
     * 查询时一定会被包含在候选集中（无假阴性）
     *
     * @param a - SimHash A
     * @param b - SimHash B
     * @returns 是否满足 LSH 保证
     */
    verifyLshGuarantee(a: SimHashValue, b: SimHashValue): boolean;
}
/**
 * 创建 LSH 索引（工厂函数）
 *
 * @param config - 可选配置
 * @returns 新的 LSH 索引实例
 */
export declare function createIndex(config?: Partial<LshIndexConfig>): LshIndex;
/**
 * 创建内存优化版 LSH 索引
 *
 * 使用更紧凑的存储结构，适合大规模数据
 *
 * @returns 内存优化版 LSH 索引
 */
export declare function createMemoryOptimizedIndex(): LshIndex;
/**
 * 计算理论候选检索次数对比
 *
 * @param numChunks - chunk 数量
 * @returns 对比数据
 */
export declare function compareLookupComplexity(numChunks: number): {
    naive: number;
    lsh4: number;
    lsh8: number;
    speedup4: number;
    speedup8: number;
};
/**
 * 估算 TB 级场景处理时间
 *
 * @param tbSize - TB 数量
 * @param chunkSize - 平均 chunk 大小（字节）
 * @param lookupTimeNs - 单次 lookup 耗时（纳秒）
 * @returns 处理时间估算（分钟）
 */
export declare function estimateProcessingTime(tbSize?: number, chunkSize?: number, lookupTimeNs?: number): {
    totalChunks: number;
    naiveMinutes: number;
    lshMinutes: number;
    speedup: number;
};
declare const _default: {
    LshIndex: typeof LshIndex;
    createIndex: typeof createIndex;
    createMemoryOptimizedIndex: typeof createMemoryOptimizedIndex;
    splitIntoSegments: typeof splitIntoSegments;
    splitInto4Segments: typeof splitInto4Segments;
    splitInto8Segments: typeof splitInto8Segments;
    compareLookupComplexity: typeof compareLookupComplexity;
    estimateProcessingTime: typeof estimateProcessingTime;
    DEFAULT_LSH_CONFIG: LshIndexConfig;
    LSH_CONFIG_8SEG: LshIndexConfig;
};
export default _default;
//# sourceMappingURL=simhash-lsh-index.d.ts.map