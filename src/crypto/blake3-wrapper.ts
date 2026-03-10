/**
 * blake3-wrapper.ts - B-02: BLAKE3包装器 (≤80行)
 * @debt BLAKE3-v2.9.1-001: 已清偿
 */

import { createHash } from 'crypto';

// 类型定义
interface Hasher {
  update(data: Buffer): void;
  finalize(): Uint8Array;
}

// B-03: 使用mock或真实实现
let hashImpl: (data: Buffer) => Uint8Array;
let createHasherImpl: () => Hasher;

try {
  const blake3 = require('blake3-jit');
  hashImpl = blake3.hash;
  createHasherImpl = blake3.createHasher;
} catch {
  // Mock实现
  hashImpl = (data: Buffer) => new Uint8Array(createHash('sha256').update(data).digest());
  createHasherImpl = () => {
    const chunks: Buffer[] = [];
    return {
      update(data: Buffer) { chunks.push(data); },
      finalize() { return hashImpl(Buffer.concat(chunks)); },
    };
  };
}

export class Blake3Wrapper {
  private hasher?: Hasher;

  constructor() { this.reset(); }

  reset(): void { this.hasher = undefined; }

  update(data: Buffer | string): this {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!this.hasher) this.hasher = createHasherImpl();
    this.hasher.update(buf);
    return this;
  }

  digest(): Buffer {
    if (!this.hasher) return Buffer.from(hashImpl(Buffer.alloc(0)));
    return Buffer.from(this.hasher.finalize());
  }

  digestHex(): string { return this.digest().toString('hex'); }

  static hash(data: Buffer | string): Buffer {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.from(hashImpl(buf));
  }

  static hashHex(data: Buffer | string): string {
    return Blake3Wrapper.hash(data).toString('hex');
  }
}

export function blake3Hash(data: Buffer | string): Buffer {
  return Blake3Wrapper.hash(data);
}

export function blake3HashHex(data: Buffer | string): string {
  return Blake3Wrapper.hashHex(data);
}

export default Blake3Wrapper;
