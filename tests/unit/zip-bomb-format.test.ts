/**
 * zip-bomb-format.test.ts - B-02: 多格式zip bomb检测测试
 * 测试input-sandbox的格式特定限制
 */

import {
  detectZipBomb,
  detectCompressedZipBomb,
  validateInput,
} from '../../src/security/input-sandbox';
import { CompressionFormat } from '../../src/security/format-detector';
import { GZIP_LIMIT, BZIP2_LIMIT, ZLIB_LIMIT } from '../../src/security/sandbox-limits';

describe('Zip Bomb Multi-Format Detection (B-02)', () => {
  describe('FUNC: 格式特定炸弹检测', () => {
    it('detectZipBomb使用格式特定限制', () => {
      // gzip 100:1 限制
      expect(detectZipBomb(1, 150, undefined, CompressionFormat.GZIP)).toBe(true);
      expect(detectZipBomb(1, 50, undefined, CompressionFormat.GZIP)).toBe(false);

      // bzip2 50:1 限制（更严格）
      expect(detectZipBomb(1, 60, undefined, CompressionFormat.BZIP2)).toBe(true);
      expect(detectZipBomb(1, 40, undefined, CompressionFormat.BZIP2)).toBe(false);

      // zlib 80:1 限制
      expect(detectZipBomb(1, 100, undefined, CompressionFormat.ZLIB)).toBe(true);
      expect(detectZipBomb(1, 70, undefined, CompressionFormat.ZLIB)).toBe(false);
    });

    it('detectCompressedZipBomb自动检测格式', () => {
      const gzipData = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
      const result = detectCompressedZipBomb(gzipData, 150);
      
      expect(result.format).toBe(CompressionFormat.GZIP);
      expect(result.limit).toBe(GZIP_LIMIT);
      expect(result.ratio).toBe(37.5); // 150/4
      expect(result.isBomb).toBe(false); // 37.5 < 100
    });

    it('bzip2炸弹检测', () => {
      const bzip2Data = Buffer.from([0x42, 0x5a, 0x68, 0x39]);
      // 模拟60:1压缩比
      const result = detectCompressedZipBomb(bzip2Data, 240); // 240/4=60
      
      expect(result.format).toBe(CompressionFormat.BZIP2);
      expect(result.limit).toBe(BZIP2_LIMIT); // 50
      expect(result.isBomb).toBe(true); // 60 > 50
    });

    it('zlib炸弹检测', () => {
      const zlibData = Buffer.from([0x78, 0x9c, 0x03, 0x00]);
      // 模拟90:1压缩比
      const result = detectCompressedZipBomb(zlibData, 360);
      
      expect(result.format).toBe(CompressionFormat.ZLIB);
      expect(result.limit).toBe(ZLIB_LIMIT); // 80
      expect(result.ratio).toBe(90);
      expect(result.isBomb).toBe(true); // 90 > 80
    });
  });

  describe('E2E: validateInput集成', () => {
    it('validateInput使用格式特定限制（默认启用）', () => {
      const gzipData = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
      // 150:1 压缩比超过gzip 100:1限制
      const result = validateInput(gzipData, { uncompressedSize: 600 });
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Zip bomb detected');
      expect(result.metadata?.format).toBe(CompressionFormat.GZIP);
      expect(result.metadata?.formatLimit).toBe(100);
    });

    it('正常压缩比通过验证', () => {
      const gzipData = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
      // 10:1 压缩比正常
      const result = validateInput(gzipData, { uncompressedSize: 40 });
      
      expect(result.allowed).toBe(true);
    });

    it('bzip2严格限制触发炸弹检测', () => {
      const bzip2Data = Buffer.from([0x42, 0x5a, 0x68, 0x39]);
      // 60:1 超过bzip2 50:1限制
      const result = validateInput(bzip2Data, { uncompressedSize: 240 });
      
      expect(result.allowed).toBe(false);
      expect(result.metadata?.format).toBe(CompressionFormat.BZIP2);
      expect(result.metadata?.formatLimit).toBe(50);
    });

    it('禁用格式检测使用通用限制', () => {
      const unknownData = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = validateInput(unknownData, { 
        uncompressedSize: 200,
        detectFormat: false 
      });
      // 未知格式使用通用100:1限制，50:1通过
      expect(result.allowed).toBe(true);
    });
  });

  describe('NEG: 边界场景', () => {
    it('空压缩数据返回炸弹（除零保护）', () => {
      expect(detectZipBomb(0, 100, undefined, CompressionFormat.GZIP)).toBe(true);
    });

    it('未知格式使用通用限制', () => {
      const result = detectCompressedZipBomb(Buffer.from([0x00]), 200);
      expect(result.format).toBe(CompressionFormat.UNKNOWN);
      expect(result.limit).toBe(100);
    });

    it('向后兼容：旧版detectZipBomb仍工作', () => {
      // 旧调用方式（无format参数）使用通用限制
      expect(detectZipBomb(1, 150)).toBe(true);  // 150 > 100
      expect(detectZipBomb(1, 50)).toBe(false);  // 50 < 100
    });
  });
});
