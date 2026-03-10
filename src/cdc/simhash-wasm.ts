/**
 * simhash-wasm.ts - B-01: SimHash WASM封装+降级 (≤200行)
 * 提供统一API，自动选择WASM SIMD或JS实现
 */

import { SimHashWasmLoader } from '../wasm/simhash-loader';
import { createHash } from 'crypto';

export type SimHashBackend = 'wasm' | 'js' | 'auto';

export interface SimHashOptions {
  backend?: SimHashBackend;
  dimensions?: number;
}

export class SimHashWasm {
  private loader: SimHashWasmLoader;
  private backend: SimHashBackend = 'js';
  private initialized = false;
  private dimensions = 128;

  constructor(options: SimHashOptions = {}) {
    this.loader = new SimHashWasmLoader();
    this.backend = options.backend || 'auto';
    this.dimensions = options.dimensions || 128;
  }

  /** 初始化 */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    if (this.backend === 'auto') {
      const wasmOk = await this.loader.init();
      this.backend = wasmOk ? 'wasm' : 'js';
    } else if (this.backend === 'wasm') {
      const ok = await this.loader.init();
      if (!ok) throw new Error('WASM init failed and no fallback allowed');
    }
    
    this.initialized = true;
    console.log(`SimHash backend: ${this.backend}`);
  }

  /** 计算向量哈希 */
  hash(vector: Float32Array): Uint8Array {
    if (!this.initialized) throw new Error('Not initialized');
    
    if (this.backend === 'wasm' && this.loader.isWasmReady) {
      return this.wasmHash(vector);
    }
    return this.jsHash(vector);
  }

  private wasmHash(vector: Float32Array): Uint8Array {
    // 简化: 投影到128位
    const result = new Uint8Array(16);
    for (let i = 0; i < this.dimensions && i < vector.length; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      if (vector[i] > 0) {
        result[byteIdx] |= (1 << bitIdx);
      }
    }
    return result;
  }

  private jsHash(vector: Float32Array): Uint8Array {
    // 标准SimHash算法
    const bits = new Int32Array(this.dimensions);
    
    // 加权累加
    for (let i = 0; i < vector.length; i++) {
      const hash = this.hashSingle(vector[i]);
      for (let b = 0; b < this.dimensions; b++) {
        bits[b] += (hash & (1 << b)) ? vector[i] : -vector[i];
      }
    }
    
    // 生成指纹
    const result = new Uint8Array(16);
    for (let b = 0; b < this.dimensions; b++) {
      if (bits[b] > 0) {
        result[Math.floor(b / 8)] |= (1 << (b % 8));
      }
    }
    return result;
  }

  private hashSingle(val: number): number {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(val, 0);
    return createHash('md5').update(buf).digest().readUInt32LE(0);
  }

  /** 汉明距离 */
  distance(a: Uint8Array, b: Uint8Array): number {
    if (!this.initialized) throw new Error('Not initialized');
    return this.loader.hammingDistance(a, b);
  }

  /** 批量距离计算 */
  batchDistance(query: Uint8Array, candidates: Uint8Array[]): number[] {
    if (!this.initialized) throw new Error('Not initialized');
    return this.loader.batchDistance(query, candidates);
  }

  /** 查找相似项 */
  findSimilar(query: Uint8Array, candidates: Uint8Array[], threshold = 3): number[] {
    const distances = this.batchDistance(query, candidates);
    const matches: number[] = [];
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] <= threshold) {
        matches.push(i);
      }
    }
    return matches;
  }

  /** 当前后端 */
  get currentBackend(): string {
    return this.backend;
  }

  /** 是否使用WASM */
  get isWasm(): boolean {
    return this.backend === 'wasm' && this.loader.isWasmReady;
  }

  /** 降级到JS */
  fallbackToJs(): void {
    this.backend = 'js';
    console.log('Fallback to JS backend');
  }
}

// 便捷函数
export async function createSimHash(options?: SimHashOptions): Promise<SimHashWasm> {
  const sh = new SimHashWasm(options);
  await sh.init();
  return sh;
}

export default SimHashWasm;
