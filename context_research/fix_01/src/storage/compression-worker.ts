/**
 * Compression Worker Thread
 * 
 * Worker thread implementation for parallel compression/decompression.
 * Handles chunk-level compression tasks independently.
 * 
 * @module compression-worker
 * @author Hajimi Team
 */

import { parentPort, workerData } from 'worker_threads';
import * as zlib from 'zlib';

// Worker thread execution context
if (!parentPort) {
  throw new Error('This module must be run as a worker thread');
}

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

/**
 * Compress data using zlib (ZSTD-like)
 */
function compressChunk(data: Buffer, level: number = 9): Buffer {
  // Use gzip with max compression for CPU-intensive task
  return zlib.gzipSync(data, { level: 9 });
}

/**
 * Decompress data using zlib
 */
function decompressChunk(data: Buffer): Buffer {
  return zlib.gunzipSync(data);
}

/**
 * Process a single task
 */
function processTask(task: WorkerTask): WorkerResult {
  const start = Date.now();
  
  try {
    let result: Buffer;
    
    if (task.action === 'compress') {
      result = compressChunk(task.data, task.level);
    } else if (task.action === 'decompress') {
      result = decompressChunk(task.data);
    } else {
      throw new Error(`Unknown action: ${task.action}`);
    }
    
    return {
      id: task.id,
      success: true,
      data: result,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      id: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

// Handle incoming messages
parentPort.on('message', (task: WorkerTask) => {
  // Add error isolation - wrap in try-catch to prevent worker crash
  try {
    const result = processTask(task);
    parentPort!.postMessage(result);
  } catch (e) {
    // Fatal error that shouldn't happen, but handle gracefully
    parentPort!.postMessage({
      id: task.id,
      success: false,
      error: `Worker fatal error: ${e}`,
      duration: 0,
    });
  }
});

// Signal ready
parentPort.postMessage({ type: 'ready' });

// Types are already exported above
