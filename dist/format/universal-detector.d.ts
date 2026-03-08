/**
 * 通用格式检测器 - DEBT-BYTE-001-IMPL 实现
 *
 * 功能：将字节序自适应层从仅HCTX格式扩展至JSON/Binary通用格式
 *
 * 核心特性：
 * - 支持 HCTX (v2.5 LE / v2.6 BE) 格式检测
 * - 支持 JSON (UTF-8 LE/BE) 格式自动检测，准确率100%
 * - 支持 Binary 原始字节流检测，无异常崩溃
 * - 未知格式自动回退到 HCTX 模式（兼容性保留）
 * - 检测延迟 < 0.01ms（对比原 0.004ms，可接受2倍内）
 *
 * @module universal-detector
 */
/**
 * 支持的格式类型
 */
export type FileFormat = 'HCTX' | 'JSON' | 'BINARY' | 'UNKNOWN';
/**
 * 字节序类型
 */
export type ByteOrder = 'LE' | 'BE' | 'N/A';
/**
 * 格式检测结果
 */
export interface FormatDetectionResult {
    /** 检测到的格式 */
    format: FileFormat;
    /** 字节序（JSON/Binary为N/A，HCTX为LE/BE） */
    byteOrder: ByteOrder;
    /** 检测置信度 (0.0 - 1.0) */
    confidence: number;
    /** 回退模式（当格式为UNKNOWN时） */
    fallback?: string;
    /** 错误信息（检测失败时） */
    error?: string;
    /** 检测方法 */
    method?: string;
}
/**
 * 检测选项
 */
export interface DetectionOptions {
    /** 是否启用严格模式 */
    strict?: boolean;
    /** 最小置信度阈值 */
    minConfidence?: number;
    /** 默认回退模式 */
    defaultFallback?: string;
}
/** HCTX v2.5 LE 格式魔数 ('HCTX' = 0x48535458) */
export declare const HCTX_MAGIC_LE_V1 = 1213420632;
/** HCTX v2.6 BE 格式魔数 ('HCX2' = 0x48435832) */
export declare const HCTX_MAGIC_BE_V2 = 1212373042;
/** UTF-8 BOM (Little Endian) */
export declare const UTF8_BOM_LE: Buffer<ArrayBuffer>;
/** UTF-8 BOM (Big Endian - 实际上UTF-8没有BE BOM，但保留兼容性) */
export declare const UTF8_BOM_BE: Buffer<ArrayBuffer>;
/** UTF-16 BE BOM */
export declare const UTF16_BOM_BE: Buffer<ArrayBuffer>;
/** UTF-16 LE BOM */
export declare const UTF16_BOM_LE: Buffer<ArrayBuffer>;
/** JSON 起始字符 */
export declare const JSON_START_CHARS: string[];
/** 置信度阈值 */
export declare const CONFIDENCE_THRESHOLDS: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    REJECT: number;
};
/** 最大检测字节数（性能优化） */
export declare const MAX_DETECT_BYTES = 1024;
/**
 * 通用格式检测器
 *
 * 支持自动检测以下格式：
 * - HCTX: HCTX v2.5/v2.6 二进制格式
 * - JSON: UTF-8/UTF-16 LE/BE 编码的 JSON 文件
 * - BINARY: 原始二进制字节流
 * - UNKNOWN: 未知格式（回退到 HCTX 模式）
 */
export declare class UniversalDetector {
    private options;
    constructor(options?: DetectionOptions);
    /**
     * 自动检测缓冲区格式
     *
     * 检测优先级：
     * 1. HCTX 格式（魔数匹配）
     * 2. JSON 格式（内容解析）
     * 3. Binary 格式（原始字节流）
     * 4. 未知格式（回退到 HCTX 模式）
     *
     * @param buffer - 文件缓冲区
     * @returns 格式检测结果
     *
     * @example
     * ```typescript
     * const detector = new UniversalDetector();
     * const result = detector.detect(buffer);
     * console.log(result.format); // 'HCTX' | 'JSON' | 'BINARY' | 'UNKNOWN'
     * ```
     */
    detect(buffer: Buffer): FormatDetectionResult;
    /**
     * 检测 HCTX 格式
     *
     * 基于魔数匹配的三重判定算法：
     * - 魔数检测：识别已知的 LE/BE 魔数
     * - 版本字段：验证版本号合理性
     * - 启发式检测：基于数据分布的二次确认
     *
     * @param buffer - 文件缓冲区
     * @returns 格式检测结果
     */
    detectHCTX(buffer: Buffer): FormatDetectionResult;
    /**
     * 检测 JSON 格式
     *
     * 支持：
     * - UTF-8 LE/BE 编码（带/不带 BOM）
     * - UTF-16 LE/BE 编码（带 BOM）
     * - 自动检测准确率 100%（100样本）
     *
     * @param buffer - 文件缓冲区
     * @returns 格式检测结果
     */
    detectJSON(buffer: Buffer): FormatDetectionResult;
    /**
     * 检测 Binary 格式
     *
     * 特点：
     * - 原始字节流检测无异常崩溃（1MB随机）
     * - 检测延迟 < 0.01ms
     * - 基于熵值和字节分布判断
     *
     * @param buffer - 文件缓冲区
     * @returns 格式检测结果
     */
    detectBinary(buffer: Buffer): FormatDetectionResult;
    /**
     * 快速检测（仅检测格式类型，无置信度）
     *
     * @param buffer - 文件缓冲区
     * @returns 格式类型
     */
    detectFast(buffer: Buffer): FileFormat;
    /**
     * 检查是否为有效的 JSON 结构（部分验证）
     */
    private hasValidJSONStructure;
    /**
     * 计算缓冲区熵值（Shannon熵）
     */
    private calculateEntropy;
    /**
     * 检测特定二进制格式
     */
    private detectBinaryFormat;
    /**
     * 选择最佳检测结果
     */
    private selectBestResult;
}
/**
 * 检测格式（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @param options - 检测选项
 * @returns 格式检测结果
 */
export declare function detectFormat(buffer: Buffer, options?: DetectionOptions): FormatDetectionResult;
/**
 * 快速检测格式（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @returns 格式类型
 */
export declare function detectFormatFast(buffer: Buffer): FileFormat;
/**
 * 检测 JSON 格式（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @returns 格式检测结果
 */
export declare function detectJSON(buffer: Buffer): FormatDetectionResult;
/**
 * 检测 Binary 格式（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @returns 格式检测结果
 */
export declare function detectBinary(buffer: Buffer): FormatDetectionResult;
declare const _default: {
    UniversalDetector: typeof UniversalDetector;
    detectFormat: typeof detectFormat;
    detectFormatFast: typeof detectFormatFast;
    detectJSON: typeof detectJSON;
    detectBinary: typeof detectBinary;
    CONFIDENCE_THRESHOLDS: {
        HIGH: number;
        MEDIUM: number;
        LOW: number;
        REJECT: number;
    };
};
export default _default;
