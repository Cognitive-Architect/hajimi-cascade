# R-001 源码恢复说明文档

## 恢复方法

从 `dist/src/storage/zstd-compression.js` + `.d.ts` 反编译/重建源码。

## 关键函数列表

| 函数/类 | 类型 | 说明 |
|---------|------|------|
| `ZstdCompression` | class | 主压缩类 |
| `compressSync` | method | 同步压缩 |
| `decompressSync` | method | 同步解压 |
| `compress` | async method | 异步压缩（带元数据）|
| `decompress` | async method | 异步解压（带元数据）|
| `calculateChunkCount` | method | 计算分块数 |
| `splitIntoChunks` | method | 数据分块 |
| `CompressionOptions` | interface | 配置选项 |
| `CompressionResult` | interface | 结果类型 |
| `zstdCompression` | const | 单例实例 |

## 验证状态

- 行数: 172行 (符合180±10限制)
- 构建: ✅ tsc --noEmit 零错误
- 类型: ✅ .d.ts 已生成
- 测试: ✅ API行为一致

## 债务清偿声明

R-001: ✅ 已清零（源码已恢复，构建通过）
