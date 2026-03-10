"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LIMITS = void 0;
exports.validateFileSize = validateFileSize;
exports.detectZipBomb = detectZipBomb;
exports.validateRecursionDepth = validateRecursionDepth;
exports.validateVectorCount = validateVectorCount;
exports.validateVectorSize = validateVectorSize;
exports.validateInput = validateInput;
exports.safeJsonParse = safeJsonParse;
exports.validateVectorDimensions = validateVectorDimensions;
/** 默认安全限制（生产级配置） */
exports.DEFAULT_LIMITS = {
    maxFileSizeMB: 100,
    maxCompressionRatio: 100,
    maxRecursionDepth: 10,
    maxVectorCount: 100000,
    maxVectorSizeMB: 10,
};
/** 验证文件大小（100MB限制） */
function validateFileSize(sizeBytes, limits = exports.DEFAULT_LIMITS) {
    const sizeMB = sizeBytes / (1024 * 1024);
    return sizeMB <= limits.maxFileSizeMB;
}
/**
 * 检测zip bomb攻击
 * 压缩比超过100:1视为可疑炸弹
 */
function detectZipBomb(compressed, uncompressed, limits = exports.DEFAULT_LIMITS) {
    if (compressed === 0)
        return true; // 除零保护
    return (uncompressed / compressed) > limits.maxCompressionRatio;
}
/** 验证递归深度（≤10，防栈溢出） */
function validateRecursionDepth(depth, limits = exports.DEFAULT_LIMITS) {
    return depth <= limits.maxRecursionDepth;
}
/** 验证向量数量（≤100K，防内存耗尽） */
function validateVectorCount(count, limits = exports.DEFAULT_LIMITS) {
    return count <= limits.maxVectorCount;
}
/** 验证单向量大小（≤10MB，防大对象攻击） */
function validateVectorSize(sizeBytes, limits = exports.DEFAULT_LIMITS) {
    const sizeMB = sizeBytes / (1024 * 1024);
    return sizeMB <= limits.maxVectorSizeMB;
}
/**
 * 完整沙箱验证
 * 执行所有安全检查，返回详细结果
 */
function validateInput(fileData, options) {
    const limits = exports.DEFAULT_LIMITS;
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
function safeJsonParse(jsonString, maxSizeMB = 100) {
    const sizeMB = Buffer.byteLength(jsonString) / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
        throw new Error(`JSON size ${sizeMB.toFixed(1)}MB exceeds limit ${maxSizeMB}MB`);
    }
    return JSON.parse(jsonString);
}
/** 向量维度验证（≤768维标准） */
function validateVectorDimensions(dimensions, maxDim = 768) {
    return dimensions > 0 && dimensions <= maxDim;
}
exports.default = {
    validateInput,
    validateFileSize,
    detectZipBomb,
    validateRecursionDepth,
    validateVectorCount,
    validateVectorSize,
    safeJsonParse,
    validateVectorDimensions,
    DEFAULT_LIMITS: exports.DEFAULT_LIMITS,
};
//# sourceMappingURL=input-sandbox.js.map