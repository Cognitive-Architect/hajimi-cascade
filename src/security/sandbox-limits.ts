/**
 * sandbox-limits.ts - B-02: 格式特定安全限制
 * 定义各压缩格式的zip bomb检测阈值
 */

import { CompressionFormat } from './format-detector';

/** 各格式压缩比限制 */
export const FORMAT_LIMITS: Record<CompressionFormat, number> = {
  [CompressionFormat.GZIP]: 100,   // gzip限制100:1
  [CompressionFormat.BZIP2]: 50,   // bzip2限制50:1（更严格）
  [CompressionFormat.ZLIB]: 80,    // zlib限制80:1
  [CompressionFormat.UNKNOWN]: 100, // 未知格式通用限制
};

/** 快速访问常量 */
export const GZIP_LIMIT = 100;
export const BZIP2_LIMIT = 50;
export const ZLIB_LIMIT = 80;
export const DEFAULT_COMPRESSION_LIMIT = 100;

/** 获取格式限制（便捷函数） */
export function getCompressionLimit(format: CompressionFormat): number {
  return FORMAT_LIMITS[format] ?? DEFAULT_COMPRESSION_LIMIT;
}

export default {
  FORMAT_LIMITS,
  GZIP_LIMIT,
  BZIP2_LIMIT,
  ZLIB_LIMIT,
  DEFAULT_COMPRESSION_LIMIT,
  getCompressionLimit,
};
