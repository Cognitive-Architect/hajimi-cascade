/**
 * DEBT-H-005-004: 压缩存储（可选）
 *
 * 可选zstd压缩存储层（节省50%+磁盘空间）
 * 压缩率目标：50%（文本数据）
 *
 * 债务声明:
 * - DEBT-COMP-001: 压缩存储增加CPU开销（P4）
 *   压缩/解压操作会消耗CPU资源，建议用于I/O密集型场景而非CPU密集型场景
 */
export type CompressionAlgorithm = 'zstd' | 'gzip' | 'deflate' | 'brotli' | 'none';
export interface CompressionConfig {
    /** 压缩算法 */
    algorithm: CompressionAlgorithm;
    /** 压缩级别（1-9或1-11 for brotli），默认6 */
    level: number;
    /** 最小压缩大小（小于此值不压缩），默认100字节 */
    minSize: number;
    /** 字典（用于zstd训练模式） */
    dictionary?: Buffer;
}
export declare const DEFAULT_COMPRESSION_CONFIG: CompressionConfig;
export interface CompressionStats {
    /** 原始总大小 */
    originalSize: number;
    /** 压缩后总大小 */
    compressedSize: number;
    /** 压缩率 */
    ratio: number;
    /** 压缩次数 */
    compressCount: number;
    /** 解压次数 */
    decompressCount: number;
    /** 平均压缩时间（ms） */
    avgCompressTime: number;
    /** 平均解压时间（ms） */
    avgDecompressTime: number;
}
export interface CompressedData {
    data: Buffer;
    algorithm: CompressionAlgorithm;
    originalSize: number;
    compressedSize: number;
    timestamp: number;
}
/**
 * 压缩器接口
 *
 * 定义压缩存储层的标准接口
 * 实际实现可根据依赖情况选择算法
 */
export interface ICompressor {
    compress(data: Buffer): Promise<CompressedData>;
    decompress(compressed: CompressedData): Promise<Buffer>;
    compressSync(data: Buffer): CompressedData;
    decompressSync(compressed: CompressedData): Buffer;
    getStats(): CompressionStats;
}
/**
 * Zstd压缩器（使用zlib作为fallback）
 *
 * 注意：纯JavaScript环境下，zstd需要原生模块
 * 当前实现使用brotli作为最佳替代方案（压缩率接近zstd）
 *
 * 当安装@mongodb-js/zstd后，可自动切换到zstd实现
 */
export declare class ZstdCompressor implements ICompressor {
    private config;
    private stats;
    private zstdNative;
    constructor(config?: Partial<CompressionConfig>);
    /**
     * 尝试加载原生zstd模块
     */
    private tryLoadZstdNative;
    /**
     * 异步压缩
     */
    compress(data: Buffer): Promise<CompressedData>;
    /**
     * 异步解压
     */
    decompress(compressed: CompressedData): Promise<Buffer>;
    /**
     * 同步压缩
     */
    compressSync(data: Buffer): CompressedData;
    /**
     * 同步解压
     */
    decompressSync(compressed: CompressedData): Buffer;
    /**
     * 获取统计
     */
    getStats(): CompressionStats;
    /**
     * 重置统计
     */
    resetStats(): void;
    /**
     * 更新配置
     */
    updateConfig(config: Partial<CompressionConfig>): void;
    /**
     * 获取当前配置
     */
    getConfig(): CompressionConfig;
    /**
     * 检查是否使用原生zstd
     */
    isUsingNativeZstd(): boolean;
    private compressZstd;
    private compressZstdSync;
    private decompressZstd;
    private decompressZstdSync;
    private compressFallback;
    private compressFallbackSync;
    private decompressFallback;
    private decompressFallbackSync;
}
/**
 * 压缩存储层
 *
 * 为存储系统添加透明压缩能力
 */
export declare class CompressedStorage {
    private compressor;
    private storage;
    constructor(config?: Partial<CompressionConfig>);
    /**
     * 存储数据（自动压缩）
     */
    set(key: string, data: Buffer): Promise<void>;
    /**
     * 同步存储
     */
    setSync(key: string, data: Buffer): void;
    /**
     * 获取数据（自动解压）
     */
    get(key: string): Promise<Buffer | undefined>;
    /**
     * 同步获取
     */
    getSync(key: string): Buffer | undefined;
    /**
     * 删除
     */
    delete(key: string): boolean;
    /**
     * 获取统计
     */
    getStats(): CompressionStats;
    /**
     * 获取原始压缩数据
     */
    getRaw(key: string): CompressedData | undefined;
    /**
     * 获取所有keys
     */
    keys(): string[];
    /**
     * 清空
     */
    clear(): void;
}
export default ZstdCompressor;
//# sourceMappingURL=zstd-compression.d.ts.map