"use strict";
/**
 * Compression Worker Thread
 *
 * Worker thread implementation for parallel compression/decompression.
 * Handles chunk-level compression tasks independently.
 *
 * @module compression-worker
 * @author Hajimi Team
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const zlib = __importStar(require("zlib"));
// Worker thread execution context
if (!worker_threads_1.parentPort) {
    throw new Error('This module must be run as a worker thread');
}
/**
 * Compress data using zlib (ZSTD-like)
 */
function compressChunk(data, level = 9) {
    // Use gzip with max compression for CPU-intensive task
    return zlib.gzipSync(data, { level: 9 });
}
/**
 * Decompress data using zlib
 */
function decompressChunk(data) {
    return zlib.gunzipSync(data);
}
/**
 * Process a single task
 */
function processTask(task) {
    const start = Date.now();
    try {
        let result;
        if (task.action === 'compress') {
            result = compressChunk(task.data, task.level);
        }
        else if (task.action === 'decompress') {
            result = decompressChunk(task.data);
        }
        else {
            throw new Error(`Unknown action: ${task.action}`);
        }
        return {
            id: task.id,
            success: true,
            data: result,
            duration: Date.now() - start,
        };
    }
    catch (error) {
        return {
            id: task.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - start,
        };
    }
}
// Handle incoming messages
worker_threads_1.parentPort.on('message', (task) => {
    // Add error isolation - wrap in try-catch to prevent worker crash
    try {
        const result = processTask(task);
        worker_threads_1.parentPort.postMessage(result);
    }
    catch (e) {
        // Fatal error that shouldn't happen, but handle gracefully
        worker_threads_1.parentPort.postMessage({
            id: task.id,
            success: false,
            error: `Worker fatal error: ${e}`,
            duration: 0,
        });
    }
});
// Signal ready
worker_threads_1.parentPort.postMessage({ type: 'ready' });
// Types are already exported above
//# sourceMappingURL=compression-worker.js.map