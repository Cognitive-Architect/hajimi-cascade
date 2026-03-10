/**
 * input-sandbox.ts - Wave 3: 输入沙箱安全层
 * 
 * 多层安全防护策略：
 * - 100MB文件大小限制（防磁盘耗尽）
 * - zip bomb检测（100:1压缩比阈值，防内存攻击）
 * - 递归深度≤10（防栈溢出）
 * - 向量数≤100K（防内存耗尽）
 * - 单向量≤10MB（防大对象攻击）
 */

/** 沙箱限制配置 */
export interface SandboxLimits {
  maxFileSizeMB: number;       // 最大文件大小
  maxCompressionRatio: number; // 最大压缩比（zip bomb检测）
  maxRecursionDepth: number;   // 最大递归深度
  maxVectorCount: number;      // 最大向量数量
  maxVectorSizeMB: number;     // 最大单向量大小
}

/** 默认安全限制（生产级配置） */
export const DEFAULT_LIMITS: SandboxLimits = {
  maxFileSizeMB: 100,
  maxCompressionRatio: 100,
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
    vectorCount?: number;
  };
}

/** 验证文件大小（100MB限制） */
export function validateFileSize(sizeBytes: number, limits: SandboxLimits = DEFAULT_LIMITS): boolean {
  const sizeMB = sizeBytes / (1024 * 1024);
  return sizeMB <= limits.maxFileSizeMB;
}

/**
 * 检测zip bomb攻击
 * 压缩比超过100:1视为可疑炸弹
 */
export function detectZipBomb(
  compressed: number,
  uncompressed: number,
  limits: SandboxLimits = DEFAULT_LIMITS
): boolean {
  if (compressed === 0) return true; // 除零保护
  return (uncompressed / compressed) > limits.maxCompressionRatio;
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
 * 完整沙箱验证
 * 执行所有安全检查，返回详细结果
 */
export function validateInput(
  fileData: Buffer,
  options?: { uncompressedSize?: number; recursionDepth?: number; vectorCount?: number }
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

  // 2. zip bomb检测
  if (options?.uncompressedSize) {
    const ratio = options.uncompressedSize / fileData.length;
    if (detectZipBomb(fileData.length, options.uncompressedSize, limits)) {
      return {
        allowed: false,
        reason: `Zip bomb detected: compression ratio ${ratio.toFixed(0)}:1 exceeds ${limits.maxCompressionRatio}:1`,
        metadata: {
          fileSizeMB,
          uncompressedSizeMB: options.uncompressedSize / (1024 * 1024),
          compressionRatio: ratio,
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
  validateRecursionDepth,
  validateVectorCount,
  validateVectorSize,
  safeJsonParse,
  validateVectorDimensions,
  DEFAULT_LIMITS,
};
