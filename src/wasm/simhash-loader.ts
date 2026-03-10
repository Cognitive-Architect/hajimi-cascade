/**
 * simhash-loader.ts - B-01: WASM运行时绑定 (≤150行)
 * 负责WASM模块加载、内存管理、JS回退
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export interface WasmExports {
  memory: WebAssembly.Memory;
  hamming_distance: (q: number, c: number) => number;
  batch_distance: (q: number, cand: number, n: number, out: number) => void;
  filter_candidates: (q: number, cand: number, n: number, thresh: number, matches: number) => number;
  hash_equals: (a: number, b: number) => number;
  simd_supported: () => number;
}

export class SimHashWasmLoader {
  private wasm?: WebAssembly.Instance;
  private exports?: WasmExports;
  private memory?: WebAssembly.Memory;
  private useWasm = false;

  /** 检测环境是否支持WASM SIMD */
  static async supportsSimd(): Promise<boolean> {
    try {
      if (typeof WebAssembly !== 'object') return false;
      // 检测SIMD提案支持
      const simdTest = Uint8Array.from([
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x01, 0x7b, 0x01, 0x7b,
        0x03, 0x02, 0x01, 0x00, 0x07, 0x08, 0x01, 0x04,
        0x74, 0x65, 0x73, 0x74, 0x00, 0x00, 0x0a, 0x0a,
        0x01, 0x08, 0x00, 0x20, 0x00, 0xfd, 0x0f, 0x01,
        0x1a, 0x0b
      ]);
      await WebAssembly.compile(simdTest);
      return true;
    } catch {
      return false;
    }
  }

  /** 初始化WASM模块 */
  async init(wasmPath?: string): Promise<boolean> {
    if (!(await SimHashWasmLoader.supportsSimd())) {
      console.log('⚠️ WASM SIMD not supported, using JS fallback');
      return false;
    }
    try {
      const path = wasmPath || join(__dirname, 'simhash-simd.wasm');
      const wasmBuffer = await readFile(path);
      const module = await WebAssembly.compile(wasmBuffer);
      this.memory = new WebAssembly.Memory({ initial: 1 });
      this.wasm = await WebAssembly.instantiate(module, {
        env: { memory: this.memory }
      });
      this.exports = this.wasm.exports as unknown as WasmExports;
      this.useWasm = true;
      console.log('✅ WASM SIMD loaded');
      return true;
    } catch (err) {
      console.log('⚠️ WASM init failed:', err);
      return false;
    }
  }

  /** 分配内存 */
  alloc(size: number): number {
    if (!this.exports) throw new Error('WASM not initialized');
    const ptr = this.exports.memory.buffer.byteLength;
    const pages = Math.ceil((ptr + size) / 65536);
    const current = this.exports.memory.buffer.byteLength / 65536;
    if (pages > current) {
      this.exports.memory.grow(pages - current);
    }
    return 0; // 简化: 固定从0开始
  }

  /** 写入哈希数据 */
  writeHash(ptr: number, hash: Uint8Array): void {
    if (!this.memory) throw new Error('Not initialized');
    new Uint8Array(this.memory.buffer, ptr, 16).set(hash.slice(0, 16));
  }

  /** 汉明距离 (WASM或JS回退) */
  hammingDistance(a: Uint8Array, b: Uint8Array): number {
    if (!this.useWasm || !this.exports) {
      return this.jsHammingDistance(a, b);
    }
    this.writeHash(0, a);
    this.writeHash(16, b);
    return this.exports.hamming_distance(0, 16);
  }

  /** JS回退实现 */
  private jsHammingDistance(a: Uint8Array, b: Uint8Array): number {
    let dist = 0;
    for (let i = 0; i < 16; i++) {
      const xor = a[i] ^ b[i];
      dist += this.popcnt(xor);
    }
    return dist;
  }

  private popcnt(x: number): number {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >> 24;
  }

  /** 批量距离计算 */
  batchDistance(query: Uint8Array, candidates: Uint8Array[]): number[] {
    if (!this.useWasm || !this.exports) {
      return candidates.map(c => this.jsHammingDistance(query, c));
    }
    // WASM批量计算
    const n = candidates.length;
    const results = new Int32Array(n);
    this.writeHash(0, query);
    let offset = 16;
    for (const cand of candidates) {
      this.writeHash(offset, cand);
      offset += 16;
    }
    // 简化: 逐个调用
    return candidates.map((_, i) => 
      this.exports!.hamming_distance(0, 16 + i * 16)
    );
  }

  get isWasmReady(): boolean {
    return this.useWasm;
  }
}

export default SimHashWasmLoader;
