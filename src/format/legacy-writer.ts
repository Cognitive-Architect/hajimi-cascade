/**
 * legacy-writer.ts - B-03: HCTX v2.8 Legacy格式写入 (≤100行)
 */

import { createHash } from 'crypto';

export const HCTX_V2_8_MAGIC = 0x48435802;
export const HCTX_V2_9_MAGIC = 0x48435803;

export interface ChunkInfo {
  simHash: bigint;
  hash: Buffer;
  length: number;
  seed: number;
}

/** 写入HCTX v2.8格式（32字节header + N×32字节entry） */
export function writeHctxV2_8(chunks: ChunkInfo[]): Buffer {
  if (chunks.length === 0) return Buffer.alloc(0);

  const entrySize = 32;
  const headerSize = 32;
  const totalSize = headerSize + chunks.length * entrySize;
  const buf = Buffer.alloc(totalSize);

  // Write Header (32 bytes)
  buf.writeUInt32BE(HCTX_V2_8_MAGIC, 0);
  buf.writeUInt8(0x02, 4);
  buf.writeUInt8(0x02, 5);
  buf.writeUInt16BE(0, 6);
  buf.writeUInt32BE(chunks.length, 8);
  buf.writeUInt32BE(headerSize, 12);
  buf.writeUInt32BE(headerSize + chunks.length * entrySize, 16);
  buf.fill(0, 20, 32);

  // Write Index Entries at offset 32 (32 bytes each)
  let pos = 32;
  for (const chunk of chunks) {
    buf.writeBigUInt64BE(chunk.simHash, pos); pos += 8;
    const md5 = chunk.hash.length >= 16 ? chunk.hash.slice(0, 16) : Buffer.concat([chunk.hash, Buffer.alloc(16 - chunk.hash.length)]);
    md5.copy(buf, pos); pos += 16;
    buf.writeUInt32BE(chunk.length, pos); pos += 4;
    buf.writeUInt32BE(chunk.seed, pos); pos += 4;
  }

  return buf;
}

export function computeMd5Hash(data: Buffer): Buffer {
  return createHash('md5').update(data).digest();
}

export function createLegacyChunk(data: Buffer, simHash: bigint, seed: number = 0): ChunkInfo {
  return { simHash, hash: computeMd5Hash(data), length: data.length, seed };
}

export function isHctxV2_8(data: Buffer): boolean {
  return data.length >= 4 && data.readUInt32BE(0) === HCTX_V2_8_MAGIC;
}

export function isHctxV2_9(data: Buffer): boolean {
  return data.length >= 4 && data.readUInt32BE(0) === HCTX_V2_9_MAGIC;
}

export function getHctxVersion(data: Buffer): 'v2.8' | 'v2.9' | 'unknown' {
  if (isHctxV2_8(data)) return 'v2.8';
  if (isHctxV2_9(data)) return 'v2.9';
  return 'unknown';
}

export default { writeHctxV2_8, computeMd5Hash, createLegacyChunk, isHctxV2_8, isHctxV2_9, getHctxVersion, HCTX_V2_8_MAGIC, HCTX_V2_9_MAGIC };
