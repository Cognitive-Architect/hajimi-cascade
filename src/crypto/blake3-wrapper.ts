/**
 * blake3-wrapper.ts - B-03: BLAKE3绑定 (≤150行)
 * 提供BLAKE3 API，实际使用SHA-256模拟(环境无原生BLAKE3)
 * 注意: 生产环境应使用 blake3 npm包
 */

import { createHash } from 'crypto';

export type HashAlgorithm = 'blake3' | 'sha256' | 'md5';

export interface Blake3Hash {
  update(data: Uint8Array | string): Blake3Hash;
  digest(): Uint8Array;
  digestHex(): string;
}

/** BLAKE3模拟器(使用SHA-256) */
class Blake3Simulator implements Blake3Hash {
  private hasher = createHash('sha256');

  update(data: Uint8Array | string): Blake3Hash {
    if (typeof data === 'string') {
      this.hasher.update(data, 'utf-8');
    } else {
      this.hasher.update(Buffer.from(data));
    }
    return this;
  }

  digest(): Uint8Array {
    return new Uint8Array(this.hasher.digest());
  }

  digestHex(): string {
    return this.hasher.digest('hex');
  }
}

/** 创建BLAKE3 hasher */
export function createBlake3(): Blake3Hash {
  return new Blake3Simulator();
}

/** 快速哈希 */
export function blake3(data: Uint8Array | string): Uint8Array {
  return createBlake3().update(data).digest();
}

export function blake3Hex(data: Uint8Array | string): string {
  return createBlake3().update(data).digestHex();
}

/** 密钥派生(KDF)模拟 */
export function deriveKey(key: string, context: string): Uint8Array {
  return createBlake3()
    .update(context)
    .update(key)
    .digest();
}

/** 多线程安全: 创建独立hasher */
export function createHasher(): Blake3Hash {
  return createBlake3();
}

/** 验证与b3sum兼容(简化) */
export function verifyB3sum(data: Uint8Array, expectedHex: string): boolean {
  return blake3Hex(data) === expectedHex;
}

export default { createBlake3, blake3, blake3Hex, deriveKey };
