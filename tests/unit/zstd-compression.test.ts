/**
 * ZSTD Compression Test Suite
 * 
 * @module zstd-compression.test
 * Wave 2: R-002 测试环境地狱
 */

import { ZstdCompression, CompressionOptions } from '../../src/storage/zstd-compression';

describe('ZstdCompression', () => {
  let compressor: ZstdCompression;

  beforeEach(() => {
    compressor = new ZstdCompression();
  });

  describe('compressSync/decompressSync', () => {
    it('should compress and decompress data correctly', () => {
      const data = Buffer.from('Hello, World! This is a test string.');
      const compressed = compressor.compressSync(data);
      const decompressed = compressor.decompressSync(compressed);
      
      expect(decompressed.toString()).toBe(data.toString());
    });

    it('should throw error for empty input (compress)', () => {
      expect(() => compressor.compressSync(Buffer.alloc(0)))
        .toThrow('Cannot compress empty data');
    });

    it('should throw error for empty input (decompress)', () => {
      expect(() => compressor.decompressSync(Buffer.alloc(0)))
        .toThrow('Cannot decompress empty data');
    });

    it('should handle binary data', () => {
      const data = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      const compressed = compressor.compressSync(data);
      const decompressed = compressor.decompressSync(compressed);
      
      expect(Buffer.compare(decompressed, data)).toBe(0);
    });

    it('should achieve compression ratio < 1 for text', () => {
      const data = Buffer.from('a'.repeat(1000));
      const compressed = compressor.compressSync(data);
      
      expect(compressed.length).toBeLessThan(data.length);
    });
  });

  describe('compress/decompress (async)', () => {
    it('should compress with metadata', async () => {
      const data = Buffer.from('Test data for async compression');
      const result = await compressor.compress(data);
      
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.mode).toBe('single');
      expect(result.originalSize).toBe(data.length);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should decompress with metadata', async () => {
      const data = Buffer.from('Test data for async decompression');
      const compressed = await compressor.compress(data);
      const result = await compressor.decompress(compressed.data);
      
      expect(result.data.toString()).toBe(data.toString());
      expect(result.mode).toBe('single');
      expect(result.originalSize).toBe(compressed.compressedSize);
      expect(result.compressedSize).toBe(data.length);
    });
  });

  describe('options', () => {
    it('should use default options', () => {
      const options = compressor.getOptions();
      expect(options.level).toBe(3);
      expect(options.chunkSize).toBe(64 * 1024);
    });

    it('should accept custom options', () => {
      const custom = new ZstdCompression({ level: 9, chunkSize: 1024 });
      const options = custom.getOptions();
      expect(options.level).toBe(9);
      expect(options.chunkSize).toBe(1024);
    });
  });

  describe('chunk utilities', () => {
    it('should calculate chunk count correctly', () => {
      // 1MB data, 64KB chunks, 4 cores -> min(16, 8) = 8
      const count = compressor.calculateChunkCount(1024 * 1024, 4);
      expect(count).toBe(8);
    });

    it('should split data into chunks', () => {
      const data = Buffer.from('a'.repeat(1000));
      const chunks = compressor.splitIntoChunks(data, 4);
      
      expect(chunks.length).toBe(4);
      expect(Buffer.concat(chunks).toString()).toBe(data.toString());
    });

    it('should handle empty data split', () => {
      const chunks = compressor.splitIntoChunks(Buffer.alloc(0), 4);
      expect(chunks.length).toBe(0);
    });

    it('should throw for invalid chunkCount', () => {
      expect(() => compressor.splitIntoChunks(Buffer.from('test'), 0))
        .toThrow('chunkCount must be positive');
    });
  });
});
