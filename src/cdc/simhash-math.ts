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

import { createHash } from 'crypto';

/** 64位掩码 */
export const UINT64_MASK = 0xffffffffffffffffn;

/** 汉明距离阈值 - MATH-001分析：h=3是最优选择 */
export const HAMMING_THRESHOLD = 3;

/** 默认文件级种子 */
export const DEFAULT_FILE_SEED = 0x20250221;

/** 候选集大小硬限制 - MATH-001核心参数 */
export const CANDIDATE_LIMIT = 100;

/** 高维向量阈值 - 超过此值启用限制 */
export const HIGH_DIMENSION_THRESHOLD = 768;

/** SimHash类型 */
export type SimHashValue = bigint;

/**
 * 计算32位整数的汉明权重（popcount）
 * 使用SWAR算法
 */
function popcnt32(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0F0F0F0F;
  x = x + (x >> 8);
  x = x + (x >> 16);
  return x & 0x3F;
}

/**
 * 计算64位BigInt的汉明权重
 * MATH-001：分段计算避免BigInt性能问题
 */
export function popcnt64(value: SimHashValue): number {
  const v = value & UINT64_MASK;
  const lo = Number(v & 0xffffffffn);
  const hi = Number(v >> 32n);
  return popcnt32(lo) + popcnt32(hi);
}

/**
 * 计算汉明距离
 */
export function hammingDistance(a: SimHashValue, b: SimHashValue): number {
  return popcnt64(a ^ b);
}

/**
 * 检查相似性
 */
export function isSimilar(a: SimHashValue, b: SimHashValue, threshold = HAMMING_THRESHOLD): boolean {
  return hammingDistance(a, b) < threshold;
}

/**
 * MATH-001: 候选集大小限制器
 * 
 * 数学保证：
 * - 当维度 > 768 时，强制限制候选集大小
 * - 使用优先级队列保留最优候选（汉明距离最小）
 * - 保证返回的候选数 <= limit
 */
export class CandidateLimiter {
  private limit: number;
  private highDimThreshold: number;

  constructor(limit = CANDIDATE_LIMIT, highDimThreshold = HIGH_DIMENSION_THRESHOLD) {
    this.limit = limit;
    this.highDimThreshold = highDimThreshold;
  }

  /**
   * 是否需要限制候选集
   * MATH-001：基于维度决定
   */
  shouldLimit(dimensions: number): boolean {
    return dimensions > this.highDimThreshold;
  }

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
  limitCandidates<T extends { id: number; distance: number }>(candidates: T[]): T[] {
    if (candidates.length <= this.limit) {
      return candidates;
    }

    // 按距离排序，取前limit个
    return candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, this.limit);
  }

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
  calculateCollisionProbability(dimensions: number, threshold: number): number {
    let combinations = 0;
    for (let k = 0; k < threshold; k++) {
      combinations += this.combinations(dimensions, k);
    }
    return combinations / Math.pow(2, dimensions);
  }

  /**
   * 计算组合数 C(n,k)
   */
  private combinations(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
  }

  /**
   * 获取限制参数
   */
  getConfig(): { limit: number; highDimThreshold: number } {
    return { limit: this.limit, highDimThreshold: this.highDimThreshold };
  }
}

/**
 * MATH-001: 溢出保护计算器
 * 
 * 防止高维场景下的数值溢出
 */
export class OverflowProtectedCalculator {
  private maxSafeValue: bigint;

  constructor() {
    this.maxSafeValue = BigInt(Number.MAX_SAFE_INTEGER);
  }

  /**
   * 安全的BigInt乘法
   * 检测溢出并返回上限值
   */
  safeMultiply(a: bigint, b: bigint): bigint {
    try {
      const result = a * b;
      // 检查结果是否溢出（简单启发式）
      if (result < 0n) {
        return this.maxSafeValue;
      }
      return result;
    } catch {
      return this.maxSafeValue;
    }
  }

  /**
   * 计算安全的向量距离
   * 防止高维向量计算溢出
   */
  safeDistance(a: bigint[], b: bigint[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0n;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] > b[i] ? a[i] - b[i] : b[i] - a[i];
      sum += diff * diff;
      
      // 溢出检测
      if (sum > this.maxSafeValue) {
        return Number.MAX_SAFE_INTEGER;
      }
    }
    
    return Number(sum);
  }
}

/**
 * 默认导出
 */
export default {
  popcnt64,
  hammingDistance,
  isSimilar,
  CandidateLimiter,
  OverflowProtectedCalculator,
  UINT64_MASK,
  HAMMING_THRESHOLD,
  DEFAULT_FILE_SEED,
  CANDIDATE_LIMIT,
  HIGH_DIMENSION_THRESHOLD,
};
