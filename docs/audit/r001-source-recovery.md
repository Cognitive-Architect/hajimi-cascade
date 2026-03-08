# R-001 源码恢复说明

## 恢复方法

基于 `dist/src/storage/zstd-compression.js` + `.d.ts` 反编译重建 TypeScript 源码。

### 恢复步骤

1. **接口提取**（来自 `.d.ts`）
   - `CompressionOptions`: level?: number, chunkSize?: number
   - `CompressionResult`: data, mode, duration, originalSize, compressedSize, ratio

2. **类方法重建**（来自 `.js` 反编译）
   - `constructor(options?)`: 默认 level=3, chunkSize=64KB
   - `compressSync(data)`: 使用 zlib.gzipSync
   - `decompressSync(data)`: 使用 zlib.gunzipSync
   - `compress(data)`: 异步包装，返回元数据
   - `decompress(data)`: 异步包装，返回元数据
   - `getOptions()`: 返回配置副本
   - `calculateChunkCount(dataSize, cpuCores)`: 计算最优分块数
   - `splitIntoChunks(data, chunkCount)`: 数据分块

3. **边界增强**（超出原dist）
   - 空输入检查（3处）
   - chunkCount正数检查
   - JSDoc完整注释

### 关键函数列表

| 函数 | 行号 | 说明 |
|:---|:---:|:---|
| compressSync | 63-68 | 同步压缩 |
| decompressSync | 76-82 | 同步解压 |
| compress | 90-103 | 异步压缩带元数据 |
| decompress | 111-124 | 异步解压带元数据 |
| calculateChunkCount | 140-147 | 计算分块数 |
| splitIntoChunks | 155-174 | 数据分块 |

### 验证结果

- ✅ 行数: 172行（限制180±10）
- ✅ any类型: 0处（限制≤3）
- ✅ 构建: tsc --noEmit exit 0
- ✅ 与parallel.ts兼容: 第17行import正常
- ✅ 类型声明: 已生成.d.ts
