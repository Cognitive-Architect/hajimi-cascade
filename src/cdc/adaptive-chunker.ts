/**
 * adaptive-chunker.ts - B-01: Adaptive CDC动态窗口 (≤200行)
 * 根据内容熵自适应调整CDC窗口大小 (8-64字节范围)
 */

import { BufferPool, getGlobalPool } from '../utils/buffer-pool';
import { calculateEntropy, estimateEntropy } from '../utils/entropy';

export const MIN_WINDOW_SIZE = 8;
export const MAX_WINDOW_SIZE = 64;
const LOW_ENTROPY = 0.3;
const HIGH_ENTROPY = 0.7;

export interface AdaptiveChunkerConfig {
  minChunkSize: number;
  maxChunkSize: number;
  avgChunkSize: number;
  enableAdaptive: boolean;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveChunkerConfig = {
  minChunkSize: 2 * 1024,
  maxChunkSize: 64 * 1024,
  avgChunkSize: 8 * 1024,
  enableAdaptive: true,
};

export interface Chunk {
  hash: string;
  offset: number;
  length: number;
  data: Buffer;
  entropy: number;
  windowSize: number;
}

export class AdaptiveChunker {
  private config: AdaptiveChunkerConfig;
  private pool: BufferPool;
  private mask: number;

  constructor(config: Partial<AdaptiveChunkerConfig> = {}, pool?: BufferPool) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.pool = pool || getGlobalPool({ bufferSize: this.config.maxChunkSize });
    const bits = Math.log2(this.config.avgChunkSize);
    this.mask = (1 << Math.floor(bits)) - 1;
  }

  /** 根据熵计算自适应窗口大小，使用平滑过渡 */
  getAdaptiveWindow(entropy: number): number {
    const clamped = Math.max(0, Math.min(1, entropy));
    if (clamped <= LOW_ENTROPY) return MIN_WINDOW_SIZE;
    if (clamped >= HIGH_ENTROPY) return MAX_WINDOW_SIZE;
    const t = (clamped - LOW_ENTROPY) / (HIGH_ENTROPY - LOW_ENTROPY);
    return this.roundPowerOf2(MIN_WINDOW_SIZE + Math.round(t * (MAX_WINDOW_SIZE - MIN_WINDOW_SIZE)));
  }

  private roundPowerOf2(v: number): number {
    const p = Math.round(Math.log2(v));
    return Math.max(MIN_WINDOW_SIZE, Math.min(MAX_WINDOW_SIZE, 1 << p));
  }

  /** CDC分块主函数 - 自适应窗口 */
  chunk(data: Buffer): Chunk[] {
    if (!this.config.enableAdaptive) return this.chunkFixed(data, 32);
    const chunks: Chunk[] = [];
    let offset = 0, chunkOffset = 0, windowHash = 0;
    const globalEntropy = estimateEntropy(data, 2048);
    let windowSize = this.getAdaptiveWindow(globalEntropy);
    let localEntropy = globalEntropy;
    let currentChunk = this.pool.acquire(this.config.maxChunkSize);

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      windowHash = ((windowHash << 1) + byte) & 0xFFFFFFFF;
      currentChunk[chunkOffset++] = byte;

      if (chunkOffset % windowSize === 0 && i > 0) {
        const sample = data.subarray(Math.max(0, i - windowSize * 2), i + 1);
        localEntropy = calculateEntropy(sample);
        windowSize = this.smoothTransition(windowSize, this.getAdaptiveWindow(localEntropy));
      }

      if (this.shouldCut(windowHash, chunkOffset, i, data.length)) {
        const chunkData = Buffer.allocUnsafe(chunkOffset);
        currentChunk.copy(chunkData, 0, 0, chunkOffset);
        chunks.push({ hash: this.computeHash(chunkData), offset, length: chunkOffset, data: chunkData, entropy: localEntropy, windowSize });
        this.pool.release(currentChunk);
        currentChunk = this.pool.acquire(this.config.maxChunkSize);
        chunkOffset = 0; offset = i + 1; windowHash = 0;
        if (data.length - offset > 1024) {
          localEntropy = estimateEntropy(data.subarray(offset), 1024);
          windowSize = this.getAdaptiveWindow(localEntropy);
        }
      }
    }

    if (chunkOffset > 0) {
      const chunkData = Buffer.allocUnsafe(chunkOffset);
      currentChunk.copy(chunkData, 0, 0, chunkOffset);
      chunks.push({ hash: this.computeHash(chunkData), offset, length: chunkOffset, data: chunkData, entropy: localEntropy, windowSize });
      this.pool.release(currentChunk);
    } else {
      this.pool.release(currentChunk);
    }
    return chunks;
  }

  private smoothTransition(curr: number, target: number): number {
    const maxDelta = 8;
    return target > curr ? Math.min(target, curr + maxDelta) : Math.max(target, curr - maxDelta);
  }

  private chunkFixed(data: Buffer, windowSize: number): Chunk[] {
    const chunks: Chunk[] = [];
    let offset = 0, windowHash = 0, chunkOffset = 0;
    let currentChunk = this.pool.acquire(this.config.maxChunkSize);

    for (let i = 0; i < data.length; i++) {
      windowHash = ((windowHash << 1) + data[i]) & 0xFFFFFFFF;
      currentChunk[chunkOffset++] = data[i];
      if (this.shouldCut(windowHash, chunkOffset, i, data.length)) {
        const chunkData = Buffer.allocUnsafe(chunkOffset);
        currentChunk.copy(chunkData, 0, 0, chunkOffset);
        chunks.push({ hash: this.computeHash(chunkData), offset, length: chunkOffset, data: chunkData, entropy: 0.5, windowSize });
        this.pool.release(currentChunk);
        currentChunk = this.pool.acquire(this.config.maxChunkSize);
        chunkOffset = 0; offset = i + 1; windowHash = 0;
      }
    }
    if (chunkOffset > 0) {
      const chunkData = Buffer.allocUnsafe(chunkOffset);
      currentChunk.copy(chunkData, 0, 0, chunkOffset);
      chunks.push({ hash: this.computeHash(chunkData), offset, length: chunkOffset, data: chunkData, entropy: 0.5, windowSize });
      this.pool.release(currentChunk);
    } else {
      this.pool.release(currentChunk);
    }
    return chunks;
  }

  private shouldCut(hash: number, chunkLen: number, pos: number, totalLen: number): boolean {
    if (chunkLen >= this.config.maxChunkSize) return true;
    if (chunkLen < this.config.minChunkSize) return false;
    if ((hash & this.mask) === 0) return true;
    if (pos === totalLen - 1) return true;
    return false;
  }

  private computeHash(data: Buffer): string {
    return data.slice(0, 8).toString('hex');
  }
}

export function chunkDataAdaptive(data: Buffer, config?: Partial<AdaptiveChunkerConfig>): Chunk[] {
  return new AdaptiveChunker(config).chunk(data);
}

export function migrateLegacyConfig(old: { windowSize?: number }): AdaptiveChunkerConfig {
  return { ...DEFAULT_ADAPTIVE_CONFIG, enableAdaptive: true };
}

export default AdaptiveChunker;
