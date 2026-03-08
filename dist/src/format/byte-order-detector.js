"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ByteOrderDetector = exports.ByteOrderErrorCode = exports.CONFIDENCE_THRESHOLDS = exports.VALID_VERSION_RANGES = exports.ALL_KNOWN_MAGICS = exports.HCTX_MAGIC_CROSS_V2 = exports.HCTX_MAGIC_CROSS_V1 = exports.HCTX_MAGIC_BE_V2 = exports.HCTX_MAGIC_LE_V1 = void 0;
exports.detectByteOrder = detectByteOrder;
exports.detectByteOrderFast = detectByteOrderFast;
exports.assertByteOrderDetectable = assertByteOrderDetectable;
// ============================================================================
// 常量定义 - 魔数与版本
// ============================================================================
/**
 * HCTX v2.5 LE 格式魔数 ('HCTX' = 0x48535458)
 * LE 字节序存储：58 54 53 48
 */
exports.HCTX_MAGIC_LE_V1 = 0x48535458; // 'HCTX'
/**
 * HCTX v2.6 BE 格式魔数 ('HCX2' = 0x48435832)
 * BE 字节序存储：48 43 58 32
 */
exports.HCTX_MAGIC_BE_V2 = 0x48435832; // 'HCX2'
/**
 * 魔数的小端序读取结果（用于交叉验证）
 * 当用 LE 方式读取 BE 魔数时得到的值
 */
exports.HCTX_MAGIC_CROSS_V1 = 0x58545348; // 'HCTX' 用 BE 读取 LE 文件
exports.HCTX_MAGIC_CROSS_V2 = 0x32584348; // 'HCX2' 用 LE 读取 BE 文件
/** 支持的魔数列表（所有已知魔数） */
exports.ALL_KNOWN_MAGICS = [
    exports.HCTX_MAGIC_LE_V1,
    exports.HCTX_MAGIC_BE_V2,
    exports.HCTX_MAGIC_CROSS_V1,
    exports.HCTX_MAGIC_CROSS_V2
];
/** 版本号范围（用于启发式验证） */
exports.VALID_VERSION_RANGES = {
    min: 0x0100, // v1.0
    max: 0x0400 // v4.0
};
/** 检测置信度阈值 */
exports.CONFIDENCE_THRESHOLDS = {
    /** 高置信度：魔数完全匹配 */
    HIGH: 0.95,
    /** 中等置信度：魔数+版本验证通过 */
    MEDIUM: 0.80,
    /** 低置信度：启发式检测通过 */
    LOW: 0.60,
    /** 拒绝阈值：低于此值视为未知 */
    REJECT: 0.50
};
/**
 * 错误代码枚举
 */
var ByteOrderErrorCode;
(function (ByteOrderErrorCode) {
    /** 缓冲区太小 */
    ByteOrderErrorCode["BUFFER_TOO_SMALL"] = "BUFFER_TOO_SMALL";
    /** 未知的魔数 */
    ByteOrderErrorCode["UNKNOWN_MAGIC"] = "UNKNOWN_MAGIC";
    /** 版本号无效 */
    ByteOrderErrorCode["INVALID_VERSION"] = "INVALID_VERSION";
    /** 无法确定字节序 */
    ByteOrderErrorCode["UNKNOWN_BYTE_ORDER"] = "UNKNOWN_BYTE_ORDER";
    /** 魔数与版本矛盾 */
    ByteOrderErrorCode["MAGIC_VERSION_MISMATCH"] = "MAGIC_VERSION_MISMATCH";
})(ByteOrderErrorCode || (exports.ByteOrderErrorCode = ByteOrderErrorCode = {}));
// ============================================================================
// 核心检测算法
// ============================================================================
/**
 * 字节序检测器类
 *
 * 实现三重判定算法：
 * 1. 魔数匹配：直接匹配已知的 LE/BE 魔数
 * 2. 版本验证：验证版本号是否在合理范围内
 * 3. 启发式检测：基于数据分布进行二次确认
 */
class ByteOrderDetector {
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
    static detect(buffer, options = {}) {
        const opts = {
            enableHeuristic: true,
            minConfidence: exports.CONFIDENCE_THRESHOLDS.REJECT,
            strict: false,
            ...options
        };
        // 1. 缓冲区大小检查
        if (buffer.length < 8) {
            return {
                byteOrder: 'UNKNOWN',
                confidence: 0,
                method: 'unknown',
                error: ByteOrderErrorCode.BUFFER_TOO_SMALL,
                errorMessage: `Buffer too small: ${buffer.length} bytes, need at least 8 bytes`,
                details: {
                    rawMagicLE: 0,
                    rawMagicBE: 0,
                    rawVersionLE: 0,
                    rawVersionBE: 0,
                    detectedMagic: 0,
                    detectedVersion: 0
                }
            };
        }
        // 2. 读取原始值（两种字节序）
        const rawMagicLE = buffer.readUInt32LE(0);
        const rawMagicBE = buffer.readUInt32BE(0);
        const rawVersionLE = buffer.readUInt16LE(4);
        const rawVersionBE = buffer.readUInt16BE(4);
        // 3. 魔数检测（第一重判定）
        const magicResult = this.detectByMagic(rawMagicLE, rawMagicBE);
        if (magicResult.confidence >= exports.CONFIDENCE_THRESHOLDS.HIGH) {
            return this.buildResult(magicResult, {
                rawMagicLE,
                rawMagicBE,
                rawVersionLE,
                rawVersionBE,
                detectedMagic: magicResult.byteOrder === 'LE' ? rawMagicLE : rawMagicBE,
                detectedVersion: magicResult.byteOrder === 'LE' ? rawVersionLE : rawVersionBE
            });
        }
        // 4. 版本字段验证（第二重判定）
        const versionResult = this.validateVersion(rawVersionLE, rawVersionBE, magicResult.byteOrder);
        // 5. 综合判定
        const finalResult = this.combineResults(magicResult, versionResult);
        // 6. 启发式检测（第三重判定，可选）
        if (opts.enableHeuristic && finalResult.confidence < exports.CONFIDENCE_THRESHOLDS.MEDIUM) {
            const heuristicResult = this.heuristicDetection(buffer, finalResult.byteOrder);
            const combined = this.combineResults(finalResult, heuristicResult);
            if (combined.confidence >= opts.minConfidence) {
                return this.buildResult(combined, {
                    rawMagicLE,
                    rawMagicBE,
                    rawVersionLE,
                    rawVersionBE,
                    detectedMagic: combined.byteOrder === 'LE' ? rawMagicLE : rawMagicBE,
                    detectedVersion: combined.byteOrder === 'LE' ? rawVersionLE : rawVersionBE
                });
            }
        }
        // 7. 最终检查
        if (finalResult.confidence >= opts.minConfidence) {
            return this.buildResult(finalResult, {
                rawMagicLE,
                rawMagicBE,
                rawVersionLE,
                rawVersionBE,
                detectedMagic: finalResult.byteOrder === 'LE' ? rawMagicLE : rawMagicBE,
                detectedVersion: finalResult.byteOrder === 'LE' ? rawVersionLE : rawVersionBE
            });
        }
        // 8. 无法确定 - Fail-fast
        return {
            byteOrder: 'UNKNOWN',
            confidence: finalResult.confidence,
            method: 'unknown',
            error: ByteOrderErrorCode.UNKNOWN_BYTE_ORDER,
            errorMessage: `Cannot determine byte order. ` +
                `Magic LE: 0x${rawMagicLE.toString(16).toUpperCase()}, ` +
                `Magic BE: 0x${rawMagicBE.toString(16).toUpperCase()}, ` +
                `Version LE: 0x${rawVersionLE.toString(16).toUpperCase()}, ` +
                `Version BE: 0x${rawVersionBE.toString(16).toUpperCase()}`,
            details: {
                rawMagicLE,
                rawMagicBE,
                rawVersionLE,
                rawVersionBE,
                detectedMagic: 0,
                detectedVersion: 0
            }
        };
    }
    /**
     * 快速检测（仅魔数匹配，最高性能）
     *
     * @param buffer - 文件缓冲区（至少 4 字节）
     * @returns 字节序或 UNKNOWN
     */
    static detectFast(buffer) {
        if (buffer.length < 4) {
            return 'UNKNOWN';
        }
        const magicLE = buffer.readUInt32LE(0);
        const magicBE = buffer.readUInt32BE(0);
        // 直接匹配已知魔数
        if (magicLE === exports.HCTX_MAGIC_LE_V1)
            return 'LE';
        if (magicBE === exports.HCTX_MAGIC_BE_V2)
            return 'BE';
        // 交叉匹配（容错）
        if (magicBE === exports.HCTX_MAGIC_LE_V1)
            return 'LE';
        if (magicLE === exports.HCTX_MAGIC_BE_V2)
            return 'BE';
        return 'UNKNOWN';
    }
    /**
     * 魔数检测（第一重判定）
     */
    static detectByMagic(magicLE, magicBE) {
        // 直接匹配 LE 魔数
        if (magicLE === exports.HCTX_MAGIC_LE_V1) {
            return { byteOrder: 'LE', confidence: 0.95, method: 'magic' };
        }
        // 直接匹配 BE 魔数
        if (magicBE === exports.HCTX_MAGIC_BE_V2) {
            return { byteOrder: 'BE', confidence: 0.95, method: 'magic' };
        }
        // 交叉匹配：BE 读取得到 LE 魔数 → 文件是 LE 格式
        if (magicBE === exports.HCTX_MAGIC_LE_V1) {
            return { byteOrder: 'LE', confidence: 0.85, method: 'magic' };
        }
        // 交叉匹配：LE 读取得到 BE 魔数 → 文件是 BE 格式
        if (magicLE === exports.HCTX_MAGIC_BE_V2) {
            return { byteOrder: 'BE', confidence: 0.85, method: 'magic' };
        }
        // 未知魔数
        return { byteOrder: 'UNKNOWN', confidence: 0.1, method: 'unknown' };
    }
    /**
     * 版本号验证（第二重判定）
     */
    static validateVersion(versionLE, versionBE, hint) {
        const leValid = this.isVersionValid(versionLE);
        const beValid = this.isVersionValid(versionBE);
        // 只有一个有效
        if (leValid && !beValid) {
            return { byteOrder: 'LE', confidence: 0.75, method: 'version' };
        }
        if (!leValid && beValid) {
            return { byteOrder: 'BE', confidence: 0.75, method: 'version' };
        }
        // 两者都有效，参考 hint
        if (leValid && beValid) {
            if (hint === 'LE') {
                return { byteOrder: 'LE', confidence: 0.60, method: 'version' };
            }
            if (hint === 'BE') {
                return { byteOrder: 'BE', confidence: 0.60, method: 'version' };
            }
        }
        // 两者都无效
        return { byteOrder: 'UNKNOWN', confidence: 0.1, method: 'unknown' };
    }
    /**
     * 启发式检测（第三重判定）
     * 基于数据分布特征进行二次确认
     */
    static heuristicDetection(buffer, hint) {
        // 启发式 1：检查 flags 字段（offset 7）的合理性
        const flagsLE = buffer.readUInt8(6);
        const flagsBE = buffer.readUInt8(7);
        // flags 通常应该为 0 或较小值
        const flagsLeReasonable = flagsLE <= 0x0F;
        const flagsBeReasonable = flagsBE <= 0x0F;
        // 启发式 2：检查 hash_type 字段（offset 6）的合理性
        const hashTypeLE = buffer.readUInt8(6);
        const hashTypeBE = buffer.readUInt8(6);
        // 合法的 hash_type: 0x01, 0x02, 0x03, 0x04
        const validHashTypes = [0x01, 0x02, 0x03, 0x04];
        const hashTypeLeValid = validHashTypes.includes(hashTypeLE);
        const hashTypeBeValid = validHashTypes.includes(hashTypeBE);
        // 启发式 3：检查 reserved 字段（offset 28-31）是否为 0
        let reservedLeZero = false;
        let reservedBeZero = false;
        if (buffer.length >= 32) {
            reservedLeZero = buffer.readUInt32LE(28) === 0;
            reservedBeZero = buffer.readUInt32BE(28) === 0;
        }
        // 综合启发式评分
        let leScore = 0;
        let beScore = 0;
        if (flagsLeReasonable)
            leScore += 1;
        if (flagsBeReasonable)
            beScore += 1;
        if (hashTypeLeValid)
            leScore += 2;
        if (hashTypeBeValid)
            beScore += 2;
        if (reservedLeZero)
            leScore += 1;
        if (reservedBeZero)
            beScore += 1;
        const totalScore = 4; // 最大可能得分
        if (leScore > beScore && hint === 'LE') {
            return {
                byteOrder: 'LE',
                confidence: 0.50 + (leScore / totalScore) * 0.20,
                method: 'heuristic'
            };
        }
        if (beScore > leScore && hint === 'BE') {
            return {
                byteOrder: 'BE',
                confidence: 0.50 + (beScore / totalScore) * 0.20,
                method: 'heuristic'
            };
        }
        return { byteOrder: 'UNKNOWN', confidence: 0.1, method: 'unknown' };
    }
    /**
     * 验证版本号是否在有效范围内
     */
    static isVersionValid(version) {
        return version >= exports.VALID_VERSION_RANGES.min &&
            version <= exports.VALID_VERSION_RANGES.max;
    }
    /**
     * 合并检测结果
     */
    static combineResults(a, b) {
        // 如果两者结论一致，提升置信度
        if (a.byteOrder === b.byteOrder && a.byteOrder !== 'UNKNOWN') {
            return {
                byteOrder: a.byteOrder,
                confidence: Math.min(0.99, a.confidence + b.confidence * 0.2),
                method: a.method
            };
        }
        // 如果 a 置信度更高，优先使用 a
        if (a.confidence >= b.confidence) {
            return a;
        }
        // 否则使用 b
        return b;
    }
    /**
     * 构建最终检测结果
     */
    static buildResult(result, details) {
        return {
            byteOrder: result.byteOrder,
            confidence: result.confidence,
            method: result.method,
            details
        };
    }
}
exports.ByteOrderDetector = ByteOrderDetector;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 检测字节序（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @param options - 检测选项
 * @returns 检测结果
 */
function detectByteOrder(buffer, options) {
    return ByteOrderDetector.detect(buffer, options);
}
/**
 * 快速检测字节序（便捷函数）
 *
 * @param buffer - 文件缓冲区
 * @returns 字节序或 UNKNOWN
 */
function detectByteOrderFast(buffer) {
    return ByteOrderDetector.detectFast(buffer);
}
/**
 * 断言字节序可检测（Fail-fast）
 *
 * @param buffer - 文件缓冲区
 * @throws 如果无法检测字节序
 * @returns 检测结果
 */
function assertByteOrderDetectable(buffer) {
    const result = ByteOrderDetector.detect(buffer, { strict: true });
    if (result.byteOrder === 'UNKNOWN') {
        throw new Error(result.errorMessage || 'Cannot determine byte order');
    }
    return result;
}
// ============================================================================
// 导出
// ============================================================================
exports.default = {
    ByteOrderDetector,
    detectByteOrder,
    detectByteOrderFast,
    assertByteOrderDetectable,
    HCTX_MAGIC_LE_V1: exports.HCTX_MAGIC_LE_V1,
    HCTX_MAGIC_BE_V2: exports.HCTX_MAGIC_BE_V2,
    ByteOrderErrorCode,
    CONFIDENCE_THRESHOLDS: exports.CONFIDENCE_THRESHOLDS
};
//# sourceMappingURL=byte-order-detector.js.map