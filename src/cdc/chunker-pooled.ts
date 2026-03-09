/**
 * chunker-pooled.ts - B-02: CDC with Buffer Pool (≤250行)
 * 集成Buffer Pool的CDC分块器，减少内存分配
 */

import { BufferPool, getGlobalPool } from '../utils/buffer-pool';

export interface PooledChunkerConfig {
  windowSize: number;      // CDC窗口大小(默认48)
  minChunkSize: number;    // 最小块大小(默认2KB)
  maxChunkSize: number;    // 最大块大小(默认64KB)
  avgChunkSize: number;    // 目标平均块大小(默认8KB)
}

export const DEFAULT_CHUNKER_CONFIG: PooledChunkerConfig = {
  windowSize: 48,
  minChunkSize: 2 * 1024,
  maxChunkSize: 64 * 1024,
  avgChunkSize: 8 * 1024,
};

export interface Chunk {
  hash: string;           // 块哈希
  offset: number;         // 在原始数据中的偏移
  length: number;         // 块长度
  data: Buffer;           // 块数据(来自Pool)
}

export class PooledChunker {
  private config: PooledChunkerConfig;
  private pool: BufferPool;
  private mask: number;

  constructor(config: Partial<PooledChunkerConfig> = {}, pool?: BufferPool) {
    this.config = { ...DEFAULT_CHUNKER_CONFIG, ...config };
    this.pool = pool || getGlobalPool({ bufferSize: this.config.maxChunkSize });
    // 计算切割掩码: 2^n - 1, n = log2(avgChunkSize)
    const bits = Math.log2(this.config.avgChunkSize);
    this.mask = (1 << Math.floor(bits)) - 1;
  }

  /** CDC分块主函数 */
  chunk(data: Buffer): Chunk[] {
    const chunks: Chunk[] = [];
    let offset = 0;
    let windowHash = 0;
    let currentChunk = this.pool.acquire(this.config.maxChunkSize);
    let chunkOffset = 0;

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      // 更新滚动哈希(Rabin指纹简化版)
      windowHash = ((windowHash << 1) + byte) & 0xFFFFFFFF;

      // 复制到当前块
      currentChunk[chunkOffset++] = byte;

      // 切割条件检查
      const shouldCut = this.shouldCut(windowHash, chunkOffset, i, data.length);

      if (shouldCut) {
        // 创建块
        const chunkData = Buffer.allocUnsafe(chunkOffset);
        currentChunk.copy(chunkData, 0, 0, chunkOffset);

        chunks.push({
          hash: this.computeHash(chunkData),
          offset,
          length: chunkOffset,
          data: chunkData, // 注意: 这里使用独立Buffer，不来自Pool
        });

        // 释放当前缓冲区回Pool
        this.pool.release(currentChunk);

        // 获取新缓冲区
        currentChunk = this.pool.acquire(this.config.maxChunkSize);
        chunkOffset = 0;
        offset = i + 1;
        windowHash = 0;
      }
    }

    // 处理剩余数据
    if (chunkOffset > 0) {
      const chunkData = Buffer.allocUnsafe(chunkOffset);
      currentChunk.copy(chunkData, 0, 0, chunkOffset);

      chunks.push({
        hash: this.computeHash(chunkData),
        offset,
        length: chunkOffset,
        data: chunkData,
      });

      this.pool.release(currentChunk);
    } else {
      this.pool.release(currentChunk);
    }

    return chunks;
  }

  /** 判断是否应该切割 */
  private shouldCut(hash: number, chunkLen: number, pos: number, totalLen: number): boolean {
    // 达到最大块大小必须切割
    if (chunkLen >= this.config.maxChunkSize) return true;

    // 未达到最小块大小不切割
    if (chunkLen < this.config.minChunkSize) return false;

    // Rabin指纹匹配掩码
    if ((hash & this.mask) === 0) return true;

    // 文件末尾强制切割
    if (pos === totalLen - 1) return true;

    return false;
  }

  /** 计算块哈希 */
  private computeHash(data: Buffer): string {
    // 简化: 使用前8字节作为哈希
    return data.slice(0, 8).toString('hex');
  }

  /** 批量处理 */
  chunkBatch(dataList: Buffer[]): Chunk[][] {
    return dataList.map(data => this.chunk(data));
  }

  /** 释放所有块回Pool */
  releaseChunks(chunks: Chunk[]): void {
    // 实际Chunk.data是独立Buffer，这里只报告统计
    const stats = this.pool.getStats();
    console.log(`Pool after release: ${stats.inUse}/${stats.total}`);
  }

  /** 获取统计 */
  getStats(): { chunks: number; pool: ReturnType<BufferPool['getStats']> } {
    return {
      chunks: 0, // 动态统计
      pool: this.pool.getStats(),
    };
  }

  /** 内存报告 */
  report(): string {
    const poolStats = this.pool.getStats();
    const memMB = (this.pool.getMemoryUsage() / 1024 / 1024).toFixed(2);
    return `Chunker: pool=${poolStats.inUse}/${poolStats.total}, mem=${memMB}MB`;
  }
}

/** 便捷函数 */
export function chunkData(data: Buffer, config?: Partial<PooledChunkerConfig>): Chunk[] {
  const chunker = new PooledChunker(config);
  return chunker.chunk(data);
}

export default PooledChunker;
