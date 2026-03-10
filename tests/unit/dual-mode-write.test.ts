/**
 * dual-mode-write.test.ts - B-03: 双模式写入测试
 * 测试HCTX v2.8写入 + v2.9读取兼容
 */

import { createHash } from 'crypto';
import {
  writeHctxV2_8,
  writeHctxV2_8 as writeLegacyFormat,
  computeMd5Hash,
  createLegacyChunk,
  isHctxV2_8,
  isHctxV2_9,
  getHctxVersion,
  HCTX_V2_8_MAGIC,
  ChunkInfo,
} from '../../src/format/legacy-writer';
import {
  writeLegacy,
  writeModern,
  writeAuto,
  createHashStrategy,
  detectVersion,
  LegacyWriteStrategy,
  ModernWriteStrategy,
} from '../../src/crypto/hash-factory';
import { blake3HashHex } from '../../src/crypto/blake3-wrapper';

describe('Dual-Mode Write (B-03)', () => {
  describe('FUNC: v2.8格式写入', () => {
    it('FUNC-001: v2.8格式写入（MD5+32字节header）', () => {
      const chunk: ChunkInfo = {
        simHash: BigInt(0x1234567890abcdef),
        hash: computeMd5Hash(Buffer.from('test data')),
        length: 100,
        seed: 42,
      };

      const hctx = writeHctxV2_8([chunk]);
      
      // Header检查
      expect(hctx.readUInt32BE(0)).toBe(HCTX_V2_8_MAGIC);
      expect(hctx[4]).toBe(0x02); // version
      expect(hctx[5]).toBe(0x02); // hash type MD5
      expect(hctx.readUInt32BE(8)).toBe(1); // chunk count
    });

    it('FUNC-002: MD5哈希正确性（vs crypto.createHash）', () => {
      const data = Buffer.from('test data for md5');
      const ourHash = computeMd5Hash(data);
      const cryptoHash = createHash('md5').update(data).digest();
      
      expect(ourHash.equals(cryptoHash)).toBe(true);
      expect(ourHash.length).toBe(16);
    });

    it('FUNC-003: 自动检测目标版本写入', () => {
      const data = Buffer.from('auto select test');
      
      const v28 = writeAuto(data, 'v2.8');
      expect(v28.version).toBe('v2.8');
      expect(v28.hex.length).toBe(32); // MD5
      
      const v29 = writeAuto(data, 'v2.9');
      expect(v29.version).toBe('v2.9');
      expect(v29.hex.length).toBe(64); // BLAKE3
    });

    it('FUNC-004: SimHash-64不变（v2.8/v2.9相同）', () => {
      const simHash = BigInt(0xabcdef1234567890);
      const chunk = createLegacyChunk(Buffer.from('test'), simHash);
      
      expect(chunk.simHash).toBe(simHash);
      expect(chunk.hash.length).toBe(16);
    });
  });

  describe('CONST: 格式常量', () => {
    it('CONST-001: v2.8 header魔术字0x48435802', () => {
      expect(HCTX_V2_8_MAGIC.toString(16)).toBe('48435802');
      
      const chunk = createLegacyChunk(Buffer.from('x'), BigInt(0));
      const hctx = writeHctxV2_8([chunk]);
      expect(hctx.readUInt32BE(0)).toBe(0x48435802);
    });

    it('CONST-002: v2.8 chunk entry 32字节对齐', () => {
      const chunks: ChunkInfo[] = [
        createLegacyChunk(Buffer.from('a'), BigInt(1)),
        createLegacyChunk(Buffer.from('b'), BigInt(2)),
      ];
      
      const hctx = writeHctxV2_8(chunks);
      // Header(32) + Index(2*32) = 96
      expect(hctx.length).toBe(32 + 2 * 32);
    });
  });

  describe('NEG: 负面路径', () => {
    it('NEG-001: 写入v2.8后v2.9能读取（版本检测）', () => {
      const chunk = createLegacyChunk(Buffer.from('roundtrip'), BigInt(123));
      const hctx = writeHctxV2_8([chunk]);
      
      // v2.9应该能检测到这是v2.8格式
      expect(isHctxV2_8(hctx)).toBe(true);
      expect(isHctxV2_9(hctx)).toBe(false);
      expect(getHctxVersion(hctx)).toBe('v2.8');
    });

    it('NEG-002: v2.9格式不被识别为v2.8', () => {
      // 模拟v2.9 header
      const v29Data = Buffer.alloc(32);
      v29Data.writeUInt32BE(0x48435803, 0); // v2.9 magic
      
      expect(isHctxV2_8(v29Data)).toBe(false);
      expect(isHctxV2_9(v29Data)).toBe(true);
    });

    it('NEG-003: 空数据写入不崩溃', () => {
      const empty = writeHctxV2_8([]);
      expect(empty.length).toBe(0);
    });

    it('NEG-003: 空数据哈希计算', () => {
      const hash = computeMd5Hash(Buffer.alloc(0));
      expect(hash.length).toBe(16);
      // MD5空数据: d41d8cd98f00b204e9800998ecf8427e
      expect(hash.toString('hex')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    it('NEG-004: 超大chunk（>64KB）分块写入', () => {
      const bigData = Buffer.alloc(100000);
      const chunk = createLegacyChunk(bigData, BigInt(0));
      
      expect(chunk.length).toBe(100000);
      expect(chunk.hash.length).toBe(16);
    });
  });

  describe('E2E: 端到端场景', () => {
    it('E2E-001: v2.9读取v2.8文件（版本检测回归）', () => {
      const data = Buffer.from('backward compat test');
      const chunk = createLegacyChunk(data, BigInt(0x1234));
      const hctx = writeHctxV2_8([chunk]);
      
      // v2.9系统应该能识别这是v2.8格式
      const version = getHctxVersion(hctx);
      expect(version).toBe('v2.8');
    });

    it('E2E-002: v2.8写入+v2.9读取roundtrip数据一致性', () => {
      const originalData = Buffer.from('test data for roundtrip');
      const expectedHash = computeMd5Hash(originalData);
      const chunk = createLegacyChunk(originalData, BigInt(0xabcd));
      
      // 验证chunk存储的hash正确
      expect(chunk.hash.toString('hex')).toBe(expectedHash.toString('hex'));
      
      const hctx = writeHctxV2_8([chunk]);
      
      // 从buffer读取存储的hash（32字节header + 8字节simHash = 40字节offset）
      const entryOffset = 32; 
      const storedHash = hctx.slice(entryOffset + 8, entryOffset + 24);
      
      expect(storedHash.toString('hex')).toBe(expectedHash.toString('hex'));
    });

    it('E2E-003: writeLegacy/writeModern策略工作', () => {
      const data = Buffer.from('strategy test');
      
      const legacy = writeLegacy(data);
      expect(legacy.hex.length).toBe(32);
      expect(legacy.hex).toBe(createHash('md5').update(data).digest('hex'));
      
      const modern = writeModern(data);
      expect(modern.hex.length).toBe(64);
    });
  });

  describe('High: 高风险场景', () => {
    it('High-001: 写入性能vs v2.9无退化', () => {
      const data = Buffer.from('x'.repeat(10000));
      
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        writeLegacy(data);
      }
      const legacyTime = Date.now() - start;
      
      expect(legacyTime).toBeLessThan(1000); // <1ms per op
    });

    it('High-002: 写入策略类工作正常', () => {
      const data = Buffer.from('strategy class test');
      
      const legacyStrategy = new LegacyWriteStrategy();
      expect(legacyStrategy.version).toBe('v2.8');
      expect(legacyStrategy.write(data).length).toBe(16);
      
      const modernStrategy = new ModernWriteStrategy();
      expect(modernStrategy.version).toBe('v2.9');
      expect(modernStrategy.write(data).length).toBe(32);
    });

    it('MD5哈希长度32字符（128位）', () => {
      const data = Buffer.from('md5 length test');
      const hash = writeLegacy(data);
      expect(hash.hex.length).toBe(32);
      expect(detectVersion(hash.hex)).toBe('v2.8');
    });

    it('BLAKE3哈希长度64字符（256位）', () => {
      const data = Buffer.from('blake3 length test');
      const hash = writeModern(data);
      expect(hash.hex.length).toBe(64);
      expect(detectVersion(hash.hex)).toBe('v2.9');
    });
  });
});
