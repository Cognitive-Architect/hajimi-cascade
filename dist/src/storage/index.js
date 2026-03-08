"use strict";
/**
 * Storage模块统一导出
 *
 * DEBT-H-005: 内存优化债务清偿
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COMPRESSION_CONFIG = exports.CompressedStorage = exports.ZstdCompressor = exports.DEFAULT_LAZY_LOADER_CONFIG = exports.MemoryMappedFile = exports.LazyLoader = exports.DEFAULT_BUFFER_POOL_CONFIG = exports.BufferPoolManager = exports.ConfigurableBufferPool = exports.CompactStorageWithLRU = exports.LRUCache = void 0;
// LRU缓存
var lru_cache_js_1 = require("./lru-cache.js");
Object.defineProperty(exports, "LRUCache", { enumerable: true, get: function () { return lru_cache_js_1.LRUCache; } });
Object.defineProperty(exports, "CompactStorageWithLRU", { enumerable: true, get: function () { return lru_cache_js_1.CompactStorageWithLRU; } });
// BufferPool配置
var buffer_pool_config_js_1 = require("./buffer-pool-config.js");
Object.defineProperty(exports, "ConfigurableBufferPool", { enumerable: true, get: function () { return buffer_pool_config_js_1.ConfigurableBufferPool; } });
Object.defineProperty(exports, "BufferPoolManager", { enumerable: true, get: function () { return buffer_pool_config_js_1.BufferPoolManager; } });
Object.defineProperty(exports, "DEFAULT_BUFFER_POOL_CONFIG", { enumerable: true, get: function () { return buffer_pool_config_js_1.DEFAULT_BUFFER_POOL_CONFIG; } });
// 懒加载
var lazy_loader_js_1 = require("./lazy-loader.js");
Object.defineProperty(exports, "LazyLoader", { enumerable: true, get: function () { return lazy_loader_js_1.LazyLoader; } });
Object.defineProperty(exports, "MemoryMappedFile", { enumerable: true, get: function () { return lazy_loader_js_1.MemoryMappedFile; } });
Object.defineProperty(exports, "DEFAULT_LAZY_LOADER_CONFIG", { enumerable: true, get: function () { return lazy_loader_js_1.DEFAULT_LAZY_LOADER_CONFIG; } });
// 压缩存储
var zstd_compression_js_1 = require("./zstd-compression.js");
Object.defineProperty(exports, "ZstdCompressor", { enumerable: true, get: function () { return zstd_compression_js_1.ZstdCompressor; } });
Object.defineProperty(exports, "CompressedStorage", { enumerable: true, get: function () { return zstd_compression_js_1.CompressedStorage; } });
Object.defineProperty(exports, "DEFAULT_COMPRESSION_CONFIG", { enumerable: true, get: function () { return zstd_compression_js_1.DEFAULT_COMPRESSION_CONFIG; } });
//# sourceMappingURL=index.js.map