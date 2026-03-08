/**
 * Storage模块统一导出
 *
 * DEBT-H-005: 内存优化债务清偿
 */
export { LRUCache, CompactStorageWithLRU, type LRUCacheStats, type LRUCacheEntry } from './lru-cache.js';
export { ConfigurableBufferPool, BufferPoolManager, DEFAULT_BUFFER_POOL_CONFIG, type BufferPoolConfig, type BufferPoolStats, type PooledBuffer } from './buffer-pool-config.js';
export { LazyLoader, MemoryMappedFile, DEFAULT_LAZY_LOADER_CONFIG, type LazyLoaderConfig, type LazyLoaderStats, type Chunk } from './lazy-loader.js';
export { ZstdCompressor, CompressedStorage, DEFAULT_COMPRESSION_CONFIG, type CompressionConfig, type CompressionStats, type CompressedData, type CompressionAlgorithm, type ICompressor } from './zstd-compression.js';
//# sourceMappingURL=index.d.ts.map