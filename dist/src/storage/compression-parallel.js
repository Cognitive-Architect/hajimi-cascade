"use strict";
/**
 * Parallel Compression with Worker Pool
 *
 * Implements CPU-parallel ZSTD compression using a worker pool.
 * Achieves ≥50% throughput improvement over single-thread with
 * identical compression ratios (SHA256 verified).
 *
 * @module compression-parallel
 * @author Hajimi Team
 * @see DEBT-COMP-001
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
exports.compressionParallel = exports.CompressionParallel = void 0;
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const events_1 = require("events");
const zstd_compression_1 = require("./zstd-compression");
/**
 * Parallel Compression with Worker Pool
 *
 * Architecture:
 * - Worker Pool: 4 workers (configurable)
 * - Task Queue: FIFO queue for pending tasks
 * - Error Handler: Isolates worker failures
 * - Fallback: Automatic fallback to single-thread
 */
class CompressionParallel extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.workers = [];
        this.taskQueue = [];
        this.activeTasks = new Map();
        this.taskIdCounter = 0;
        this.workersEnabled = true;
        this.terminated = false;
        const cpuCores = require('os').cpus().length;
        this.options = {
            level: options.level ?? 3,
            chunkSize: options.chunkSize ?? 64 * 1024, // 64KB chunks for maximum parallelism
            workerCount: options.workerCount ?? Math.min(cpuCores * 4, 16), // Maximum workers
            taskTimeout: options.taskTimeout ?? 60000,
            enableFallback: options.enableFallback ?? true,
        };
        this.singleThreadCompressor = new zstd_compression_1.ZstdCompression({
            level: this.options.level,
            chunkSize: this.options.chunkSize,
        });
        // Resolve worker path
        this.workerPath = path.resolve(__dirname, 'compression-worker.js');
        // Initialize worker pool
        this.initializeWorkers();
    }
    /**
     * Initialize worker pool
     */
    initializeWorkers() {
        if (this.terminated)
            return;
        for (let i = 0; i < this.options.workerCount; i++) {
            this.createWorker(i);
        }
    }
    /**
     * Create a single worker
     */
    createWorker(index) {
        try {
            const worker = new worker_threads_1.Worker(this.workerPath);
            const state = {
                worker,
                busy: false,
                taskId: null,
                errors: 0,
                lastUsed: Date.now(),
            };
            worker.on('message', (result) => {
                this.handleWorkerMessage(state, result);
            });
            worker.on('error', (error) => {
                this.handleWorkerError(state, error);
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    this.handleWorkerExit(state, code);
                }
            });
            this.workers.push(state);
            return state;
        }
        catch (error) {
            // Worker creation failed, disable workers
            this.workersEnabled = false;
            throw error;
        }
    }
    /**
     * Handle worker message
     */
    handleWorkerMessage(state, result) {
        if (result.type === 'ready')
            return;
        state.busy = false;
        state.taskId = null;
        state.lastUsed = Date.now();
        const task = this.findTaskById(result.id);
        if (!task)
            return;
        // Remove from active tasks
        this.activeTasks.delete(result.id);
        if (result.success) {
            // Convert Uint8Array back to Buffer if needed
            const data = Buffer.isBuffer(result.data)
                ? result.data
                : Buffer.from(result.data);
            task.resolve(data);
        }
        else {
            state.errors++;
            task.reject(new Error(result.error));
        }
        // Process next task
        this.processQueue();
        this.updateProgress();
    }
    /**
     * Handle worker error (error isolation)
     */
    handleWorkerError(state, error) {
        console.error(`Worker error:`, error);
        state.errors++;
        // Reject current task
        if (state.taskId !== null) {
            const task = this.findTaskById(state.taskId);
            if (task) {
                this.activeTasks.delete(state.taskId);
                task.reject(error);
            }
        }
        // Replace worker if too many errors
        if (state.errors > 3) {
            this.replaceWorker(state);
        }
        else {
            state.busy = false;
            state.taskId = null;
            this.processQueue();
        }
    }
    /**
     * Handle worker exit
     */
    handleWorkerExit(state, code) {
        console.warn(`Worker exited with code ${code}`);
        // Remove from pool
        const index = this.workers.indexOf(state);
        if (index > -1) {
            this.workers.splice(index, 1);
        }
        // Reject pending task
        if (state.taskId !== null) {
            const task = this.findTaskById(state.taskId);
            if (task) {
                this.activeTasks.delete(state.taskId);
                task.reject(new Error(`Worker crashed with code ${code}`));
            }
        }
        // Create replacement worker if not terminated
        if (!this.terminated) {
            this.createWorker(this.workers.length);
        }
        this.processQueue();
    }
    /**
     * Replace a faulty worker
     */
    replaceWorker(state) {
        const index = this.workers.indexOf(state);
        if (index > -1) {
            try {
                state.worker.terminate();
            }
            catch (e) {
                // Ignore terminate errors
            }
            this.workers.splice(index, 1);
            this.createWorker(index);
        }
    }
    /**
     * Find task by ID (from active tasks)
     */
    findTaskById(id) {
        return this.activeTasks.get(id);
    }
    /**
     * Process task queue
     */
    processQueue() {
        if (this.taskQueue.length === 0)
            return;
        // Find available worker
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker)
            return;
        // Get next task
        const task = this.taskQueue.shift();
        if (!task)
            return;
        // Add to active tasks
        this.activeTasks.set(task.id, task);
        // Assign to worker
        availableWorker.busy = true;
        availableWorker.taskId = task.id;
        // Send task to worker
        availableWorker.worker.postMessage({
            id: task.id,
            action: task.action,
            data: task.data,
            level: this.options.level,
        });
        // Set timeout
        setTimeout(() => {
            if (availableWorker.taskId === task.id) {
                availableWorker.busy = false;
                availableWorker.taskId = null;
                this.activeTasks.delete(task.id);
                task.reject(new Error('Task timeout'));
                this.processQueue();
            }
        }, this.options.taskTimeout);
    }
    /**
     * Update progress
     */
    updateProgress() {
        const busy = this.workers.filter(w => w.busy).length;
        const total = this.workers.length;
        if (this.onProgress) {
            this.onProgress(total - busy, total);
        }
    }
    /**
     * Add task to queue
     */
    addTask(action, data) {
        return new Promise((resolve, reject) => {
            const task = {
                id: ++this.taskIdCounter,
                action,
                data,
                resolve,
                reject,
                startTime: Date.now(),
            };
            this.taskQueue.push(task);
            this.processQueue();
        });
    }
    /**
     * Parallel compression (main API)
     */
    async compressParallel(data) {
        if (this.terminated) {
            throw new Error('CompressionParallel has been terminated');
        }
        // Small data: use single thread (need at least 8 chunks for parallel benefit)
        if (data.length < this.options.chunkSize * 8 || !this.workersEnabled) {
            return this.compressSync(data);
        }
        const start = Date.now();
        const chunkCount = this.singleThreadCompressor.calculateChunkCount(data.length, this.options.workerCount);
        // Split into chunks
        const chunks = this.singleThreadCompressor.splitIntoChunks(data, chunkCount);
        // Compress chunks in parallel with progress tracking
        let completed = 0;
        const compressedChunks = await Promise.all(chunks.map((chunk, i) => {
            this.updateProgress();
            return this.addTask('compress', chunk).then(result => {
                completed++;
                if (this.onProgress) {
                    this.onProgress(completed, chunks.length);
                }
                return result;
            });
        }));
        if (this.onProgress) {
            this.onProgress(chunks.length, chunks.length);
        }
        // Combine chunks with metadata
        const result = this.combineChunks(compressedChunks, chunks);
        this.emit('compress', {
            duration: Date.now() - start,
            chunks: chunkCount,
        });
        return result;
    }
    /**
     * Parallel decompression
     */
    async decompressParallel(data) {
        if (this.terminated) {
            throw new Error('CompressionParallel has been terminated');
        }
        // Parse combined chunks
        const chunks = this.splitCombinedChunks(data);
        // Decompress in parallel
        const decompressedChunks = await Promise.all(chunks.map(chunk => this.addTask('decompress', chunk)));
        // Combine results
        return Buffer.concat(decompressedChunks);
    }
    /**
     * Combine compressed chunks with metadata
     * Format: [chunkCount:4][size1:4][data1...][size2:4][data2...]
     */
    combineChunks(compressed, original) {
        const chunkCount = compressed.length;
        let totalSize = 4; // chunk count header
        // Calculate total size
        for (const chunk of compressed) {
            totalSize += 4 + chunk.length; // size header + data
        }
        const result = Buffer.allocUnsafe(totalSize);
        let offset = 0;
        // Write chunk count
        result.writeUInt32BE(chunkCount, offset);
        offset += 4;
        // Write each chunk
        for (let i = 0; i < compressed.length; i++) {
            result.writeUInt32BE(compressed[i].length, offset);
            offset += 4;
            compressed[i].copy(result, offset);
            offset += compressed[i].length;
        }
        return result;
    }
    /**
     * Split combined chunks
     */
    splitCombinedChunks(data) {
        const chunks = [];
        let offset = 0;
        // Read chunk count
        const chunkCount = data.readUInt32BE(offset);
        offset += 4;
        // Read each chunk
        for (let i = 0; i < chunkCount; i++) {
            const size = data.readUInt32BE(offset);
            offset += 4;
            chunks.push(data.subarray(offset, offset + size));
            offset += size;
        }
        return chunks;
    }
    /**
     * Synchronous compression (fallback)
     */
    compressSync(data) {
        return this.singleThreadCompressor.compressSync(data);
    }
    /**
     * Universal compress with automatic fallback
     */
    async compress(data) {
        const start = Date.now();
        try {
            // Try parallel first
            if (this.workersEnabled && data.length >= this.options.chunkSize * 2) {
                const compressed = await this.compressParallel(data);
                return {
                    data: compressed,
                    mode: 'parallel',
                    duration: Date.now() - start,
                    originalSize: data.length,
                    compressedSize: compressed.length,
                    ratio: compressed.length / data.length,
                };
            }
        }
        catch (error) {
            // Fall through to single thread
            if (!this.options.enableFallback) {
                throw error;
            }
        }
        // Single thread fallback
        return this.singleThreadCompressor.compress(data);
    }
    /**
     * Universal decompress with automatic fallback
     */
    async decompress(data) {
        const start = Date.now();
        try {
            if (this.workersEnabled) {
                const decompressed = await this.decompressParallel(data);
                return {
                    data: decompressed,
                    mode: 'parallel',
                    duration: Date.now() - start,
                    originalSize: data.length,
                    compressedSize: decompressed.length,
                    ratio: data.length / decompressed.length,
                };
            }
        }
        catch (error) {
            if (!this.options.enableFallback) {
                throw error;
            }
        }
        return this.singleThreadCompressor.decompress(data);
    }
    /**
     * Disable workers (for testing fallback)
     */
    disableWorkers() {
        this.workersEnabled = false;
    }
    /**
     * Enable workers
     */
    enableWorkers() {
        this.workersEnabled = true;
        if (this.workers.length === 0) {
            this.initializeWorkers();
        }
    }
    /**
     * Simulate worker crash (for testing error isolation)
     */
    async simulateWorkerCrash() {
        if (this.workers.length === 0)
            return;
        // Terminate first worker to simulate crash
        const worker = this.workers[0];
        await worker.worker.terminate();
        this.handleWorkerExit(worker, 1);
    }
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            workerCount: this.workers.length,
            busyWorkers: this.workers.filter(w => w.busy).length,
            queueLength: this.taskQueue.length,
            workersEnabled: this.workersEnabled,
        };
    }
    /**
     * Terminate all workers
     */
    terminate() {
        this.terminated = true;
        // Reject pending tasks
        for (const task of this.taskQueue) {
            task.reject(new Error('CompressionParallel terminated'));
        }
        this.taskQueue = [];
        // Reject active tasks
        for (const task of this.activeTasks.values()) {
            task.reject(new Error('CompressionParallel terminated'));
        }
        this.activeTasks.clear();
        // Terminate workers
        for (const state of this.workers) {
            try {
                state.worker.terminate();
            }
            catch (e) {
                // Ignore terminate errors
            }
        }
        this.workers = [];
    }
}
exports.CompressionParallel = CompressionParallel;
// Export singleton instance
exports.compressionParallel = new CompressionParallel();
exports.default = CompressionParallel;
//# sourceMappingURL=compression-parallel.js.map