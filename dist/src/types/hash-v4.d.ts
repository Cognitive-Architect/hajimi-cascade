/**
 * Hash V4 Type Definitions - CASCADE_BLAKE3
 *
 * Hash Type: 0x04 (CASCADE_BLAKE3)
 * Entry Size: 48 bytes
 *
 * Structure:
 * - simhash:  8 bytes (offset 0-7)
 * - blake3:  32 bytes (offset 8-39)
 * - length:   4 bytes (offset 40-43)
 * - seed:     4 bytes (offset 44-47)
 *
 * @module hash-v4
 * @version 1.0.0
 */
/**
 * Hash type identifier for CASCADE_BLAKE3
 */
export declare const CASCADE_BLAKE3 = 4;
/**
 * Entry size in bytes for CASCADE_BLAKE3 format
 * Total: 8 (simhash) + 32 (blake3) + 4 (length) + 4 (seed) = 48 bytes
 */
export declare const BLAKE3_ENTRY_SIZE = 48;
/**
 * BLAKE3 output length in bytes (256 bits)
 */
export declare const BLAKE3_HASH_SIZE = 32;
/**
 * SimHash output length in bytes (64 bits)
 */
export declare const SIMHASH_SIZE = 8;
/**
 * ChunkHashV4 - CASCADE_BLAKE3 entry structure
 *
 * Total size: 48 bytes
 */
export interface ChunkHashV4 {
    /** SimHash-64 similarity hash (8 bytes) */
    simhash: bigint;
    /** BLAKE3-256 cryptographic hash (32 bytes) */
    blake3: Buffer;
    /** Original chunk length in bytes (4 bytes) */
    length: number;
    /** Hash seed used for SimHash (4 bytes) */
    seed: number;
}
/**
 * BLAKE3 Hasher Interface
 *
 * Abstract interface for both native and WASM implementations
 */
export interface Blake3Hasher {
    /** Initialize/reset the hash context */
    init(): void;
    /** Update hash with data chunk */
    update(data: Buffer): void;
    /** Finalize and return 32-byte digest */
    digest(): Buffer;
}
/**
 * BLAKE3 Provider Interface
 *
 * Factory for creating hasher instances with implementation detection
 */
export interface Blake3Provider {
    /** Get the current implementation type */
    getImplementationType(): ImplementationType;
    /** Create a new hasher instance */
    createHasher(): Blake3Hasher;
    /** Get current performance level estimate */
    getPerformanceLevel(): PerformanceLevel;
    /** Check if the provider is ready */
    isReady(): boolean;
}
/**
 * Implementation type enumeration
 */
export type ImplementationType = 'native-avx512' | 'native-avx2' | 'native-sse41' | 'native-generic' | 'wasm-simd' | 'wasm-threads' | 'wasm-base' | 'unknown';
/**
 * Performance level enumeration
 */
export type PerformanceLevel = 'high' | 'medium' | 'low' | 'unsupported';
/**
 * WASM feature detection result
 */
export interface WasmFeatures {
    /** SIMD128 support (required for good performance) */
    simd: boolean;
    /** Bulk memory operations */
    bulkMemory: boolean;
    /** Threading support (SharedArrayBuffer) */
    threads: boolean;
    /** Mutable globals */
    mutableGlobals: boolean;
}
/**
 * BLAKE3 specific error codes
 */
export declare enum Blake3ErrorCode {
    /** Native module failed to load */
    NATIVE_LOAD_FAILED = "NATIVE_LOAD_FAILED",
    /** WASM module failed to load */
    WASM_LOAD_FAILED = "WASM_LOAD_FAILED",
    /** SIMD not available but required */
    SIMD_REQUIRED = "SIMD_REQUIRED",
    /** Invalid hash size */
    INVALID_HASH_SIZE = "INVALID_HASH_SIZE",
    /** Hash context not initialized */
    NOT_INITIALIZED = "NOT_INITIALIZED",
    /** Platform not supported */
    UNSUPPORTED_PLATFORM = "UNSUPPORTED_PLATFORM"
}
/**
 * BLAKE3 error structure
 */
export interface Blake3Error {
    code: Blake3ErrorCode;
    message: string;
    cause?: Error;
}
/**
 * Create an empty ChunkHashV4 with zeroed fields
 */
export declare function createEmptyChunkHashV4(): ChunkHashV4;
/**
 * Serialize ChunkHashV4 to 48-byte Buffer
 *
 * Layout (大端序 - RISK-H-007):
 * - offset 0-7: simhash (uint64 BE)
 * - offset 8-39: blake3 (32 bytes)
 * - offset 40-43: length (uint32 BE)
 * - offset 44-47: seed (uint32 BE)
 */
export declare function serializeChunkHashV4(chunk: ChunkHashV4): Buffer;
/**
 * Deserialize 48-byte Buffer to ChunkHashV4
 */
export declare function deserializeChunkHashV4(buf: Buffer): ChunkHashV4;
/**
 * Validate ChunkHashV4 structure
 */
export declare function validateChunkHashV4(chunk: ChunkHashV4): boolean;
/**
 * Detect WASM features in current environment
 */
export declare function detectWasmFeatures(): WasmFeatures;
/**
 * Get recommended implementation based on environment
 */
export declare function getRecommendedImplementation(): ImplementationType;
declare const _default: {
    CASCADE_BLAKE3: number;
    BLAKE3_ENTRY_SIZE: number;
    BLAKE3_HASH_SIZE: number;
    SIMHASH_SIZE: number;
    createEmptyChunkHashV4: typeof createEmptyChunkHashV4;
    serializeChunkHashV4: typeof serializeChunkHashV4;
    deserializeChunkHashV4: typeof deserializeChunkHashV4;
    validateChunkHashV4: typeof validateChunkHashV4;
    detectWasmFeatures: typeof detectWasmFeatures;
    getRecommendedImplementation: typeof getRecommendedImplementation;
};
export default _default;
//# sourceMappingURL=hash-v4.d.ts.map