/**
 * 交叉版本兼容性测试 (DEBT-VALIDATION-004)
 *
 * 测试场景：
 * 1. v1-reader 读 v2.6 文件 → 应抛出 InvalidMagic 或 VersionTooHigh
 * 2. v2.6-reader 读 v1 文件 → 应成功（向后兼容）
 * 3. v2.6-reader 读 v2.0 文件 → 应成功
 * 4. v2.0-reader 读 v2.6 文件 → 应抛出 MIN_VERSION_TOO_HIGH
 */
export {};
//# sourceMappingURL=cross-version.test.d.mts.map