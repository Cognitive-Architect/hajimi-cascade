"use strict";
/**
 * Parallel Compression Package
 *
 * Exports all compression modules for DEBT-COMP-001
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.ZstdCompression = exports.CompressionParallel = void 0;
var compression_parallel_1 = require("./storage/compression-parallel");
Object.defineProperty(exports, "CompressionParallel", { enumerable: true, get: function () { return compression_parallel_1.CompressionParallel; } });
var zstd_compression_1 = require("./storage/zstd-compression");
Object.defineProperty(exports, "ZstdCompression", { enumerable: true, get: function () { return zstd_compression_1.ZstdCompression; } });
// Default export
var compression_parallel_2 = require("./storage/compression-parallel");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return compression_parallel_2.CompressionParallel; } });
//# sourceMappingURL=index.js.map