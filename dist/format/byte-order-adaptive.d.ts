/**
 * BYTE-001: 字节序自适应读取层
 *
 * ROI 1150%：150行代码支持跨平台数据交换
 *
 * @module byte-order-adaptive
 * Wave 4: BYTE-001 字节序自适应地狱
 */
export type ByteOrder = 'LE' | 'BE' | 'UNKNOWN';
export interface ReadResult<T> {
    value: T;
    byteOrder: ByteOrder;
    swapped: boolean;
}
/** 字节序检测器：BOM/魔数/启发式 */
export declare class ByteOrderDetector {
    detectByBOM(buffer: Buffer): ByteOrder;
    detectByMagic(buffer: Buffer): ByteOrder;
    detect(buffer: Buffer): ByteOrder;
}
/** 自适应读取器 */
export declare class AdaptiveReader {
    private detector;
    private localOrder;
    constructor();
    private detectLocalOrder;
    readUInt16(buffer: Buffer, offset?: number): ReadResult<number>;
    readUInt32(buffer: Buffer, offset?: number): ReadResult<number>;
    readBigUInt64(buffer: Buffer, offset?: number): ReadResult<bigint>;
    getLocalOrder(): ByteOrder;
}
/** 数据交换器 */
export declare class DataSwapper {
    static swapBuffer(buffer: Buffer, wordSize?: 2 | 4 | 8): void;
    static createSwapped(buffer: Buffer, wordSize?: 2 | 4 | 8): Buffer;
}
declare const _default: {
    ByteOrderDetector: typeof ByteOrderDetector;
    AdaptiveReader: typeof AdaptiveReader;
    DataSwapper: typeof DataSwapper;
};
export default _default;
//# sourceMappingURL=byte-order-adaptive.d.ts.map