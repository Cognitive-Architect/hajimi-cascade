/**
 * format-detector.ts - B-02: 压缩格式检测器 (≤120行)
 * 检测gzip/bzip2/zlib格式，支持zip bomb多格式防护
 */

/** 压缩格式枚举 */
export enum CompressionFormat {
  GZIP = 'gzip',
  BZIP2 = 'bzip2',
  ZLIB = 'zlib',
  UNKNOWN = 'unknown',
}

/** Magic字节定义 */
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);
const BZIP2_MAGIC = Buffer.from([0x42, 0x5a]); // "BZ"
const ZLIB_MAGIC_MASK = 0xf0;
const ZLIB_MAGIC_VALUE = 0x70; // 0x78xx, 0x78 0x9c, 0x78 0x01, 0x78 0xda

/** 格式检测结果 */
export interface FormatDetectionResult {
  format: CompressionFormat;
  confidence: 'high' | 'low' | 'none';
  magicBytes?: number[];
}

/**
 * 检测压缩格式
 * 基于文件magic字节识别gzip/bzip2/zlib
 * @param data - 输入数据（至少2字节）
 * @returns 格式检测结果
 */
export function detectFormat(data: Buffer): FormatDetectionResult {
  if (!data || data.length < 2) {
    return { format: CompressionFormat.UNKNOWN, confidence: 'none' };
  }

  // 检查gzip: 0x1f 0x8b
  if (data[0] === GZIP_MAGIC[0] && data[1] === GZIP_MAGIC[1]) {
    return {
      format: CompressionFormat.GZIP,
      confidence: 'high',
      magicBytes: [data[0], data[1]],
    };
  }

  // 检查bzip2: "BZ" (0x42 0x5a)
  if (data[0] === BZIP2_MAGIC[0] && data[1] === BZIP2_MAGIC[1]) {
    return {
      format: CompressionFormat.BZIP2,
      confidence: 'high',
      magicBytes: [data[0], data[1]],
    };
  }

  // 检查zlib: 0x78 xx (CMF字节)
  if ((data[0] & ZLIB_MAGIC_MASK) === ZLIB_MAGIC_VALUE) {
    const flg = data.length > 1 ? data[1] : 0;
    // 进一步验证：FCHECK校验
    const validZlib = ((data[0] << 8) + flg) % 31 === 0;
    return {
      format: CompressionFormat.ZLIB,
      confidence: validZlib ? 'high' : 'low',
      magicBytes: [data[0], flg],
    };
  }

  return { format: CompressionFormat.UNKNOWN, confidence: 'none' };
}

/**
 * 获取格式特定限制
 * 不同压缩算法有不同的炸弹风险
 */
export function getFormatSpecificLimit(format: CompressionFormat): number {
  switch (format) {
    case CompressionFormat.GZIP:
      return 100; // gzip限制100:1
    case CompressionFormat.BZIP2:
      return 50;  // bzip2更严格50:1
    case CompressionFormat.ZLIB:
      return 80;  // zlib限制80:1
    default:
      return 100; // 未知格式使用通用限制
  }
}

/**
 * 批量检测多个数据块
 */
export function detectFormats(dataList: Buffer[]): FormatDetectionResult[] {
  return dataList.map(data => detectFormat(data));
}

/**
 * 检查是否为压缩数据
 * 快速检查，用于预筛选
 */
export function isCompressed(data: Buffer): boolean {
  const result = detectFormat(data);
  return result.format !== CompressionFormat.UNKNOWN;
}

/**
 * 获取压缩格式显示名称
 */
export function getFormatDisplayName(format: CompressionFormat): string {
  const names: Record<CompressionFormat, string> = {
    [CompressionFormat.GZIP]: 'GZIP (RFC 1952)',
    [CompressionFormat.BZIP2]: 'BZip2',
    [CompressionFormat.ZLIB]: 'Zlib (RFC 1950)',
    [CompressionFormat.UNKNOWN]: 'Unknown/Raw',
  };
  return names[format] || 'Unknown';
}

/**
 * 检测并返回详细信息
 * 用于日志和调试
 */
export function detectFormatDetailed(data: Buffer): Required<FormatDetectionResult> & { displayName: string } {
  const result = detectFormat(data);
  return {
    ...result,
    magicBytes: result.magicBytes || [],
    displayName: getFormatDisplayName(result.format),
  };
}

export default {
  CompressionFormat,
  detectFormat,
  getFormatSpecificLimit,
  detectFormats,
  isCompressed,
  getFormatDisplayName,
  detectFormatDetailed,
};
