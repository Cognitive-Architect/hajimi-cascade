/**
 * MATH-001 SimHash Math Test Suite
 * 
 * Wave 3: 数学地狱测试
 */

import {
  popcnt64,
  hammingDistance,
  isSimilar,
  CandidateLimiter,
  OverflowProtectedCalculator,
  HAMMING_THRESHOLD,
  CANDIDATE_LIMIT,
  HIGH_DIMENSION_THRESHOLD,
  UINT64_MASK,
} from '../../src/cdc/simhash-math';

describe('MATH-001: SimHash Mathematical Constraints', () => {
  describe('popcnt64', () => {
    it('should count bits correctly', () => {
      expect(popcnt64(0n)).toBe(0);
      expect(popcnt64(1n)).toBe(1);
      expect(popcnt64(0xFFFFFFFFFFFFFFFFn)).toBe(64);
      expect(popcnt64(0x0F0F0F0F0F0F0F0Fn)).toBe(32);
    });

    it('should handle 64-bit boundary', () => {
      const result = popcnt64(UINT64_MASK);
      expect(result).toBe(64);
    });
  });

  describe('hammingDistance', () => {
    it('should calculate distance between same values as 0', () => {
      expect(hammingDistance(0n, 0n)).toBe(0);
      expect(hammingDistance(0x1234n, 0x1234n)).toBe(0);
    });

    it('should calculate distance between different values', () => {
      // 0x0000 vs 0x0001 = 1 bit different
      expect(hammingDistance(0n, 1n)).toBe(1);
      // 0x0000 vs 0x000F = 4 bits different
      expect(hammingDistance(0n, 0xFn)).toBe(4);
    });

    it('should handle 64-bit values', () => {
      const a = 0xFFFFFFFFFFFFFFFFn;
      const b = 0x0000000000000000n;
      expect(hammingDistance(a, b)).toBe(64);
    });
  });

  describe('isSimilar', () => {
    it('should return true for identical values', () => {
      expect(isSimilar(123n, 123n)).toBe(true);
    });

    it('should respect threshold', () => {
      // Distance 3, threshold 3 -> not similar (strict <)
      expect(isSimilar(0n, 0x7n, 3)).toBe(false);
      // Distance 2, threshold 3 -> similar
      expect(isSimilar(0n, 0x3n, 3)).toBe(true);
    });

    it('should use default threshold', () => {
      // HAMMING_THRESHOLD = 3
      const a = 0n;
      const b = (1n << 3n) - 1n; // 0b111 = 7, 3 bits set -> distance 3
      expect(isSimilar(a, b)).toBe(false); // distance >= threshold (3 < 3 is false)
      
      const c = (1n << 2n) - 1n; // 0b11 = 3, 2 bits set -> distance 2
      expect(isSimilar(a, c)).toBe(true); // distance < threshold (2 < 3 is true)
    });
  });

  describe('CandidateLimiter', () => {
    let limiter: CandidateLimiter;

    beforeEach(() => {
      limiter = new CandidateLimiter();
    });

    it('should detect high dimension', () => {
      expect(limiter.shouldLimit(768)).toBe(false);
      expect(limiter.shouldLimit(769)).toBe(true);
      expect(limiter.shouldLimit(1000)).toBe(true);
    });

    it('should not limit when under threshold', () => {
      const candidates = [
        { id: 1, distance: 1 },
        { id: 2, distance: 2 },
      ];
      const result = limiter.limitCandidates(candidates);
      expect(result).toHaveLength(2);
    });

    it('should limit candidates to 100', () => {
      // Create 150 candidates
      const candidates = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        distance: Math.floor(Math.random() * 10),
      }));
      
      const result = limiter.limitCandidates(candidates);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should return closest candidates when limiting', () => {
      const candidates = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        distance: i, // 0, 1, 2, ..., 199
      }));
      
      const result = limiter.limitCandidates(candidates);
      expect(result).toHaveLength(100);
      expect(result[0].distance).toBe(0);
      expect(result[99].distance).toBe(99);
    });

    it('should calculate collision probability', () => {
      // For 64 dimensions, threshold 3
      const prob = limiter.calculateCollisionProbability(64, 3);
      // P(d < 3) for 64 bits ≈ 2.08e3 / 2^64 ≈ 1e-16
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThan(1e-15);
    });

    it('should have correct default config', () => {
      const config = limiter.getConfig();
      expect(config.limit).toBe(CANDIDATE_LIMIT);
      expect(config.highDimThreshold).toBe(HIGH_DIMENSION_THRESHOLD);
    });
  });

  describe('OverflowProtectedCalculator', () => {
    let calc: OverflowProtectedCalculator;

    beforeEach(() => {
      calc = new OverflowProtectedCalculator();
    });

    it('should multiply safely', () => {
      const result = calc.safeMultiply(100n, 200n);
      expect(result).toBe(20000n);
    });

    it('should calculate distance for bigint arrays', () => {
      const a = [1n, 2n, 3n];
      const b = [4n, 5n, 6n];
      // (4-1)^2 + (5-2)^2 + (6-3)^2 = 9 + 9 + 9 = 27
      const result = calc.safeDistance(a, b);
      expect(result).toBe(27);
    });

    it('should throw for mismatched dimensions', () => {
      expect(() => calc.safeDistance([1n, 2n], [1n])).toThrow('Vector dimensions must match');
    });
  });

  describe('MATH-001: 768 dimension boundary test', () => {
    it('should handle 768 dimension without limiting', () => {
      const limiter = new CandidateLimiter();
      const candidates = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        distance: i,
      }));
      
      expect(limiter.shouldLimit(768)).toBe(false);
      const result = limiter.limitCandidates(candidates);
      expect(result).toHaveLength(50);
    });

    it('should apply limit for 1000 dimension', () => {
      const limiter = new CandidateLimiter();
      expect(limiter.shouldLimit(1000)).toBe(true);
    });
  });
});
