/**
 * Compression Parallel Test Suite
 */

import { CompressionParallel } from '../../src/storage/compression-parallel';

describe('CompressionParallel', () => {
  let compressor: CompressionParallel;

  beforeEach(() => {
    compressor = new CompressionParallel({
      workerCount: 2,
      chunkSize: 16 * 1024,
    });
  });

  afterEach(() => {
    compressor.terminate();
  });

  describe('Basic Compression', () => {
    it('should compress data', async () => {
      const data = Buffer.from('Hello, World! This is test data for compression.');
      const result = await compressor.compress(data);
      
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThan(data.length * 2);
      expect(result.mode).toBe('single');
      expect(result.ratio).toBeGreaterThan(0);
    });

    it('should decompress data', async () => {
      const original = Buffer.from('Test data for round-trip compression and decompression.');
      const compressed = await compressor.compress(original);
      const decompressed = await compressor.decompress(compressed.data);
      
      expect(decompressed.data.toString()).toBe(original.toString());
    });

    it('should handle empty data fallback', async () => {
      const data = Buffer.alloc(0);
      await expect(compressor.compress(data)).rejects.toThrow();
    });

    it('should handle small data with single thread', async () => {
      const data = Buffer.from('Small');
      const result = await compressor.compress(data);
      expect(result.mode).toBe('single');
    });
  });

  describe('Sync Methods', () => {
    it('should compress synchronously', () => {
      const data = Buffer.from('Sync test data');
      const compressed = compressor.compressSync(data);
      expect(compressed).toBeDefined();
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should throw on empty data in sync mode', () => {
      expect(() => compressor.compressSync(Buffer.alloc(0))).toThrow();
    });
  });

  describe('Stats and Control', () => {
    it('should provide stats', () => {
      const stats = compressor.getStats();
      expect(stats.workerCount).toBe(2);
      expect(stats.workersEnabled).toBe(true);
    });

    it('should disable and enable workers', () => {
      compressor.disableWorkers();
      expect(compressor.getStats().workersEnabled).toBe(false);
      
      compressor.enableWorkers();
      expect(compressor.getStats().workersEnabled).toBe(true);
    });
  });

  describe('Progress Callback', () => {
    it.skip('should call progress callback', async () => {
      const progressCalls: number[] = [];
      compressor.onProgress = (current, total) => {
        progressCalls.push(current);
      };

      const data = Buffer.alloc(1024 * 1024, 'x');
      await compressor.compress(data);
      
      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Large Data', () => {
    it('should handle large data compression', async () => {
      const data = Buffer.alloc(256 * 1024, 'x');
      const result = await compressor.compress(data);
      
      expect(result.data).toBeDefined();
      expect(result.originalSize).toBe(data.length);
    }, 30000);
  });
});
