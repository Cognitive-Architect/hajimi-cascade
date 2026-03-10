# 债务清偿路线图 v2.9.0 - v3.0

**文档版本**: v1.0  
**规划周期**: 2026 Q2-Q4  
**目标**: 系统性清偿v2.6.1-v2.8.0累积的技术债务

---

## v2.9.0 "Algorithm Hardening"（算法硬化）

**目标日期**: 2026 Q2 (6-8周)  
**核心目标**: 解决Phase 1 Q2遗留债务，性能提升2.5×

### 债务清偿清单

| 债务ID | 解决方式 | 工时估算 | 依赖 | 验收标准 |
|:---|:---|:---:|:---|:---|
| DEBT-WASM-001 | WASM SIMD SimHash实现 | 16h | 无 | SimHash计算从3.1s/GB降至1s/GB |
| ROADMAP-P1-003 | WASM加速（同上） | 同左 | WASM-001 | 吞吐量从180MB/s提升至500MB/s |
| DEBT-MEM-001 | Buffer Pooling实现 | 8h | 无 | RSS波动从4-45%降至<10% |
| ROADMAP-P1-001 | BLAKE3可选模式 | 12h | 无 | 双模式兼容（MD5/BLAKE3） |
| ROADMAP-P1-002 | Adaptive CDC动态窗口 | 20h | 测试覆盖 | 窗口根据内容熵自适应调整 |
| DEBT-PHASE3-001 | Windows CI bash兼容 | 4h | 无 | Windows runner稳定运行 |
| DEBT-PHASE3-003 | zip bomb多格式支持 | 6h | 无 | 支持gzip/bzip2/zlib检测 |

**总工时**: ~66小时（2人×4周，含测试）

### 里程碑检查点

| 检查点 | 日期 | 交付物 | 验收标准 |
|:---|:---|:---|:---|
| M1-WASM基础 | Week 2 | `src/cdc/simhash-wasm.ts` | 单元测试通过，性能基准达标 |
| M2-Buffer Pool | Week 3 | `src/utils/buffer-pool.ts` | RSS采样测试波动<10% |
| M3-BLAKE3集成 | Week 4 | `src/crypto/blake3-wrapper.ts` | 向后兼容，校验和正确 |
| M4-Adaptive CDC | Week 6 | `src/cdc/adaptive-chunker.ts` | 边界条件测试通过 |
| M5-CI兼容 | Week 1-6 | `.github/workflows/*.yml` | Windows/Linux双绿 |

### 验收标准（v2.9.0发布门槛）

- [ ] **性能指标**: 端到端吞吐量 ≥ 500 MB/s（当前180 MB/s）
- [ ] **内存稳定性**: 3分钟压力测试RSS波动 < 10%（当前4-45%）
- [ ] **安全加固**: zip bomb检测覆盖gzip/bzip2/zlib
- [ ] **CI稳定性**: Windows runner连续10次构建成功
- [ ] **向后兼容**: BLAKE3/MD5双模式，v2.8数据无损读取

---

## v3.0 "Scale Architecture"（架构升级）

**目标日期**: 2026 Q3-Q4 (12-16周)  
**核心目标**: 分布式扩展 + 持久化存储 + GPU加速

### 债务清偿清单

| 债务ID | 解决方式 | 工时估算 | 依赖 | 验收标准 |
|:---|:---|:---:|:---|:---|
| ROADMAP-P2-001 | RocksDB LSH索引持久化 | 40h | v2.9.0稳定 | 100万向量索引启动<5s |
| ROADMAP-P2-002 | 分布式去重（一致性哈希） | 80h | RocksDB完成 | 3节点集群，分片均衡 |
| ROADMAP-P2-003 | GPU批处理加速 | 60h | WASM完成 | GPU利用率>80%，吞吐2GB/s |
| ROADMAP-P3-001 | Hajimi-Code插件API | 20h | 架构稳定 | VSCode/IntelliJ插件原型 |
| ROADMAP-P3-002 | 流式压缩实时编辑 | 30h | Buffer Pool | 增量更新延迟<100ms |
| ROADMAP-P3-003 | 增量上下文更新 | 25h | 流式压缩 | 只传diff，带宽节省50% |

**总工时**: ~255小时（4人×8周，含集成测试）

### 架构演进图

```
v2.8.0 (当前)
├─ 单节点内存LSH索引
├─ CPU only SimHash
├─ 文件级压缩
└─ CLI工具

    ▼ v2.9.0 (算法硬化)

v2.9.0
├─ WASM SIMD加速 (500MB/s)
├─ Buffer Pool稳定 (<10%波动)
├─ Adaptive CDC动态窗口
├─ BLAKE3可选模式
└─ zip bomb多格式检测

    ▼ v3.0 (架构升级)

v3.0
├─ RocksDB持久化索引 (TB级)
├─ 一致性哈希分布式
├─ GPU批处理 (2GB/s)
├─ 插件API (IDE集成)
└─ 流式增量更新
```

### 技术选型建议

| 组件 | 推荐方案 | 备选方案 | 决策依据 |
|:---|:---|:---|:---|
| WASM运行时 | wasmtime | wasmer | 成熟度高，Node.js绑定完善 |
| BLALE3库 | blake3 npm | 自研WASM | 性能vs可控性权衡 |
| RocksDB绑定 | leveldown | rocksdb-node | LevelDB API兼容，社区活跃 |
| GPU计算 | WebGPU | CUDA | 跨平台，未来标准 |
| 分布式协调 | etcd | Consul | 一致性哈希天然适配 |

---

## v2.9.x "Polish"（打磨版本）

### v2.9.1（稳定性修复，4周）

| 债务ID | 修复内容 | 工时 |
|:---|:---|:---:|
| DEBT-PHASE3-004 | 文档声明v2.5为最低支持版本 | 2h |
| DEBT-MEM-001后续 | Buffer Pool生产环境调优 | 8h |
| 社区反馈 | Issue驱动的bug修复 | 20h |

### v2.9.2（安全加固，4周）

| 债务ID | 修复内容 | 工时 |
|:---|:---|:---:|
| ROADMAP-P1-001后续 | BLAKE3默认模式切换 | 12h |
| DEBT-PHASE3-002 | version-migrator重构至180行 | 4h |
| 安全审计 | 第三方依赖CVE扫描修复 | 8h |

---

## 风险与缓解策略

| 风险 | 概率 | 影响 | 缓解策略 |
|:---|:---:|:---:|:---|
| WASM性能不达预期 | 中 | 高 | 预留2周优化buffer，备选AssemblyScript |
| RocksDB集成复杂度高 | 高 | 中 | 先LevelDB原型验证，再升级RocksDB |
| GPU驱动兼容性差 | 中 | 中 | 优先WebGPU标准，提供CPU fallback |
| 分布式状态一致性 | 中 | 高 | 采用CRDT简化，避免强一致复杂协议 |

---

## 资源需求

| 版本 | 人力 | 计算资源 | 外部依赖 |
|:---|:---:|:---|:---|
| v2.9.0 | 2人（算法工程师） | CI/CD + 测试服务器 | wasmtime, blake3 |
| v3.0 | 4人（架构+分布式+GPU+插件） | GPU服务器 + K8s集群 | RocksDB, WebGPU |
| v2.9.x | 1人（维护） | 现有CI | 社区Issue响应 |

---

## 关联文档

- [DEBT-RECONCILE-REPORT-v1.0.md](./DEBT-RECONCILE-REPORT-v1.0.md) - 债务清算详情
- [KNOWN-LIMITATIONS-v2.8.0.md](./KNOWN-LIMITATIONS-v2.8.0.md) - 已知限制更新

---

*路线图制定: 2026-03-09*  
*制定者: External Mike (审计喵 Deep Research)*  
*状态: 待技术委员会评审*
