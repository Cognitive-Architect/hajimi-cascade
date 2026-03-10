/**
 * entropy.test.ts - B-01: 熵计算单元测试
 * 覆盖FUNC/CONST/NEG刀刃表要求
 */

import { calculateEntropy, calculateEntropyStream, estimateEntropy } from '../../src/utils/entropy';

describe('Entropy Calculator (B-01)', () => {
  describe('FUNC: calculateEntropy', () => {
    it('FUNC-003: 空输入熵计算返回0', () => {
      const entropy = calculateEntropy(Buffer.alloc(0));
      expect(entropy).toBe(0);
    });

    it('FUNC-001: 低熵内容（重复字节）返回低熵值', () => {
      // 全部相同字节，熵=0
      const lowEntropyData = Buffer.alloc(1000, 0xAA);
      const entropy = calculateEntropy(lowEntropyData);
      expect(entropy).toBeLessThan(0.1);
      expect(entropy).toBeGreaterThanOrEqual(0);
    });

    it('FUNC-002: 高熵内容（随机数据）返回高熵值', () => {
      // 随机字节，熵接近1
      const highEntropyData = Buffer.from(Array.from({ length: 1000 }, 
        () => Math.floor(Math.random() * 256)));
      const entropy = calculateEntropy(highEntropyData);
      expect(entropy).toBeGreaterThan(0.7);
      expect(entropy).toBeLessThanOrEqual(1);
    });

    it('输出范围归一化到[0,1]', () => {
      const testCases = [
        Buffer.alloc(100, 0x00),  // 全0
        Buffer.from('Hello World!'.repeat(10)),  // 文本
        Buffer.from(Array.from({ length: 256 }, (_, i) => i)),  // 均匀分布
      ];
      
      for (const data of testCases) {
        const entropy = calculateEntropy(data);
        expect(entropy).toBeGreaterThanOrEqual(0);
        expect(entropy).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('NEG: 边界测试', () => {
    it('NEG-001: 空Buffer处理', () => {
      expect(calculateEntropy(Buffer.alloc(0))).toBe(0);
    });

    it('NEG-001: 单字节处理', () => {
      const entropy = calculateEntropy(Buffer.from([0x42]));
      expect(entropy).toBe(0);
    });

    it('NEG-002: 极大输入（10MB模拟）不溢出', () => {
      // 使用estimateEntropy避免实际分配10MB
      const largeData = Buffer.from(Array.from({ length: 10000 }, 
        () => Math.floor(Math.random() * 256)));
      const entropy = estimateEntropy(largeData, 1024);
      expect(entropy).toBeGreaterThanOrEqual(0);
      expect(entropy).toBeLessThanOrEqual(1);
      expect(Number.isFinite(entropy)).toBe(true);
    });

    it('NEG-002: 重复模式数据的熵计算', () => {
      // ABABAB... 模式，低熵
      const pattern = Buffer.from('AB'.repeat(500));
      const entropy = calculateEntropy(pattern);
      expect(entropy).toBeLessThan(0.5);
    });
  });

  describe('E2E: 熵流计算', () => {
    it('calculateEntropyStream返回正确长度的数组', () => {
      const data = Buffer.from('Hello World this is a test string for entropy!');
      const windowSize = 8;
      const entropies = calculateEntropyStream(data, windowSize);
      
      expect(entropies.length).toBe(data.length - windowSize + 1);
      
      for (const e of entropies) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    });

    it('estimateEntropy使用采样近似', () => {
      const data = Buffer.from(Array.from({ length: 5000 }, 
        () => Math.floor(Math.random() * 256)));
      const fullEntropy = calculateEntropy(data);
      const estimated = estimateEntropy(data, 1000);
      
      // 估计值应该接近真实值（误差<20%）
      expect(Math.abs(estimated - fullEntropy)).toBeLessThan(0.2);
    });
  });
});
