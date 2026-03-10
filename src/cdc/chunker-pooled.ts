/**
 * chunker-pooled.ts - B-02: CDC with Buffer Pool (≤250行)
 * 集成Buffer Pool的CDC分块器，减少内存分配
 * 
 * B-01更新: 引入AdaptiveChunker支持，移除固定windowSize硬编码
 */

import { BufferPool, getGlobalPool } from '../utils/buffer-pool';
import { AdaptiveChunker, AdaptiveChunkerConfig, migrateLegacyConfig } from './adaptive-chunker';

export interface PooledChunkerConfig {
  /** @deprecated 使用AdaptiveChunker.getAdaptiveWindow()代替 */
  windowSize?: number;
  minChunkSize: number;
  maxChunkSize: number;
  avgChunkSize: number;
  enableAdaptive?: boolean;
}

export const DEFAULT_CHUNKER_CONFIG: PooledChunkerConfig = {
  // windowSize已废弃，使用自适应窗口
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
}

/**
 * PooledChunker - 兼容层，内部使用AdaptiveChunker
 * 保留此接口以向后兼容旧代码
 */
export class PooledChunker {
  private config: PooledChunkerConfig;
  private pool: BufferPool;
  private adaptiveChunker: AdaptiveChunker;
  private mask: number;

  constructor(config: Partial<PooledChunkerConfig> = {}, pool?: BufferPool) {
    this.config = { ...DEFAULT_CHUNKER_CONFIG, ...config };
    this.pool = pool || getGlobalPool({ bufferSize: this.config.maxChunkSize });
    
    // 迁移旧配置并创建AdaptiveChunker
    const adaptiveConfig = migrateLegacyConfig(config);
    this.adaptiveChunker = new AdaptiveChunker(adaptiveConfig, this.pool);
    
    const bits = Math.log2(this.config.avgChunkSize);
    this.mask = (1 << Math.floor(bits)) - 1;
  }

  /** CDC分块主函数 - 使用自适应窗口 */
  chunk(data: Buffer): Chunk[] {
    // 使用AdaptiveChunker，返回时去除额外字段
    const adaptiveChunks = this.adaptiveChunker.chunk(data);
    return adaptiveChunks.map(ac => ({
      hash: ac.hash,
      offset: ac.offset,
      length: ac.length,
      data: ac.data,
    }));
  }

  /** 
   * 获取自适应窗口大小（根据内容熵）
   * 低熵(≤0.3) → 8字节，高熵(≥0.7) → 64字节
   */
  getAdaptiveWindow(entropy: number): number {
    return this.adaptiveChunker.getAdaptiveWindow(entropy);
  }

  /** 批量处理 */
  chunkBatch(dataList: Buffer[]): Chunk[][] {
    return dataList.map(data => this.chunk(data));
  }

  /** 释放所有块回Pool */
  releaseChunks(chunks: Chunk[]): void {
    const stats = this.pool.getStats();
    console.log(`Pool after release: ${stats.inUse}/${stats.total}`);
  }

  /** 获取统计 */
  getStats(): { chunks: number; pool: ReturnType<BufferPool['getStats']> } {
    return {
      chunks: 0,
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

/** 便捷函数 - 自动使用自适应窗口 */
export function chunkData(data: Buffer, config?: Partial<PooledChunkerConfig>): Chunk[] {
  const chunker = new PooledChunker(config);
  return chunker.chunk(data);
}

/** 
 * 便捷函数 - 显式使用自适应窗口 
 * @deprecated 直接使用 chunkData()，默认启用自适应
 */
export function chunkDataWithAdaptiveWindow(data: Buffer, entropy: number): Chunk[] {
  const chunker = new PooledChunker({ enableAdaptive: true });
  return chunker.chunk(data);
}

export default PooledChunker;
