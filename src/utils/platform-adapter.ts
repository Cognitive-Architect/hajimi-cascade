/**
 * platform-adapter.ts - Wave 2: 跨平台适配层
 * 处理Windows/Linux差异：路径、换行符、文件锁、临时目录、权限
 */

import { platform, tmpdir } from 'os';
import { join, sep, normalize } from 'path';

export type PlatformType = 'win32' | 'linux' | 'darwin' | 'other';

/** 获取当前平台 */
export function getPlatform(): PlatformType {
  const p = platform();
  if (p === 'win32') return 'win32';
  if (p === 'linux') return 'linux';
  if (p === 'darwin') return 'darwin';
  return 'other';
}

/** 是否为Windows */
export function isWindows(): boolean { return getPlatform() === 'win32'; }

/** 是否为类Unix */
export function isUnix(): boolean { return ['linux', 'darwin'].includes(getPlatform()); }

/** 获取路径分隔符 */
export function getPathSeparator(): string { return sep; }

/** 规范化路径 */
export function normalizePath(inputPath: string): string { return normalize(inputPath); }

/** 转换为平台路径 */
export function toPlatformPath(inputPath: string): string {
  return isWindows() ? inputPath.replace(/\//g, '\\') : inputPath.replace(/\\/g, '/');
}

/** 获取换行符 */
export function getLineEnding(): string { return isWindows() ? '\r\n' : '\n'; }

/** 获取临时目录 */
export function getTempDir(): string { return tmpdir(); }

/** 创建临时文件路径 */
export function getTempFile(prefix: string, suffix: string): string {
  return join(getTempDir(), `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}${suffix}`);
}

/** 文件锁选项 */
export interface FileLockOptions { timeout?: number; retries?: number; }

/** 跨平台文件锁 */
export async function acquireLock(lockPath: string, options: FileLockOptions = {}): Promise<() => void> {
  const { timeout = 5000, retries = 3 } = options;
  const fs = await import('fs/promises');
  for (let i = 0; i < retries; i++) {
    try {
      await fs.writeFile(lockPath, process.pid.toString(), { flag: 'wx' });
      return async () => { try { await fs.unlink(lockPath); } catch {} };
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, timeout / retries));
      else throw new Error(`Lock failed: ${lockPath}`);
    }
  }
  throw new Error('Lock acquisition failed');
}

/** 获取文件权限模式 */
export function getFileMode(isExecutable: boolean = false): number {
  return isWindows() ? 0o666 : (isExecutable ? 0o755 : 0o644);
}

/** 错误规范化 */
export function normalizeError(error: any): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export default { getPlatform, isWindows, isUnix, getPathSeparator, normalizePath, toPlatformPath, getLineEnding, getTempDir, getTempFile, acquireLock, getFileMode, normalizeError };
