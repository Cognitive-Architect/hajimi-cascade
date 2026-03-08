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
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { CompressionOptions, CompressionResult } from './zstd-compression';
export interface ParallelOptions extends CompressionOptions {
    workerCount?: number;
    taskTimeout?: number;
    enableFallback?: boolean;
}
export interface Task {
    id: number;
    action: 'compress' | 'decompress';
    data: Buffer;
    resolve: (result: Buffer) => void;
    reject: (error: Error) => void;
    startTime: number;
}
export interface WorkerState {
    worker: Worker;
    busy: boolean;
    taskId: number | null;
    errors: number;
    lastUsed: number;
}
/**
 * Parallel Compression with Worker Pool
 *
 * Architecture:
 * - Worker Pool: 4 workers (configurable)
 * - Task Queue: FIFO queue for pending tasks
 * - Error Handler: Isolates worker failures
 * - Fallback: Automatic fallback to single-thread
 */
export declare class CompressionParallel extends EventEmitter {
    private options;
    private workers;
    private taskQueue;
    private activeTasks;
    private taskIdCounter;
    private singleThreadCompressor;
    private workersEnabled;
    private terminated;
    private workerPath;
    onProgress?: (current: number, total: number) => void;
    constructor(options?: ParallelOptions);
    /**
     * Initialize worker pool
     */
    private initializeWorkers;
    /**
     * Create a single worker
     */
    private createWorker;
    /**
     * Handle worker message
     */
    private handleWorkerMessage;
    /**
     * Handle worker error (error isolation)
     */
    private handleWorkerError;
    /**
     * Handle worker exit
     */
    private handleWorkerExit;
    /**
     * Replace a faulty worker
     */
    private replaceWorker;
    /**
     * Find task by ID (from active tasks)
     */
    private findTaskById;
    /**
     * Process task queue
     */
    private processQueue;
    /**
     * Update progress
     */
    private updateProgress;
    /**
     * Add task to queue
     */
    private addTask;
    /**
     * Parallel compression (main API)
     */
    compressParallel(data: Buffer): Promise<Buffer>;
    /**
     * Parallel decompression
     */
    decompressParallel(data: Buffer): Promise<Buffer>;
    /**
     * Combine compressed chunks with metadata
     * Format: [chunkCount:4][size1:4][data1...][size2:4][data2...]
     */
    private combineChunks;
    /**
     * Split combined chunks
     */
    private splitCombinedChunks;
    /**
     * Synchronous compression (fallback)
     */
    compressSync(data: Buffer): Buffer;
    /**
     * Universal compress with automatic fallback
     */
    compress(data: Buffer): Promise<CompressionResult>;
    /**
     * Universal decompress with automatic fallback
     */
    decompress(data: Buffer): Promise<CompressionResult>;
    /**
     * Disable workers (for testing fallback)
     */
    disableWorkers(): void;
    /**
     * Enable workers
     */
    enableWorkers(): void;
    /**
     * Simulate worker crash (for testing error isolation)
     */
    simulateWorkerCrash(): Promise<void>;
    /**
     * Get pool statistics
     */
    getStats(): {
        workerCount: number;
        busyWorkers: number;
        queueLength: number;
        workersEnabled: boolean;
    };
    /**
     * Terminate all workers
     */
    terminate(): void;
}
export declare const compressionParallel: CompressionParallel;
export default CompressionParallel;
//# sourceMappingURL=compression-parallel.d.ts.map