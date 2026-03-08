/**
 * DEBT-H-005-003: 懒加载
 *
 * 大文件支持按需加载chunks（mmap风格）
 * 首次访问延迟：<10ms
 */
export interface LazyLoaderConfig {
    /** 块大小（字节），默认 64KB */
    chunkSize: number;
    /** 最大缓存块数，默认 100 */
    maxCachedChunks: number;
    /** 预读块数，默认 1 */
    readAhead: number;
    /** 文件偏移量，默认 0 */
    offset: number;
}
export declare const DEFAULT_LAZY_LOADER_CONFIG: LazyLoaderConfig;
export interface Chunk {
    index: number;
    data: Buffer;
    offset: number;
    size: number;
    loadedAt: number;
    accessCount: number;
}
export interface LazyLoaderStats {
    /** 总块数 */
    totalChunks: number;
    /** 已加载块数 */
    loadedChunks: number;
    /** 缓存命中次数 */
    cacheHits: number;
    /** 缓存未命中次数 */
    cacheMisses: number;
    /** 总读取字节数 */
    totalBytesRead: number;
    /** 平均加载延迟（ms） */
    avgLoadLatency: number;
    /** 文件大小 */
    fileSize: number;
}
/**
 * 懒加载器
 *
 * 实现类mmap的按需加载机制
 * 支持块缓存、预读、延迟加载
 */
export declare class LazyLoader {
    private filePath;
    private config;
    private fd;
    private fileSize;
    private chunkCache;
    private accessOrder;
    private stats;
    /**
     * 创建懒加载器
     * @param filePath 文件路径
     * @param config 配置
     */
    constructor(filePath: string, config?: Partial<LazyLoaderConfig>);
    /**
     * 初始化懒加载器（异步）
     */
    init(): Promise<void>;
    /**
     * 同步初始化（如果文件已打开）
     */
    initSync(): void;
    /**
     * 获取总块数
     */
    getTotalChunks(): number;
    /**
     * 加载指定块
     * @param chunkIndex 块索引
     * @returns Chunk对象
     */
    loadChunk(chunkIndex: number): Promise<Chunk>;
    /**
     * 同步加载块
     * @param chunkIndex 块索引
     */
    loadChunkSync(chunkIndex: number): Chunk;
    /**
     * 读取指定范围的数据
     * @param offset 起始偏移
     * @param length 长度
     */
    read(offset: number, length: number): Promise<Buffer>;
    /**
     * 获取统计信息
     */
    getStats(): LazyLoaderStats;
    /**
     * 清空缓存
     */
    clearCache(): void;
    /**
     * 关闭加载器
     */
    close(): Promise<void>;
    /**
     * 同步关闭
     */
    closeSync(): void;
    /**
     * 确保已初始化
     */
    private ensureInitialized;
    /**
     * 确保已初始化（同步）
     */
    private ensureInitializedSync;
    /**
     * 添加到缓存（带LRU淘汰）
     */
    private addToCache;
    /**
     * 更新访问顺序
     */
    private updateAccessOrder;
    /**
     * 预读块
     */
    private prefetch;
}
/**
 * 内存映射风格的文件访问
 *
 * 提供类似mmap的接口，基于LazyLoader实现
 */
export declare class MemoryMappedFile {
    private loader;
    private viewCache;
    constructor(filePath: string, config?: Partial<LazyLoaderConfig>);
    /**
     * 初始化
     */
    init(): Promise<void>;
    /**
     * 读取Uint8
     */
    readUInt8(offset: number): Promise<number>;
    /**
     * 读取Uint32（小端序）
     */
    readUInt32LE(offset: number): Promise<number>;
    /**
     * 读取Uint64（大端序，返回bigint）
     */
    readBigUInt64BE(offset: number): Promise<bigint>;
    /**
     * 读取Buffer
     */
    readBuffer(offset: number, length: number): Promise<Buffer>;
    /**
     * 获取统计
     */
    getStats(): LazyLoaderStats;
    /**
     * 关闭
     */
    close(): Promise<void>;
}
export default LazyLoader;
//# sourceMappingURL=lazy-loader.d.ts.map