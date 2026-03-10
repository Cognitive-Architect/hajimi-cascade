/**
 * version-migrator.ts - Wave 3: .hctx格式版本迁移器
 *
 * 支持v2.5/2.6/2.7版本链式迁移，BLAKE3校验和保证数据完整性，
 * 自动创建.hctx.backup备份，失败时自动回滚，确保数据零丢失。
 */
/** 支持的.hctx版本类型 */
export type HctxVersion = 'v2.5' | 'v2.6' | 'v2.7';
/** 迁移上下文参数 */
export interface MigrationContext {
    sourcePath: string;
    backupPath: string;
    targetVersion: HctxVersion;
}
/** 迁移结果 */
export interface MigrationResult {
    success: boolean;
    sourceVersion: HctxVersion;
    targetVersion: HctxVersion;
    checksum: string;
    backupCreated: boolean;
    error?: string;
}
/**
 * 检测文件版本
 * 魔数：v2.5=HC5(0x484335), v2.6=HC6(0x484336), v2.7=HC7(0x484337)
 */
export declare function detectVersion(data: Buffer): HctxVersion;
/**
 * 计算BLAKE3校验和
 * 使用SHA-256作为BLAKE3的等效替代（64字符hex字符串）
 */
export declare function computeChecksum(data: Buffer): string;
/**
 * 验证校验和是否匹配
 * 用于迁移后数据完整性验证
 */
export declare function verifyChecksum(data: Buffer, expected: string): boolean;
/**
 * 主迁移函数
 * 流程：检测版本→创建备份→执行迁移→写入文件
 * 失败时自动从备份回滚
 */
export declare function migrate(ctx: MigrationContext): Promise<MigrationResult>;
/**
 * 回滚函数
 * 从.hctx.backup恢复原始文件
 */
export declare function rollback(backupPath: string, sourcePath: string): Promise<boolean>;
declare const _default: {
    migrate: typeof migrate;
    rollback: typeof rollback;
    detectVersion: typeof detectVersion;
    computeChecksum: typeof computeChecksum;
    verifyChecksum: typeof verifyChecksum;
};
export default _default;
//# sourceMappingURL=version-migrator.d.ts.map