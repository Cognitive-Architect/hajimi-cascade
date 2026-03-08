"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blake3ErrorCode = exports.SIMHASH_SIZE = exports.BLAKE3_HASH_SIZE = exports.BLAKE3_ENTRY_SIZE = exports.CASCADE_BLAKE3 = void 0;
exports.createEmptyChunkHashV4 = createEmptyChunkHashV4;
exports.serializeChunkHashV4 = serializeChunkHashV4;
exports.deserializeChunkHashV4 = deserializeChunkHashV4;
exports.validateChunkHashV4 = validateChunkHashV4;
exports.detectWasmFeatures = detectWasmFeatures;
exports.getRecommendedImplementation = getRecommendedImplementation;
// ============================================================================
// Constants
// ============================================================================
/**
 * Hash type identifier for CASCADE_BLAKE3
 */
exports.CASCADE_BLAKE3 = 0x04;
/**
 * Entry size in bytes for CASCADE_BLAKE3 format
 * Total: 8 (simhash) + 32 (blake3) + 4 (length) + 4 (seed) = 48 bytes
 */
exports.BLAKE3_ENTRY_SIZE = 48;
/**
 * BLAKE3 output length in bytes (256 bits)
 */
exports.BLAKE3_HASH_SIZE = 32;
/**
 * SimHash output length in bytes (64 bits)
 */
exports.SIMHASH_SIZE = 8;
// ============================================================================
// Error Types
// ============================================================================
/**
 * BLAKE3 specific error codes
 */
var Blake3ErrorCode;
(function (Blake3ErrorCode) {
    /** Native module failed to load */
    Blake3ErrorCode["NATIVE_LOAD_FAILED"] = "NATIVE_LOAD_FAILED";
    /** WASM module failed to load */
    Blake3ErrorCode["WASM_LOAD_FAILED"] = "WASM_LOAD_FAILED";
    /** SIMD not available but required */
    Blake3ErrorCode["SIMD_REQUIRED"] = "SIMD_REQUIRED";
    /** Invalid hash size */
    Blake3ErrorCode["INVALID_HASH_SIZE"] = "INVALID_HASH_SIZE";
    /** Hash context not initialized */
    Blake3ErrorCode["NOT_INITIALIZED"] = "NOT_INITIALIZED";
    /** Platform not supported */
    Blake3ErrorCode["UNSUPPORTED_PLATFORM"] = "UNSUPPORTED_PLATFORM";
})(Blake3ErrorCode || (exports.Blake3ErrorCode = Blake3ErrorCode = {}));
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Create an empty ChunkHashV4 with zeroed fields
 */
function createEmptyChunkHashV4() {
    return {
        simhash: 0n,
        blake3: Buffer.alloc(exports.BLAKE3_HASH_SIZE),
        length: 0,
        seed: 0
    };
}
/**
 * Serialize ChunkHashV4 to 48-byte Buffer
 *
 * Layout (大端序 - RISK-H-007):
 * - offset 0-7: simhash (uint64 BE)
 * - offset 8-39: blake3 (32 bytes)
 * - offset 40-43: length (uint32 BE)
 * - offset 44-47: seed (uint32 BE)
 */
function serializeChunkHashV4(chunk) {
    const buf = Buffer.alloc(exports.BLAKE3_ENTRY_SIZE);
    // Write simhash (offset 0-7) - RISK-H-007: 大端序
    buf.writeBigUInt64BE(chunk.simhash & 0xffffffffffffffffn, 0);
    // Write blake3 hash (offset 8-39)
    if (chunk.blake3.length !== exports.BLAKE3_HASH_SIZE) {
        throw new Error(`Invalid blake3 hash size: ${chunk.blake3.length}, expected ${exports.BLAKE3_HASH_SIZE}`);
    }
    buf.set(chunk.blake3, 8);
    // Write length (offset 40-43) - RISK-H-007: 大端序
    buf.writeUInt32BE(chunk.length, 40);
    // Write seed (offset 44-47) - RISK-H-007: 大端序
    buf.writeUInt32BE(chunk.seed, 44);
    return buf;
}
/**
 * Deserialize 48-byte Buffer to ChunkHashV4
 */
function deserializeChunkHashV4(buf) {
    if (buf.length < exports.BLAKE3_ENTRY_SIZE) {
        throw new Error(`Buffer too small: ${buf.length} bytes, expected ${exports.BLAKE3_ENTRY_SIZE}`);
    }
    return {
        simhash: buf.readBigUInt64BE(0), // RISK-H-007: 大端序
        blake3: buf.subarray(8, 40),
        length: buf.readUInt32BE(40), // RISK-H-007: 大端序
        seed: buf.readUInt32BE(44) // RISK-H-007: 大端序
    };
}
/**
 * Validate ChunkHashV4 structure
 */
function validateChunkHashV4(chunk) {
    return (typeof chunk.simhash === 'bigint' &&
        Buffer.isBuffer(chunk.blake3) &&
        chunk.blake3.length === exports.BLAKE3_HASH_SIZE &&
        typeof chunk.length === 'number' &&
        chunk.length >= 0 &&
        typeof chunk.seed === 'number' &&
        chunk.seed >= 0);
}
/**
 * Detect WASM features in current environment
 */
function detectWasmFeatures() {
    const features = {
        simd: false,
        bulkMemory: false,
        threads: false,
        mutableGlobals: false
    };
    // Browser environment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalWindow = (typeof globalThis !== 'undefined') ? globalThis : undefined;
    if (globalWindow && typeof globalWindow.WebAssembly !== 'undefined') {
        // Check SIMD128 using WebAssembly.validate
        try {
            // SIMD128 probe module (i32x4.splat)
            const simdTest = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                0x01, 0x05, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02,
                0x01, 0x00, 0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41,
                0x00, 0xfd, 0x0f, 0x1a, 0x0b
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isValid = globalWindow.WebAssembly.validate?.(simdTest);
            features.simd = isValid === true;
        }
        catch {
            features.simd = false;
        }
        // Check threads (SharedArrayBuffer)
        try {
            if (typeof SharedArrayBuffer !== 'undefined') {
                features.threads = true;
            }
        }
        catch {
            features.threads = false;
        }
        // Bulk memory and mutable globals are widely supported
        features.bulkMemory = true;
        features.mutableGlobals = true;
    }
    // Node.js environment - assume native implementation available
    if (typeof process !== 'undefined' && process.versions?.node) {
        features.simd = true;
        features.bulkMemory = true;
        features.mutableGlobals = true;
    }
    return features;
}
/**
 * Get recommended implementation based on environment
 */
function getRecommendedImplementation() {
    // Node.js environment - prefer native
    if (typeof process !== 'undefined' && process.versions?.node) {
        return 'native-avx2'; // Assume AVX2 as baseline
    }
    // Browser environment - check WASM features
    const features = detectWasmFeatures();
    if (features.simd && features.threads) {
        return 'wasm-threads';
    }
    if (features.simd) {
        return 'wasm-simd';
    }
    return 'wasm-base';
}
// ============================================================================
// Exports
// ============================================================================
exports.default = {
    CASCADE_BLAKE3: exports.CASCADE_BLAKE3,
    BLAKE3_ENTRY_SIZE: exports.BLAKE3_ENTRY_SIZE,
    BLAKE3_HASH_SIZE: exports.BLAKE3_HASH_SIZE,
    SIMHASH_SIZE: exports.SIMHASH_SIZE,
    createEmptyChunkHashV4,
    serializeChunkHashV4,
    deserializeChunkHashV4,
    validateChunkHashV4,
    detectWasmFeatures,
    getRecommendedImplementation
};
//# sourceMappingURL=hash-v4.js.map