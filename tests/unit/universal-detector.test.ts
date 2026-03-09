/**
 * Universal Detector Test Suite
 */

import {
  UniversalDetector,
  detectFormat,
  detectFormatFast,
  HCTX_MAGIC_LE_V1,
  HCTX_MAGIC_BE_V2,
} from '../../src/format/universal-detector';

describe('UniversalDetector', () => {
  const detector = new UniversalDetector();

  describe('Basic Detection', () => {
    it('should detect empty buffer as UNKNOWN', () => {
      const result = detector.detect(Buffer.alloc(0));
      expect(result.format).toBe('UNKNOWN');
      expect(result.fallback).toBe('HCTX');
    });

    it('should detect small buffer as UNKNOWN with fallback', () => {
      const result = detector.detect(Buffer.from('tiny'));
      expect(result.format).toBe('UNKNOWN');
      expect(result.fallback).toBe('HCTX');
    });
  });

  describe('JSON Detection', () => {
    it('should detect UTF-8 JSON object with high accuracy', () => {
      const json = JSON.stringify({ test: 1, data: 'value' });
      const buf = Buffer.from(json, 'utf8');
      const result = detector.detectJSON(buf);
      
      expect(result.format).toBe('JSON');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect JSON array', () => {
      const buf = Buffer.from('[1, 2, 3]', 'utf8');
      const result = detector.detectJSON(buf);
      
      expect(result.format).toBe('JSON');
    });

    it('should detect JSON with UTF-8 BOM', () => {
      const json = JSON.stringify({ test: 'data' });
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const content = Buffer.from(json, 'utf8');
      const buf = Buffer.concat([bom, content]);
      
      const result = detector.detectJSON(buf);
      expect(result.format).toBe('JSON');
      expect(result.byteOrder).toBe('LE');
    });
  });

  describe('Binary Detection', () => {
    it('should handle random bytes without crash', () => {
      const buf = Buffer.alloc(1024);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = Math.floor(Math.random() * 256);
      }

      const result = detector.detect(buf);
      expect(['BINARY', 'UNKNOWN']).toContain(result.format);
    });

    it('should detect binary with null bytes', () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x03, 0x00]);
      const result = detector.detectBinary(buf);
      
      expect(result.format).toBe('BINARY');
    });
  });

  describe('HCTX Format Detection', () => {
    it('should detect HCTX LE format (v2.5)', () => {
      const buf = Buffer.alloc(32);
      buf.writeUInt32LE(HCTX_MAGIC_LE_V1, 0);
      buf.writeUInt16LE(0x0250, 4);
      
      const result = detector.detectHCTX(buf);
      expect(result.format).toBe('HCTX');
      expect(result.byteOrder).toBe('LE');
    });

    it('should detect HCTX BE format (v2.6)', () => {
      const buf = Buffer.alloc(32);
      buf.writeUInt32BE(HCTX_MAGIC_BE_V2, 0);
      buf.writeUInt16BE(0x0260, 4);
      
      const result = detector.detectHCTX(buf);
      expect(result.format).toBe('HCTX');
      expect(result.byteOrder).toBe('BE');
    });
  });

  describe('Utility Functions', () => {
    it('detectFormat should work as static function', () => {
      const json = JSON.stringify({ test: true });
      const buf = Buffer.from(json, 'utf8');
      const result = detectFormat(buf);
      
      expect(result.format).toBe('JSON');
    });

    it('detectFormatFast should return format only', () => {
      const json = JSON.stringify({ test: true });
      const buf = Buffer.from(json, 'utf8');
      const format = detectFormatFast(buf);
      
      expect(format).toBe('JSON');
    });
  });
});
