/**
 * platform-adapter.ts - Wave 2: 跨平台适配层
 * 处理Windows/Linux差异：路径、换行符、文件锁、临时目录、权限
 */
export type PlatformType = 'win32' | 'linux' | 'darwin' | 'other';
/** 获取当前平台 */
export declare function getPlatform(): PlatformType;
/** 是否为Windows */
export declare function isWindows(): boolean;
/** 是否为类Unix */
export declare function isUnix(): boolean;
/** 获取路径分隔符 */
export declare function getPathSeparator(): string;
/** 规范化路径 */
export declare function normalizePath(inputPath: string): string;
/** 转换为平台路径 */
export declare function toPlatformPath(inputPath: string): string;
/** 获取换行符 */
export declare function getLineEnding(): string;
/** 获取临时目录 */
export declare function getTempDir(): string;
/** 创建临时文件路径 */
export declare function getTempFile(prefix: string, suffix: string): string;
/** 文件锁选项 */
export interface FileLockOptions {
    timeout?: number;
    retries?: number;
}
/** 跨平台文件锁 */
export declare function acquireLock(lockPath: string, options?: FileLockOptions): Promise<() => void>;
/** 获取文件权限模式 */
export declare function getFileMode(isExecutable?: boolean): number;
/** 错误规范化 */
export declare function normalizeError(error: any): Error;
declare const _default: {
    getPlatform: typeof getPlatform;
    isWindows: typeof isWindows;
    isUnix: typeof isUnix;
    getPathSeparator: typeof getPathSeparator;
    normalizePath: typeof normalizePath;
    toPlatformPath: typeof toPlatformPath;
    getLineEnding: typeof getLineEnding;
    getTempDir: typeof getTempDir;
    getTempFile: typeof getTempFile;
    acquireLock: typeof acquireLock;
    getFileMode: typeof getFileMode;
    normalizeError: typeof normalizeError;
};
export default _default;
//# sourceMappingURL=platform-adapter.d.ts.map