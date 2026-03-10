/**
 * input-sandbox.ts - Wave 3: 输入沙箱安全层 (B-02更新: 多格式zip bomb检测)
 * 
 * 多层安全防护策略：
 * - 100MB文件大小限制（防磁盘耗尽）
 * - zip bomb检测（格式特定阈值：gzip 100:1, bzip2 50:1, zlib 80:1）
 * - 递归深度≤10（防栈溢出）
 * - 向量数≤100K（防内存耗尽）
 * - 单向量≤10MB（防大对象攻击）
 */

import { detectFormat, CompressionFormat, getFormatSpecificLimit } from './format-detector';
import { getCompressionLimit, GZIP_LIMIT, BZIP2_LIMIT, ZLIB_LIMIT } from './sandbox-limits';

/** 沙箱限制配置 */
export interface SandboxLimits {
  maxFileSizeMB: number;
  maxCompressionRatio: number;
  maxRecursionDepth: number;
  maxVectorCount: number;
  maxVectorSizeMB: number;
  /** @deprecated 使用格式特定限制 */
  perFormatLimits?: Record<CompressionFormat, number>;
}

/** 默认安全限制（生产级配置） */
export const DEFAULT_LIMITS: SandboxLimits = {
  maxFileSizeMB: 100,
  maxCompressionRatio: 100, // 向后兼容：通用限制
  maxRecursionDepth: 10,
  maxVectorCount: 100000,
  maxVectorSizeMB: 10,
};

/** 沙箱验证结果 */
export interface SandboxResult {
  allowed: boolean;
  reason?: string;
  metadata?: {
    fileSizeMB: number;
    uncompressedSizeMB?: number;
    compressionRatio?: number;
    format?: CompressionFormat;
    formatLimit?: number;
    vectorCount?: number;
  };
}

/** 验证文件大小（100MB限制） */
export function validateFileSize(sizeBytes: number, limits: SandboxLimits = DEFAULT_LIMITS): boolean {
  const sizeMB = sizeBytes / (1024 * 1024);
  return sizeMB <= limits.maxFileSizeMB;
}

/**
 * 检测zip bomb攻击（B-02: 格式特定限制）
 * 压缩比超过格式特定阈值视为可疑炸弹
 * - gzip: 100:1
 * - bzip2: 50:1（更严格）
 * - zlib: 80:1
 */
export function detectZipBomb(
  compressed: number,
  uncompressed: number,
  limits?: SandboxLimits,
  format?: CompressionFormat
): boolean {
  if (compressed === 0) return true;
  
  // B-02: 使用格式特定限制
  const formatLimit = format ? getCompressionLimit(format) : (limits?.maxCompressionRatio ?? 100);
  return (uncompressed / compressed) > formatLimit;
}

/**
 * 检测压缩数据中的zip bomb（B-02新函数）
 * 自动检测格式并应用对应限制
 */
export function detectCompressedZipBomb(
  compressedData: Buffer,
  uncompressedSize: number
): { isBomb: boolean; format: CompressionFormat; limit: number; ratio: number } {
  const format = detectFormat(compressedData);
  const limit = getCompressionLimit(format.format);
  const ratio = uncompressedSize / compressedData.length;
  const isBomb = ratio > limit;
  
  return {
    isBomb,
    format: format.format,
    limit,
    ratio,
  };
}

/** 验证递归深度（≤10，防栈溢出） */
export function validateRecursionDepth(depth: number, limits: SandboxLimits = DEFAULT_LIMITS): boolean {
  return depth <= limits.maxRecursionDepth;
}

/** 验证向量数量（≤100K，防内存耗尽） */
export function validateVectorCount(count: number, limits: SandboxLimits = DEFAULT_LIMITS): boolean {
  return count <= limits.maxVectorCount;
}

/** 验证单向量大小（≤10MB，防大对象攻击） */
export function validateVectorSize(sizeBytes: number, limits: SandboxLimits = DEFAULT_LIMITS): boolean {
  const sizeMB = sizeBytes / (1024 * 1024);
  return sizeMB <= limits.maxVectorSizeMB;
}

/**
 * 完整沙箱验证（B-02: 支持格式检测）
 * 执行所有安全检查，返回详细结果
 */
export function validateInput(
  fileData: Buffer,
  options?: { 
    uncompressedSize?: number; 
    recursionDepth?: number; 
    vectorCount?: number;
    detectFormat?: boolean; // B-02: 启用格式检测
  }
): SandboxResult {
  const limits = DEFAULT_LIMITS;
  const fileSizeMB = fileData.length / (1024 * 1024);

  // 1. 文件大小检查
  if (!validateFileSize(fileData.length, limits)) {
    return {
      allowed: false,
      reason: `File size ${fileSizeMB.toFixed(1)}MB exceeds limit ${limits.maxFileSizeMB}MB`,
      metadata: { fileSizeMB },
    };
  }

  // 2. zip bomb检测（B-02: 格式特定）
  if (options?.uncompressedSize) {
    const ratio = options.uncompressedSize / fileData.length;
    let format: CompressionFormat = CompressionFormat.UNKNOWN;
    let limit = limits.maxCompressionRatio;
    
    // B-02: 如果启用格式检测，使用格式特定限制
    if (options?.detectFormat !== false) {
      const detected = detectFormat(fileData);
      format = detected.format;
      limit = getCompressionLimit(format);
    }
    
    if (detectZipBomb(fileData.length, options.uncompressedSize, limits, format)) {
      return {
        allowed: false,
        reason: `Zip bomb detected: compression ratio ${ratio.toFixed(0)}:1 exceeds ${limit}:1 (format: ${format})`,
        metadata: {
          fileSizeMB,
          uncompressedSizeMB: options.uncompressedSize / (1024 * 1024),
          compressionRatio: ratio,
          format,
          formatLimit: limit,
        },
      };
    }
  }

  // 3. 递归深度检查
  if (options?.recursionDepth !== undefined && !validateRecursionDepth(options.recursionDepth, limits)) {
    return {
      allowed: false,
      reason: `Recursion depth ${options.recursionDepth} exceeds limit ${limits.maxRecursionDepth}`,
      metadata: { fileSizeMB },
    };
  }

  // 4. 向量数量检查
  if (options?.vectorCount !== undefined && !validateVectorCount(options.vectorCount, limits)) {
    return {
      allowed: false,
      reason: `Vector count ${options.vectorCount} exceeds limit ${limits.maxVectorCount}`,
      metadata: { fileSizeMB, vectorCount: options.vectorCount },
    };
  }

  return { allowed: true, metadata: { fileSizeMB } };
}

/**
 * 安全JSON解析
 * 带大小限制防止内存耗尽攻击
 */
export function safeJsonParse(jsonString: string, maxSizeMB: number = 100): any {
  const sizeMB = Buffer.byteLength(jsonString) / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    throw new Error(`JSON size ${sizeMB.toFixed(1)}MB exceeds limit ${maxSizeMB}MB`);
  }
  return JSON.parse(jsonString);
}

/** 向量维度验证（≤768维标准） */
export function validateVectorDimensions(dimensions: number, maxDim: number = 768): boolean {
  return dimensions > 0 && dimensions <= maxDim;
}

export default {
  validateInput,
  validateFileSize,
  detectZipBomb,
  detectCompressedZipBomb, // B-02导出
  validateRecursionDepth,
  validateVectorCount,
  validateVectorSize,
  safeJsonParse,
  validateVectorDimensions,
  DEFAULT_LIMITS,
  // B-02: 导出格式限制常量
  GZIP_LIMIT,
  BZIP2_LIMIT,
  ZLIB_LIMIT,
  CompressionFormat,
};
