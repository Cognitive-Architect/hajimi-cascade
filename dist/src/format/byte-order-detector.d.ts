/**
 * 字节序检测器 - DEBT-BYTE-001 实现
 *
 * 功能：自动检测 HCTX 文件的字节序（LE/BE），解决 v2.5→v2.6 升级数据兼容性问题
 *
 * 核心算法：魔数+版本字段+启发式检测三重判定
 * - 魔数检测：识别已知的 LE/BE 魔数
 * - 版本字段：验证版本号合理性
 * - 启发式检测：基于数据分布的二次确认
 *
 * 安全红线：
 * - 无法检测时明确报错（Fail-fast）
 * - 不破坏 v2.6 BE 写入性能
 * - 自适应仅影响读取路径
 *
 * @module byte-order-detector
 */
/**
 * HCTX v2.5 LE 格式魔数 ('HCTX' = 0x48535458)
 * LE 字节序存储：58 54 53 48
 */
export declare const HCTX_MAGIC_LE_V1 = 1213420632;
/**
 * HCTX v2.6 BE 格式魔数 ('HCX2' = 0x48435832)
 * BE 字节序存储：48 43 58 32
 */
export declare const HCTX_MAGIC_BE_V2 = 1212373042;
/**
 * 魔数的小端序读取结果（用于交叉验证）
 * 当用 LE 方式读取 BE 魔数时得到的值
 */
export declare const HCTX_MAGIC_CROSS_V1 = 1481921352;
export declare const HCTX_MAGIC_CROSS_V2 = 844645192;
/** 支持的魔数列表（所有已知魔数） */
export declare const ALL_KNOWN_MAGICS: number[];
/** 版本号范围（用于启发式验证） */
export declare const VALID_VERSION_RANGES: {
    min: number;
    max: number;
};
/** 检测置信度阈值 */
export declare const CONFIDENCE_THRESHOLDS: {
    /** 高置信度：魔数完全匹配 */
    HIGH: number;
    /** 中等置信度：魔数+版本验证通过 */
    MEDIUM: number;
    /** 低置信度：启发式检测通过 */
    LOW: number;
    /** 拒绝阈值：低于此值视为未知 */
    REJECT: number;
};
/**
 * 字节序类型
 */
export type ByteOrder = 'LE' | 'BE' | 'UNKNOWN';
/**
 * 检测结果
 */
export interface ByteOrderDetectionResult {
    /** 检测到的字节序 */
    byteOrder: ByteOrder;
    /** 检测置信度 (0.0 - 1.0) */
    confidence: number;
    /** 使用的检测方法 */
    method: 'magic' | 'version' | 'heuristic' | 'unknown';
    /** 错误代码（检测失败时） */
    error?: ByteOrderErrorCode;
    /** 错误信息（检测失败时） */
    errorMessage?: string;
    /** 检测详情 */
    details: DetectionDetails;
}
/**
 * 错误代码枚举
 */
export declare enum ByteOrderErrorCode {
    /** 缓冲区太小 */
    BUFFER_TOO_SMALL = "BUFFER_TOO_SMALL",
    /** 未知的魔数 */
    UNKNOWN_MAGIC = "UNKNOWN_MAGIC",
    /** 版本号无效 */
    INVALID_VERSION = "INVALID_VERSION",
    /** 无法确定字节序 */
    UNKNOWN_BYTE_ORDER = "UNKNOWN_BYTE_ORDER",
    /** 魔数与版本矛盾 */
    MAGIC_VERSION_MISMATCH = "MAGIC_VERSION_MISMATCH"
}
/**
 * 检测详情
 */
export interface DetectionDetails {
    /** 原始魔数（按 LE 读取） */
    rawMagicLE: number;
    /** 原始魔数（按 BE 读取） */
    rawMagicBE: number;
    /** 原始版本（按 LE 读取） */
    rawVersionLE: number;
    /** 原始版本（按 BE 读取） */
    rawVersionBE: number;
    /** 检测到的魔数 */
    detectedMagic: number;
    /** 检测到的版本 */
    detectedVersion: number;
}
/**
 * 解析配置选项
 */
export interface DetectionOptions {
    /** 是否启用启发式检测 */
    enableHeuristic?: boolean;
    /** 最小置信度阈值（覆盖默认值） */
    minConfidence?: number;
    /** 是否严格模式（拒绝低置信度结果） */
    strict?: boolean;
}
/**
 * 字节序检测器类
 *
 * 实现三重判定算法：
 * 1. 魔数匹配：直接匹配已知的 LE/BE 魔数
 * 2. 版本验证：验证版本号是否在合理范围内
 * 3. 启发式检测：基于数据分布进行二次确认
 */
export declare class ByteOrderDetector {
    /**
     * 检测缓冲区字节序
     *
     * @param buffer - 文件缓冲区（至少 8 字节）
     * @param options - 检测选项
     * @returns 检测结果
     *
     * @example
     * ```typescript
     * const result = ByteOrderDetector.detect(buffer);
     * if (result.byteOrder === 'LE') {
     *   // 按小端序解析文件
     * }
     * ```
     */
    static detect(buffer: Buffer, options?: DetectionOptions): ByteOrderDetectionResult;
    /**
     * 快速检测（仅魔数匹配，最高性能）
     *
     * @param buffer - 文件缓冲区（至少 4 字节）
     * @returns 字节序或 UNKNOWN
     */
    static detectFast(buffer: Buffer): ByteOrder;
    /**
     * 魔数检测（第一重判定）
     */
    private static detectByMagic;
    /**
     * 版本号验证（第二重判定）
     */
    private static validateVersion;
    /**
     * 启发式检测（第三重判定）
     * 基于数据分布特征进行二次确认
     */
    private static heuristicDetection;
    /**
     * 验证版本号是否在有效范围内
     */
    private static isVersionValid;
    /**
     * 合并检测结果
     */
    private static combineResults;
    /**
     * 构建最终检测结果
     */
    private static buildResult;
}
/**
 * 检测字节序（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @param options - 检测选项
 * @returns 检测结果
 */
export declare function detectByteOrder(buffer: Buffer, options?: DetectionOptions): ByteOrderDetectionResult;
/**
 * 快速检测字节序（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @returns 字节序或 UNKNOWN
 */
export declare function detectByteOrderFast(buffer: Buffer): ByteOrder;
/**
 * 断言字节序可检测（Fail-fast）
 *
 * @param buffer - 文件缓冲区
 * @throws 如果无法检测字节序
 * @returns 检测结果
 */
export declare function assertByteOrderDetectable(buffer: Buffer): ByteOrderDetectionResult;
declare const _default: {
    ByteOrderDetector: typeof ByteOrderDetector;
    detectByteOrder: typeof detectByteOrder;
    detectByteOrderFast: typeof detectByteOrderFast;
    assertByteOrderDetectable: typeof assertByteOrderDetectable;
    HCTX_MAGIC_LE_V1: number;
    HCTX_MAGIC_BE_V2: number;
    ByteOrderErrorCode: typeof ByteOrderErrorCode;
    CONFIDENCE_THRESHOLDS: {
        /** 高置信度：魔数完全匹配 */
        HIGH: number;
        /** 中等置信度：魔数+版本验证通过 */
        MEDIUM: number;
        /** 低置信度：启发式检测通过 */
        LOW: number;
        /** 拒绝阈值：低于此值视为未知 */
        REJECT: number;
    };
};
export default _default;
//# sourceMappingURL=byte-order-detector.d.ts.map