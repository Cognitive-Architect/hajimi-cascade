/**
 * MATH-001: SimHash Mathematical Constraints
 *
 * 解决候选检索爆炸问题（RISK-H-003）
 * 实现高维向量（>768维）的候选集大小限制
 *
 * 数学原理：
 * 1. 鸽巢原理：汉明距离 d < threshold 时，至少存在 (segments - d) 个相同段
 * 2. 概率上界：候选集大小期望 E[|C|] <= N * P(碰撞)
 * 3. 大数定律：当 N > 100K 时，使用分段限制避免内存爆炸
 *
 * @module simhash-math
 * Wave 3: MATH-001 SimHash数学地狱
 */
/** 64位掩码 */
export declare const UINT64_MASK = 18446744073709551615n;
/** 汉明距离阈值 - MATH-001分析：h=3是最优选择 */
export declare const HAMMING_THRESHOLD = 3;
/** 默认文件级种子 */
export declare const DEFAULT_FILE_SEED = 539296289;
/** 候选集大小硬限制 - MATH-001核心参数 */
export declare const CANDIDATE_LIMIT = 100;
/** 高维向量阈值 - 超过此值启用限制 */
export declare const HIGH_DIMENSION_THRESHOLD = 768;
/** SimHash类型 */
export type SimHashValue = bigint;
/**
 * 计算64位BigInt的汉明权重
 * MATH-001：分段计算避免BigInt性能问题
 */
export declare function popcnt64(value: SimHashValue): number;
/**
 * 计算汉明距离
 */
export declare function hammingDistance(a: SimHashValue, b: SimHashValue): number;
/**
 * 检查相似性
 */
export declare function isSimilar(a: SimHashValue, b: SimHashValue, threshold?: number): boolean;
/**
 * MATH-001: 候选集大小限制器
 *
 * 数学保证：
 * - 当维度 > 768 时，强制限制候选集大小
 * - 使用优先级队列保留最优候选（汉明距离最小）
 * - 保证返回的候选数 <= limit
 */
export declare class CandidateLimiter {
    private limit;
    private highDimThreshold;
    constructor(limit?: number, highDimThreshold?: number);
    /**
     * 是否需要限制候选集
     * MATH-001：基于维度决定
     */
    shouldLimit(dimensions: number): boolean;
    /**
     * 限制候选集大小
     *
     * 算法：
     * 1. 如果候选数 <= limit，直接返回
     * 2. 否则按汉明距离排序，取前 limit 个
     * 3. 时间复杂度 O(N log N)，N为候选数
     *
     * @param candidates - 候选列表 [(id, distance)]
     * @returns 限制后的候选列表
     */
    limitCandidates<T extends {
        id: number;
        distance: number;
    }>(candidates: T[]): T[];
    /**
     * MATH-001: 冲突概率计算
     *
     * 对于64位SimHash，假设均匀分布：
     * - 两个随机simhash的汉明距离 < 3 的概率：
     * - P(d < 3) = sum_{k=0}^{2} C(64,k) / 2^64
     * - P(d < 3) ≈ (1 + 64 + 2016) / 1.84e19 ≈ 1.13e-16
     *
     * 对于N个向量，期望候选数：
     * - E[|C|] = N * P(d < 3)
     * - 当 N = 1e8 (TB级), E[|C|] ≈ 1.13e-8 ≈ 0
     *
     * 实际应用中，数据有相关性，概率会更高
     * 因此需要硬限制防止最坏情况
     */
    calculateCollisionProbability(dimensions: number, threshold: number): number;
    /**
     * 计算组合数 C(n,k)
     */
    private combinations;
    /**
     * 获取限制参数
     */
    getConfig(): {
        limit: number;
        highDimThreshold: number;
    };
}
/**
 * MATH-001: 溢出保护计算器
 *
 * 防止高维场景下的数值溢出
 */
export declare class OverflowProtectedCalculator {
    private maxSafeValue;
    constructor();
    /**
     * 安全的BigInt乘法
     * 检测溢出并返回上限值
     */
    safeMultiply(a: bigint, b: bigint): bigint;
    /**
     * 计算安全的向量距离
     * 防止高维向量计算溢出
     */
    safeDistance(a: bigint[], b: bigint[]): number;
}
/**
 * 默认导出
 */
declare const _default: {
    popcnt64: typeof popcnt64;
    hammingDistance: typeof hammingDistance;
    isSimilar: typeof isSimilar;
    CandidateLimiter: typeof CandidateLimiter;
    OverflowProtectedCalculator: typeof OverflowProtectedCalculator;
    UINT64_MASK: bigint;
    HAMMING_THRESHOLD: number;
    DEFAULT_FILE_SEED: number;
    CANDIDATE_LIMIT: number;
    HIGH_DIMENSION_THRESHOLD: number;
};
export default _default;
//# sourceMappingURL=simhash-math.d.ts.map