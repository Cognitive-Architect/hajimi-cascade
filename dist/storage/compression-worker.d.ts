/**
 * Compression Worker Thread
 *
 * Worker thread implementation for parallel compression/decompression.
 * Handles chunk-level compression tasks independently.
 *
 * @module compression-worker
 * @author Hajimi Team
 */
export interface WorkerTask {
    id: number;
    action: 'compress' | 'decompress';
    data: Buffer;
    level?: number;
}
export interface WorkerResult {
    id: number;
    success: boolean;
    data?: Buffer;
    error?: string;
    duration: number;
}
//# sourceMappingURL=compression-worker.d.ts.map