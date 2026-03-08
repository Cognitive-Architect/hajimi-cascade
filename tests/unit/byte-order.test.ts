/**
 * BYTE-001 Test Suite
 * Wave 4: 字节序自适应地狱
 */

import {
  ByteOrderDetector,
  AdaptiveReader,
  DataSwapper,
  ByteOrder,
} from '../../src/format/byte-order-adaptive';

describe('BYTE-001: Byte Order Adaptive Layer', () => {
  describe('ByteOrderDetector', () => {
    let detector: ByteOrderDetector;

    beforeEach(() => {
      detector = new ByteOrderDetector();
    });

    it('should detect LE by BOM', () => {
      const buf = Buffer.from([0xFF, 0xFE]);
      expect(detector.detectByBOM(buf)).toBe('LE');
    });

    it('should detect BE by BOM', () => {
      const buf = Buffer.from([0xFE, 0xFF]);
      expect(detector.detectByBOM(buf)).toBe('BE');
    });

    it('should detect LE by magic', () => {
      // 'HCTX' in LE = 0x58545348
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(0x58545348, 0);
      expect(detector.detectByMagic(buf)).toBe('LE');
    });

    it('should detect BE by magic', () => {
      // 'HCX2' in BE = 0x48435832
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(0x48435832, 0);
      expect(detector.detectByMagic(buf)).toBe('BE');
    });

    it('should return UNKNOWN for invalid buffer', () => {
      expect(detector.detect(Buffer.alloc(0))).toBe('UNKNOWN');
      expect(detector.detect(Buffer.from([0x00, 0x00]))).toBe('UNKNOWN');
    });
  });

  describe('AdaptiveReader', () => {
    let reader: AdaptiveReader;

    beforeEach(() => {
      reader = new AdaptiveReader();
    });

    it('should detect local byte order', () => {
      const order = reader.getLocalOrder();
      expect(['LE', 'BE']).toContain(order);
    });

    it('should read LE data on LE machine without swap', () => {
      // Use LE magic to trigger LE detection
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(0x58545348, 0); // 'HCTX' magic
      const result = reader.readUInt32(buf, 0);
      
      expect(result.byteOrder).toBe('LE');
      expect(result.value).toBe(0x58545348);
    });

    it('should read BE data correctly', () => {
      // Use BE magic to trigger BE detection
      const buf = Buffer.from([0x48, 0x43, 0x58, 0x32]);
      const result = reader.readUInt32(buf, 0);
      expect(result.byteOrder).toBe('BE');
    });

    it('should read UInt16', () => {
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(0x1234, 0);
      const result = reader.readUInt16(buf, 0);
      expect(result.value).toBe(0x1234);
    });

    it('should read BigUInt64', () => {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(0x123456789ABCDEF0n, 0);
      const result = reader.readBigUInt64(buf, 0);
      expect(result.value).toBe(0x123456789ABCDEF0n);
    });
  });

  describe('DataSwapper', () => {
    it('should swap 16-bit buffer', () => {
      const buf = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      DataSwapper.swapBuffer(buf, 2);
      expect(buf).toEqual(Buffer.from([0x34, 0x12, 0x78, 0x56]));
    });

    it('should swap 32-bit buffer', () => {
      const buf = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      DataSwapper.swapBuffer(buf, 4);
      expect(buf).toEqual(Buffer.from([0x78, 0x56, 0x34, 0x12]));
    });

    it('should create swapped copy', () => {
      const original = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      const swapped = DataSwapper.createSwapped(original, 4);
      expect(swapped).toEqual(Buffer.from([0x78, 0x56, 0x34, 0x12]));
      expect(original).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78]));
    });
  });

  describe('BYTE-001: Cross-platform compatibility', () => {
    it('should handle BE data on any machine', () => {
      const reader = new AdaptiveReader();
      // Simulate BE data with magic
      const beData = Buffer.from([0x48, 0x43, 0x58, 0x32]);
      const order = new ByteOrderDetector().detect(beData);
      expect(order).toBe('BE');
    });

    it('should handle LE data on any machine', () => {
      const leData = Buffer.alloc(4);
      leData.writeUInt32LE(0x58545348, 0);
      const order = new ByteOrderDetector().detect(leData);
      expect(order).toBe('LE');
    });
  });
});
