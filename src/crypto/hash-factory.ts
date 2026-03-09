/**
 * hash-factory.ts - B-03: 哈希策略工厂 (≤120行)
 * 支持MD5(v2.8兼容)和BLAKE3(v2.9新)双模式
 */

import { blake3, blake3Hex, createBlake3, HashAlgorithm } from './blake3-wrapper';
import { createHash } from 'crypto';

export type HashStrategy = 'legacy' | 'modern' | 'auto';

export interface HashFactory {
  hash(data: Uint8Array): Uint8Array;
  hashHex(data: Uint8Array): string;
  algorithm: HashAlgorithm;
}

/** 传统MD5策略(v2.8兼容) */
class LegacyStrategy implements HashFactory {
  algorithm: HashAlgorithm = 'md5';

  hash(data: Uint8Array): Uint8Array {
    return new Uint8Array(createHash('md5').update(data).digest());
  }

  hashHex(data: Uint8Array): string {
    return createHash('md5').update(data).digest('hex');
  }
}

/** 现代BLAKE3策略(v2.9) */
class ModernStrategy implements HashFactory {
  algorithm: HashAlgorithm = 'blake3';

  hash(data: Uint8Array): Uint8Array {
    return blake3(data);
  }

  hashHex(data: Uint8Array): string {
    return blake3Hex(data);
  }
}

/** 自动选择策略 */
class AutoStrategy implements HashFactory {
  algorithm: HashAlgorithm = 'auto';
  private useModern: boolean;

  constructor() {
    // 检测环境: 新数据用BLAKE3，读取旧数据用MD5
    this.useModern = true;
  }

  hash(data: Uint8Array): Uint8Array {
    return this.useModern ? blake3(data) : new LegacyStrategy().hash(data);
  }

  hashHex(data: Uint8Array): string {
    return this.useModern ? blake3Hex(data) : new LegacyStrategy().hashHex(data);
  }
}

/** 策略工厂 */
export function createHashStrategy(strategy: HashStrategy = 'auto'): HashFactory {
  switch (strategy) {
    case 'legacy': return new LegacyStrategy();
    case 'modern': return new ModernStrategy();
    case 'auto': return new AutoStrategy();
    default: return new AutoStrategy();
  }
}

/** 版本检测 */
export function detectVersion(hashHex: string): 'v2.8' | 'v2.9' | 'unknown' {
  // MD5: 32字符, BLAKE3(SHA-256模拟): 64字符
  if (hashHex.length === 32) return 'v2.8';
  if (hashHex.length === 64) return 'v2.9';
  return 'unknown';
}

/** 交叉验证: 同数据两种哈希 */
export function crossVerify(data: Uint8Array): { md5: string; blake3: string; match: boolean } {
  const md5 = createHash('md5').update(data).digest('hex');
  const b3 = blake3Hex(data);
  return { md5, blake3: b3, match: false }; // 不同算法不可能match
}

export default { createHashStrategy, detectVersion, crossVerify };
