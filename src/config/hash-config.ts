/**
 * hash-config.ts - B-03: 哈希配置集成 (≤80行)
 */

import { HashStrategy, createHashStrategy } from '../crypto/hash-factory';

export interface HashConfig {
  strategy: HashStrategy;
  enableBlake3: boolean;
  backwardCompat: boolean;  // 允许读取v2.8的MD5
}

export const DEFAULT_HASH_CONFIG: HashConfig = {
  strategy: 'auto',
  enableBlake3: true,
  backwardCompat: true,
};

/** 从环境变量加载配置 */
export function loadHashConfig(): HashConfig {
  return {
    strategy: (process.env.HASH_STRATEGY as HashStrategy) || 'auto',
    enableBlake3: process.env.ENABLE_BLAKE3 !== 'false',
    backwardCompat: process.env.BACKWARD_COMPAT !== 'false',
  };
}

/** 应用配置，返回策略实例 */
export function applyHashConfig(config: Partial<HashConfig> = {}) {
  const cfg = { ...DEFAULT_HASH_CONFIG, ...config };
  const strategy = createHashStrategy(cfg.strategy);
  return { config: cfg, strategy };
}

/** 配置验证 */
export function validateConfig(cfg: HashConfig): boolean {
  return ['legacy', 'modern', 'auto'].includes(cfg.strategy);
}

export default { loadHashConfig, applyHashConfig, DEFAULT_HASH_CONFIG };
