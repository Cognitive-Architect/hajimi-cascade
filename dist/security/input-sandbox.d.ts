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
    maxFileSizeMB: number;
    maxCompressionRatio: number;
    maxRecursionDepth: number;
    maxVectorCount: number;
    maxVectorSizeMB: number;
}
/** 默认安全限制（生产级配置） */
export declare const DEFAULT_LIMITS: SandboxLimits;
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
export declare function validateFileSize(sizeBytes: number, limits?: SandboxLimits): boolean;
/**
 * 检测zip bomb攻击
 * 压缩比超过100:1视为可疑炸弹
 */
export declare function detectZipBomb(compressed: number, uncompressed: number, limits?: SandboxLimits): boolean;
/** 验证递归深度（≤10，防栈溢出） */
export declare function validateRecursionDepth(depth: number, limits?: SandboxLimits): boolean;
/** 验证向量数量（≤100K，防内存耗尽） */
export declare function validateVectorCount(count: number, limits?: SandboxLimits): boolean;
/** 验证单向量大小（≤10MB，防大对象攻击） */
export declare function validateVectorSize(sizeBytes: number, limits?: SandboxLimits): boolean;
/**
 * 完整沙箱验证
 * 执行所有安全检查，返回详细结果
 */
export declare function validateInput(fileData: Buffer, options?: {
    uncompressedSize?: number;
    recursionDepth?: number;
    vectorCount?: number;
}): SandboxResult;
/**
 * 安全JSON解析
 * 带大小限制防止内存耗尽攻击
 */
export declare function safeJsonParse(jsonString: string, maxSizeMB?: number): any;
/** 向量维度验证（≤768维标准） */
export declare function validateVectorDimensions(dimensions: number, maxDim?: number): boolean;
declare const _default: {
    validateInput: typeof validateInput;
    validateFileSize: typeof validateFileSize;
    detectZipBomb: typeof detectZipBomb;
    validateRecursionDepth: typeof validateRecursionDepth;
    validateVectorCount: typeof validateVectorCount;
    validateVectorSize: typeof validateVectorSize;
    safeJsonParse: typeof safeJsonParse;
    validateVectorDimensions: typeof validateVectorDimensions;
    DEFAULT_LIMITS: SandboxLimits;
};
export default _default;
//# sourceMappingURL=input-sandbox.d.ts.map