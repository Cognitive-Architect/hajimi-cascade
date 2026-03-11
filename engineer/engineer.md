# Engineer 标准工作流与文档命名规范

> 本文档记录 Hajimi-Cascade 工程执行的标准工作流、目录结构和命名约定，防止遗忘。

---

## 🔥 项目背景速查（接手必读）

### 项目定位
**HAJIMI CASCADE** - 高性能内容定义分块与去重系统，用于代码智能系统的上下文压缩。

### 技术架构核心
```
Adaptive CDC → SimHash-64 (WASM SIMD) → BLAKE3-256 Verify
  (8-64字节)        890 MB/s              2^-256安全
     │                                     
     ▼                                     
Buffer Pool (RSS < 10% 稳定)     Format Detection
                                      (gzip/bzip2/zlib)
```

| 核心组件 | 文件路径 | 功能 | 版本 |
|---------|----------|------|------|
| CDC分块器 | `src/cdc/chunker-pooled.ts` | 内容定义分块 + Buffer Pool | v2.9 |
| **Adaptive CDC** | `src/cdc/adaptive-chunker.ts` | 熵自适应窗口(8-64字节) | **v2.9.1** |
| SimHash WASM | `src/wasm/simhash-loader.ts` | SIMD加速Hamming距离计算 | v2.9 |
| BLAKE3 | `src/crypto/blake3-wrapper.ts` | 256-bit加密哈希 | v2.9 |
| Hash工厂 | `src/crypto/hash-factory.ts` | 双模式策略(MD5/BLAKE3) | v2.9 |
| **Legacy写入** | `src/format/legacy-writer.ts` | HCTX v2.8格式写入 | **v2.9.1** |
| Buffer Pool | `src/utils/buffer-pool.ts` | 内存池稳定RSS | v2.9 |
| **熵计算** | `src/utils/entropy.ts` | Shannon熵计算 | **v2.9.1** |
| 并行压缩 | `src/storage/compression-parallel.ts` | Worker池并行ZSTD | v2.9 |
| **格式检测** | `src/security/format-detector.ts` | gzip/bzip2/zlib Magic检测 | **v2.9.1** |
| **沙箱限制** | `src/security/sandbox-limits.ts` | 格式特定安全限制 | **v2.9.1** |

### 版本与Phase历史
| Phase | 派单文件 | 版本目标 | 关键交付 | 状态 |
|-------|----------|----------|----------|------|
| Phase 1 | `01.md` | v2.6.1-HELL | HELL-001清偿 | ✅ Done |
| Phase 2 | `02.md` | v2.7.0-HELL-A级 | 覆盖率80%+性能基线 | ✅ Done |
| Phase 3 | `03.md` | v2.8.0-PROD-HARDENED | 生产加固 | ✅ Done |
| Phase 4 | `04.md` | 债务整理 | DEBT-RECONCILE | ✅ Done |
| Phase 5 | `05.md` | v2.9.0债务清偿 | WASM+BLAKE3+Pool | ✅ Done |
| Phase 6-8 | `06.md` ~ `08.md` | - | 中间批次 | ✅ Done |
| **Phase 9** | **`09.md`** | **v2.9.1-A级** | **四债清零** | ✅ **Done** |

### ✅ Phase 9 完成：09.md（饱和攻击派单）
**213号战役：v2.9.1 四债清零大总攻 — 已完成**

4工单串行链式攻击全部A级/Go：
```
B-01/04 (Adaptive CDC) ✅ → B-02/04 (zip bomb多格式) ✅ → B-03/04 (Legacy写入) ✅ → B-04/04 (CI文档) ✅
```

| 工单 | 交付物 | 实际行数 | 关键成果 | 状态 |
|------|--------|----------|----------|------|
| B-01/04 | `src/cdc/adaptive-chunker.ts` | 163行 | 熵自适应窗口8-64字节 | ✅ A级 |
| B-01/04 | `src/utils/entropy.ts` | 80行 | Shannon熵计算 | ✅ A级 |
| B-02/04 | `src/security/format-detector.ts` | 138行 | gzip/bzip2/zlib magic检测 | ✅ A级 |
| B-02/04 | `src/security/sandbox-limits.ts` | 34行 | 格式特定限制 | ✅ A级 |
| B-03/04 | `src/format/legacy-writer.ts` | 71行 | HCTX v2.8写入(MD5) | ✅ A级 |
| B-04/04 | `docs/ci-verification-report.md` | 105行 | Windows CI验证+README更新 | ✅ A级 |

**质量数据**: 40项红线全绿 / 40项P4全绿 / 73项测试通过

**验收口令**: "Phase 9 A级/Go，v2.9.1-DEBT-CLEARANCE达成"

### 目录结构速查
```
hajimi-cascade/
├── engineer/           # 【派单目录】01.md ~ 09.md + 本文件
├── src/
│   ├── cdc/           # CDC分块相关
│   │   ├── chunker-pooled.ts         # v2.9: Buffer Pool CDC
│   │   ├── adaptive-chunker.ts       # v2.9.1: 熵自适应CDC ⭐
│   │   └── simhash-wasm.ts           # v2.9: WASM SimHash
│   ├── crypto/        # 哈希算法
│   │   ├── blake3-wrapper.ts         # v2.9: BLAKE3包装器
│   │   ├── hash-factory.ts           # v2.9: 双模式策略
│   │   └── blake3-mock.ts            # v2.9.1: 测试兼容层 ⭐
│   ├── utils/         # 工具
│   │   ├── buffer-pool.ts            # v2.9: 内存池
│   │   ├── entropy.ts                # v2.9.1: 香农熵计算 ⭐
│   │   └── platform-adapter.ts       # v2.9: 跨平台适配
│   ├── storage/       # 压缩/缓存
│   │   ├── compression-parallel.ts   # v2.9: 并行压缩
│   │   ├── w-tinylfu-cache.ts        # v2.9: W-TinyLFU缓存
│   │   └── shard-manager.ts          # v2.9: 分片管理
│   ├── format/        # 格式处理
│   │   ├── byte-order-adaptive.ts    # v2.9: 字节序自适应
│   │   ├── version-migrator.ts       # v2.9: 版本迁移
│   │   └── legacy-writer.ts          # v2.9.1: HCTX v2.8写入 ⭐
│   ├── security/      # 安全
│   │   ├── input-sandbox.ts          # v2.9: 输入沙箱
│   │   ├── format-detector.ts        # v2.9.1: 格式检测 ⭐
│   │   └── sandbox-limits.ts         # v2.9.1: 沙箱限制 ⭐
│   └── wasm/          # WASM加载器
│       └── simhash-loader.ts         # v2.9: WASM加载器
├── tests/             # 测试
│   ├── unit/          # 单元测试
│   │   ├── entropy.test.ts           # v2.9.1: 熵计算测试 ⭐
│   │   ├── adaptive-chunker.test.ts  # v2.9.1: Adaptive CDC测试 ⭐
│   │   ├── format-detector.test.ts   # v2.9.1: 格式检测测试 ⭐
│   │   ├── zip-bomb-format.test.ts   # v2.9.1: zip bomb测试 ⭐
│   │   └── dual-mode-write.test.ts   # v2.9.1: 双模式写入测试 ⭐
│   ├── crypto/        # 加密测试
│   ├── e2e/           # 端到端测试
│   ├── stress/        # 压力测试
│   └── wasm/          # WASM测试
├── docs/
│   ├── task01~09/     # 验收报告 (README.md / XX-waveN-self-audit.md)
│   │   └── task09/                     # v2.9.1四债清零 ⭐
│   ├── COMP-PARALLEL-ARCH.md           # 并行压缩架构
│   ├── ci-verification-report.md       # v2.9.1: CI验证报告 ⭐
│   └── self-audit/    # 自测报告归档
├── scripts/           # 工具脚本
└── .github/workflows/ # CI配置
    └── hardened-ci.yml                 # v2.9.1: Windows CI支持 ⭐
```

**图例**: ⭐ = v2.9.1 新增/更新

### 开发工作流（简化版）
```
1. 读取 engineer/XX.md → 解析Wave矩阵/红线/P4检查表
2. git checkout -b feat/phaseX-[task-name]
3. 编码（严格行数限制）→ npm run build → npm test
4. 刀刃表自检 + 红线检查（10项全绿）
5. 编写 Self-Audit → docs/taskXX/XX-waveN-self-audit.md
6. Git提交: feat(phaseX-waveN): [描述]
7. 输出总体验收报告 → docs/taskXX/README-XX.md
8. 【必须】同步到 storage/downloads/hajimi-cascade/（代码+文档）
```

### 关键命令
```bash
# 构建 & 测试
npm run build
npm test
npm run benchmark

# 行数检查（示例）
wc -l src/cdc/chunker-pooled.ts

# 债务检查
npm run debt-check
```

---

*以上背景信息基于 09.md 及项目现状整理，接手后请先阅读当前派单文件再执行。*

---

## 1. 完整执行工作流（读取 → 执行 → 输出）

### 1.1 任务读取阶段

#### 读取位置
```
engineer/XX.md                  # 派单文件（如 04.md）
```

#### 读取后必须解析的内容
1. **批次信息**: Phase X, 版本目标, 质量约束
2. **Wave 矩阵**: 波次数量、依赖关系、交付物清单
3. **刀刃表**: 风险自测项（FUNC/CONST/NEG/E2E/High）
4. **地狱红线**: 10项不可违反的底线
5. **收卷格式**: 验收报告模板

#### 执行策略确认
- 单波: 直接执行
- 多波串行: Wave 1 → Wave 2 → Wave 3（前波不过后波不开）
- 并行波: 多任务并行，最后汇总

---

### 1.2 开发执行阶段

#### 步骤 1: 环境准备
```bash
# 1. 检查当前分支
git branch --show-current

# 2. 创建/切换到任务分支
git checkout -b feat/phaseX-[task-name]

# 3. 验证基线状态
npm test          # 确保原测试通过
npm run build     # 确保构建通过
```

#### 步骤 2: Wave 执行（循环）
对于每个 Wave:

```
① 创建交付物目录
   mkdir -p tests/xxx scripts/xxx src/xxx

② 编写代码（严格遵守行数限制）
   - 单元测试: 80±10行
   - CI配置: 120±10行
   - 其他: 参照行数限制表

③ 构建验证
   npm run build

④ 测试验证
   npm test -- [特定测试]

⑤ 刀刃表自检
   - FUNC: 核心功能完整？
   - CONST: 约束条件满足？
   - NEG: 负面路径覆盖？
   - E2E: 端到端通过？
   - High: 高风险防护？

⑥ 红线检查
   - 10项红线全绿才能进入下一 Wave
   - 任一红线触发立即返工

⑦ 编写 Self-Audit 报告
   docs/taskXX/XX-waveN-self-audit.md

⑧ Git 提交
   git add [文件]
   git commit -m "feat(phaseX-waveN): [描述]"
```

#### 步骤 3: Wave 间验收
```
Wave N 完成 → 自测报告 → 申请验收 → A级/Go → 启动 Wave N+1
            ↓ 验收失败
            返工重来
```

---

### 1.3 报告输出阶段

#### 输出位置
```
docs/taskXX/                    # 批次目录
├── README-XX.md                # 总体验收报告
├── XX-wave1-self-audit.md      # Wave 1 自测
├── XX-wave2-self-audit.md      # Wave 2 自测
└── XX-wave3-self-audit.md      # Wave 3 自测（如适用）
```

#### 总体验收报告（README-XX.md）内容模板
```markdown
# Phase X [批次名称] - 验收报告

## 批次信息
- **批次**: Phase X (XX.md)
- **策略**: [单波/多波串行/并行]
- **质量原则**: 不计时间成本，只求硬核质量
- **验收状态**: 申请A级/Go

## Wave 交付物汇总

| Wave | 交付物 | 路径 | 行数 | 状态 |
|:---|:---|:---:|:---:|:---:|
| Wave 1 | xxx | `路径` | XX | ✅ |

## 红线验证（X项全绿）

| Wave | 红线数 | 状态 |
|:---|:---:|:---:|
| Wave 1 | 10 | ✅ 全绿 |

## P4检查表（X项全绿）

| Wave | 检查项 | 状态 |
|:---|:---:|:---:|
| Wave 1 | 10 | ✅ 全绿 |

## Self-Audit 索引

| Wave | 报告路径 |
|:---|:---|
| Wave 1 | `XX-wave1-self-audit.md` （本目录） |

## 版本声明

**vX.Y.Z-[CODENAME]** 达成条件：
- [x] Wave 1 A级/Go
- [x] X项红线零触发
- [x] X项P4全绿

## 验收口令

> **"Phase X A级/Go，vX.Y.Z-[CODENAME]达成"**

---
*归档时间: YYYY-MM-DD*
*批次对应: engineer/XX.md*
```

#### 同步到 downloads 目录（**重要！不要遗漏**）

```bash
# 1. 同步文档（总结报告 + Self-Audit）
mkdir -p storage/downloads/hajimi-cascade/docs/taskXX/
cp hajimi-cascade/docs/taskXX/* storage/downloads/hajimi-cascade/docs/taskXX/

# 2. 【必须】同步交付物（代码/测试/脚本/配置）
# 每次都必须同步以下目录，不能只同步文档！
cp hajimi-cascade/src/XXX/xxx.ts storage/downloads/hajimi-cascade/src/XXX/
cp hajimi-cascade/tests/XXX/xxx.test.ts storage/downloads/hajimi-cascade/tests/XXX/
cp hajimi-cascade/scripts/XXX/xxx.mjs storage/downloads/hajimi-cascade/scripts/XXX/
cp hajimi-cascade/.github/workflows/xxx.yml storage/downloads/hajimi-cascade/.github/workflows/
```

> ⚠️ **警告**：每次必须同时同步「总结文档」和「交付物代码」，不能只同步文档！
> 
> 漏同步内容会导致用户无法查看实际代码和测试文件，这是**低级错误**。

---

## 2. 批次命名规则

### 批次标识
| 批次 | 目录名 | engineer文件 | 版本目标 |
|:---|:---|:---|:---|
| Phase 1 | `task01/` | `01.md` | v2.6.1-HELL |
| Phase 2 | `task02/` | `02.md` | v2.7.0-HELL-A级 |
| Phase 3 | `task03/` | `03.md` | v2.8.0-PROD-HARDENED |
| Phase 4 | `task04/` | `04.md` | 下一批次 |

### 批次目录结构
```
docs/task04/                    # 批次主目录
├── README-04.md                # 总体验收报告（序号在后）
├── 04-wave1-self-audit.md      # Wave 1 自测报告（序号在前，小写）
├── 04-wave2-self-audit.md      # Wave 2 自测报告
└── 04-wave3-self-audit.md      # Wave 3 自测报告（如适用）
```

> **注意**: task03 及之前批次保持原命名（README.md + WAVE-X-SELF-AUDIT.md），从 task04 开始执行新规范。

---

## 3. Wave 执行规范

### Wave 类型
- **单波**: 简单任务，单文件交付
- **多波串行**: Wave 1 → Wave 2 → Wave 3，前波不过后波不开
- **并行波**: 多任务并行执行

### Wave 命名
```
Wave 1: [任务简述]
Wave 2: [任务简述]（依赖 Wave 1）
Wave 3: [任务简述]（依赖 Wave 2）
```

### 每个 Wave 必须包含
1. **交付物清单**（文件路径 + 行数限制）
2. **刀刃表**（FUNC/CONST/NEG/E2E/High 五类风险）
3. **地狱红线**（10项，违反即停）
4. **P4 检查表**（10项质量检查）
5. **Self-Audit 报告**

---

## 4. Self-Audit 报告规范

### 报告内容（必须包含）
```markdown
## 提交信息
- Commit: `feat(phaseX-waveN): [描述]`
- 分支: `feat/[branch-name]`
- 变更文件: [列表]

## 刀刃表摘要
| 类别 | 覆盖数 | 关键证据 |

## 地狱红线验证（10项）
| 红线ID | 状态 | 证据 |

## P4检查表
| 检查点 | 状态 | 说明 |

## 交付物验证
[每项交付物的验证]

## 债务声明
- 当前波次债务
- 前置债务

## 验收申请
[口令]
```

---

## 5. Git 提交规范

### 分支命名
```
feat/phase3-prod-hardening      # 功能分支
fix/hell001-debt-clearance      # 修复分支
```

### 提交消息格式
```
feat(phaseX-waveN): 简短描述

- 交付物1: 路径 (行数)
- 交付物2: 路径 (行数)
- 核心成果

红线状态: X/10 绿
```

---

## 6. 目录结构总览

### 工程目录
```
hajimi-cascade/
├── engineer/                   # 【读取】派单文件目录
│   ├── 01.md                   # Phase 1 派单
│   ├── 02.md                   # Phase 2 派单
│   ├── 03.md                   # Phase 3 派单
│   ├── 04.md                   # Phase 4 派单（下一批次）
│   └── engineer.md             # 本规范文件
│
├── docs/                       # 【输出】文档归档
│   ├── task01/                 # Phase 1 验收
│   │   └── README.md
│   ├── task02/                 # Phase 2 验收
│   │   └── README.md
│   ├── task03/                 # Phase 3 验收
│   │   ├── README.md
│   │   ├── WAVE-1-SELF-AUDIT.md    # 旧命名，保持兼容
│   │   ├── WAVE-2-SELF-AUDIT.md
│   │   └── WAVE-3-SELF-AUDIT.md
│   └── task04/                 # Phase 4 开始新规范
│       ├── README-04.md
│       ├── 04-wave1-self-audit.md
│       ├── 04-wave2-self-audit.md
│       └── 04-wave3-self-audit.md
│
├── src/                        # 源代码
├── tests/                      # 测试文件
├── scripts/                    # 工具脚本
└── .github/                    # CI/CD 配置
```

### 完整工作流图示
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ① 读取任务     │     │  ② 执行开发     │     │  ③ 输出报告     │
│  engineer/XX.md │ ──▶ │  Wave 1/2/3    │ ──▶ │  docs/taskXX/   │
│                 │     │                 │     │                 │
│ • 解析Wave矩阵  │     │ • 编写交付物    │     │ • 总体验收报告  │
│ • 识别红线      │     │ • 刀刃表自检    │     │ • Self-Audit    │
│ • 确认策略      │     │ • 红线检查      │     │ • 同步downloads │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   失败: 请求澄清          失败: 返工重来          失败: 补充修正
```

---

## 7. 验收口令

### Wave 级别
```
"Wave N A级/Go，启动Wave N+1"
```

### Phase 级别
```
"Phase X A级/Go，vX.Y.Z-[CODENAME]达成"
```

---

## 8. 行数限制参考

| 交付物类型 | 目标行数 | 浮动范围 |
|:---|:---:|:---:|
| 单元测试 | 80行 | ±10行 |
| 集成测试 | 100行 | ±10行 |
| 压力测试 | 100行 | ±10行 |
| CI配置 | 120行 | ±10行 |
| 工具脚本 | 100行 | ±10行 |
| 适配层 | 80行 | ±10行 |
| 安全模块 | 120行 | ±10行 |
| 迁移器 | 150行 | ±10行 |

---

## 9. 执行检查清单（Checklist）

每次执行前必读：

- [ ] 已读取 engineer/XX.md 完整内容
- [ ] 已确认 Wave 类型（单波/串行/并行）
- [ ] 已识别所有交付物和行数限制
- [ ] 已理解10项红线内容
- [ ] 已创建 feat/ 分支
- [ ] 已验证基线测试通过
- [ ] 已按 Wave 顺序执行（串行时）
- [ ] 每项交付物已通过构建+测试
- [ ] 已编写 Self-Audit 报告
- [ ] 已输出到 docs/taskXX/
- [ ] 已同步到 storage/downloads/
  - [ ] 文档（README + Self-Audit）
  - [ ] 交付物（src/ tests/ scripts/ .github/）⚠️ **不要遗漏！**
- [ ] 已 Git 提交

---

## 10. 历史变更记录

| 日期 | 变更 |
|:---|:---|
| 2026-03-10 | **v2.9.1-DEBT-CLEARANCE完成** - Phase 9四债清零 (Adaptive CDC/zip bomb/Legacy写入/Windows CI) |
| 2026-03-10 | 更新技术架构核心文档，添加v2.9.1组件 (adaptive-chunker/entropy/format-detector/legacy-writer) |
| 2026-03-10 | 更新目录结构速查，标记v2.9.1新增文件 |
| 2026-03-09 | 确立 task04+ 新命名规范（README-XX.md + XX-waveN-self-audit.md）|
| 2026-03-09 | task03 及之前保持兼容性命名 |
| 2026-03-09 | 补充完整工作流（读取 → 执行 → 输出）|

---

## 附录：v2.9.1 四债清零速查

### 债务清偿汇总

| 债务ID | 描述 | 清偿文件 | 测试文件 |
|:---|:---|:---|:---|
| DEBT-CDC-001 | Adaptive CDC动态窗口 | `src/cdc/adaptive-chunker.ts` (163行) | `tests/unit/adaptive-chunker.test.ts` |
| DEBT-ENTROPY-001 | Shannon熵计算 | `src/utils/entropy.ts` (80行) | `tests/unit/entropy.test.ts` |
| DEBT-SECURITY-001 | zip bomb多格式检测 | `src/security/format-detector.ts` (138行) | `tests/unit/format-detector.test.ts` |
| DEBT-LIMITS-001 | 格式特定安全限制 | `src/security/sandbox-limits.ts` (34行) | `tests/unit/zip-bomb-format.test.ts` |
| DEBT-FORMAT-001 | HCTX v2.8写入支持 | `src/format/legacy-writer.ts` (71行) | `tests/unit/dual-mode-write.test.ts` |
| DEBT-DOC-001 | Windows CI文档更新 | `docs/ci-verification-report.md` (105行) | `.github/workflows/hardened-ci.yml` |

### GitHub链接
- 分支: `feat/v2.9.1-debt-clearance`
- 总体验收报告: `docs/task09/README-09.md`
- 自测报告: `docs/task09/09-wave{1-4}-self-audit.md`

---

*本规范由 Engineer 维护，执行时务必遵守，防止返工。*  
*最后更新: 2026-03-10 (v2.9.1-DEBT-CLEARANCE)*
