/**
 * blake3-wrapper.ts - B-02: BLAKE3真实现 (≤80行)
 * @debt BLAKE3-v2.9.1-001: 已清偿，现为真BLAKE3
 */

import { hash, createHasher, Hasher } from 'blake3-jit';

export class Blake3Wrapper {
  private hasher?: Hasher;

  constructor() {
    this.reset();
  }

  /** 重置哈希状态 */
  reset(): void {
    this.hasher = undefined;
  }

  /** 增量更新数据 */
  update(data: Buffer | string): this {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!this.hasher) {
      this.hasher = createHasher();
    }
    this.hasher.update(buf);
    return this;
  }

  /** 计算最终哈希值 */
  digest(): Buffer {
    if (!this.hasher) {
      return Buffer.from(hash(Buffer.alloc(0)));
    }
    return Buffer.from(this.hasher.finalize());
  }

  /** 计算十六进制哈希 */
  digestHex(): string {
    return this.digest().toString('hex');
  }

  /** 静态一次性哈希 */
  static hash(data: Buffer | string): Buffer {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.from(hash(buf));
  }

  /** 静态十六进制哈希 */
  static hashHex(data: Buffer | string): string {
    return Blake3Wrapper.hash(data).toString('hex');
  }
}

/** 便捷函数: 一次性哈希 */
export function blake3Hash(data: Buffer | string): Buffer {
  return Blake3Wrapper.hash(data);
}

/** 便捷函数: 十六进制哈希 */
export function blake3HashHex(data: Buffer | string): string {
  return Blake3Wrapper.hashHex(data);
}

export default Blake3Wrapper;
