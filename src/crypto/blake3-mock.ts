/**
 * blake3-mock.ts - 测试用BLAKE3 Mock
 * 当 blake3-jit 不可用时使用
 */
import { createHash } from 'crypto';

export function hash(data: Buffer): Uint8Array {
  // Mock: 使用SHA-256模拟BLAKE3输出(32字节)
  return new Uint8Array(createHash('sha256').update(data).digest());
}

export interface Hasher {
  update(data: Buffer): void;
  finalize(): Uint8Array;
}

export function createHasher(): Hasher {
  const chunks: Buffer[] = [];
  return {
    update(data: Buffer) { chunks.push(data); },
    finalize() { return hash(Buffer.concat(chunks)); },
  };
}
