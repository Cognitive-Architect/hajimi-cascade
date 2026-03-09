/**
 * blake3-compat.test.ts - B-03: 哈希交叉兼容测试 (≤100行)
 */

import { blake3Hex, verifyB3sum } from '../../src/crypto/blake3-wrapper';
import { createHashStrategy, detectVersion, crossVerify } from '../../src/crypto/hash-factory';
import { createHash } from 'crypto';
import { applyHashConfig } from '../../src/config/hash-config';

describe('blake3-compat', () => {
  const testData = Buffer.from('Hello v2.9.0 BLAKE3', 'utf-8');

  test('BLAKE3哈希输出', () => {
    const hash = blake3Hex(testData);
    expect(hash).toHaveLength(64); // SHA-256 hex = 64字符
    expect(typeof hash).toBe('string');
  });

  test('MD5向后兼容', () => {
    const md5 = createHash('md5').update(testData).digest('hex');
    expect(md5).toHaveLength(32);
  });

  test('策略工厂: legacy模式', () => {
    const factory = createHashStrategy('legacy');
    expect(factory.algorithm).toBe('md5');
    expect(factory.hashHex(testData)).toHaveLength(32);
  });

  test('策略工厂: modern模式', () => {
    const factory = createHashStrategy('modern');
    expect(factory.algorithm).toBe('blake3');
    expect(factory.hashHex(testData)).toHaveLength(64);
  });

  test('版本检测', () => {
    expect(detectVersion('a'.repeat(32))).toBe('v2.8');
    expect(detectVersion('a'.repeat(64))).toBe('v2.9');
    expect(detectVersion('invalid')).toBe('unknown');
  });

  test('交叉验证', () => {
    const result = crossVerify(testData);
    expect(result.md5).toHaveLength(32);
    expect(result.blake3).toHaveLength(64);
    expect(result.match).toBe(false); // 不同算法
  });

  test('配置集成', () => {
    const { config, strategy } = applyHashConfig({ strategy: 'modern' });
    expect(config.enableBlake3).toBe(true);
    expect(strategy.algorithm).toBe('blake3');
  });

  test('b3sum验证', () => {
    const hash = blake3Hex(testData);
    expect(verifyB3sum(testData, hash)).toBe(true);
    expect(verifyB3sum(testData, 'wrong')).toBe(false);
  });
});
