"use strict";
/**
 * platform-adapter.ts - Wave 2: 跨平台适配层
 * 处理Windows/Linux差异：路径、换行符、文件锁、临时目录、权限
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
exports.getPlatform = getPlatform;
exports.isWindows = isWindows;
exports.isUnix = isUnix;
exports.getPathSeparator = getPathSeparator;
exports.normalizePath = normalizePath;
exports.toPlatformPath = toPlatformPath;
exports.getLineEnding = getLineEnding;
exports.getTempDir = getTempDir;
exports.getTempFile = getTempFile;
exports.acquireLock = acquireLock;
exports.getFileMode = getFileMode;
exports.normalizeError = normalizeError;
const os_1 = require("os");
const path_1 = require("path");
/** 获取当前平台 */
function getPlatform() {
    const p = (0, os_1.platform)();
    if (p === 'win32')
        return 'win32';
    if (p === 'linux')
        return 'linux';
    if (p === 'darwin')
        return 'darwin';
    return 'other';
}
/** 是否为Windows */
function isWindows() { return getPlatform() === 'win32'; }
/** 是否为类Unix */
function isUnix() { return ['linux', 'darwin'].includes(getPlatform()); }
/** 获取路径分隔符 */
function getPathSeparator() { return path_1.sep; }
/** 规范化路径 */
function normalizePath(inputPath) { return (0, path_1.normalize)(inputPath); }
/** 转换为平台路径 */
function toPlatformPath(inputPath) {
    return isWindows() ? inputPath.replace(/\//g, '\\') : inputPath.replace(/\\/g, '/');
}
/** 获取换行符 */
function getLineEnding() { return isWindows() ? '\r\n' : '\n'; }
/** 获取临时目录 */
function getTempDir() { return (0, os_1.tmpdir)(); }
/** 创建临时文件路径 */
function getTempFile(prefix, suffix) {
    return (0, path_1.join)(getTempDir(), `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}${suffix}`);
}
/** 跨平台文件锁 */
async function acquireLock(lockPath, options = {}) {
    const { timeout = 5000, retries = 3 } = options;
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    for (let i = 0; i < retries; i++) {
        try {
            await fs.writeFile(lockPath, process.pid.toString(), { flag: 'wx' });
            return async () => { try {
                await fs.unlink(lockPath);
            }
            catch { } };
        }
        catch {
            if (i < retries - 1)
                await new Promise(r => setTimeout(r, timeout / retries));
            else
                throw new Error(`Lock failed: ${lockPath}`);
        }
    }
    throw new Error('Lock acquisition failed');
}
/** 获取文件权限模式 */
function getFileMode(isExecutable = false) {
    return isWindows() ? 0o666 : (isExecutable ? 0o755 : 0o644);
}
/** 错误规范化 */
function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
}
exports.default = { getPlatform, isWindows, isUnix, getPathSeparator, normalizePath, toPlatformPath, getLineEnding, getTempDir, getTempFile, acquireLock, getFileMode, normalizeError };
//# sourceMappingURL=platform-adapter.js.map