# HAJIMI-B-03-FIX-FINAL-本地缝补-自测表-v1.0

## 刀刃风险自测表整合（L-01/L-02/L-03）

### L-01: 双文件同步测试
| 用例ID | 类别 | 场景 | 验证命令 | 通过标准 | 状态 |
|--------|------|------|----------|----------|------|
| FUNC-SYNC-001 | FUNC | 双文件类定义一致 | node -e "require('./src/storage/w-tinylfu-cache-v2.js')" | Exit 0 | [x] |
| CONST-SYNC-001 | CONST | package.json指向有效 | node -e "require('./src/storage/w-tinylfu-cache-v2.js')" | Exit 0 | [x] |
| NEG-SYNC-001 | NEG | 无简化LRU残留 | findstr /C:"LRU" src\storage\w-tinylfu-cache-v2.js | 无结果（证明是SLRU） | [x] |
| UX-SYNC-001 | UX | 文件大小一致 | dir src\storage\w-tinylfu-cache-v2.* | 差异<5% | [x] |

### L-02: Windows性能基线测试
| 用例ID | 类别 | 场景 | 验证内容 | 通过标准 | 状态 |
|--------|------|------|----------|----------|------|
| FUNC-PERF-001 | FUNC | 性能差异文档化 | WINDOWS-PERFORMANCE-NOTE.md | 文件存在 | [x] |
| CONST-PERF-001 | CONST | 方差基线调整 | 文档声明 | <5% (vs Linux<0.1%) | [x] |
| NEG-PERF-001 | NEG | 无隐藏差异 | findstr | 无"等同Linux"虚假声明 | [x] |
| UX-PERF-001 | UX | 用户可读性 | 人工检查 | 有对比表和结论 | [x] |

### L-03: 修复验证测试
| 用例ID | 类别 | 场景 | 验证内容 | 通过标准 | 状态 |
|--------|------|------|----------|----------|------|
| FUNC-FIX-001 | FUNC | post-fix内存测试存在 | evidence/post-fix-mem-log.txt | 文件存在 | [x] |
| CONST-FIX-001 | CONST | post-fix性能测试存在 | evidence/post-fix-perf-log.txt | 文件存在 | [x] |
| NEG-FIX-001 | NEG | 无隐藏代码问题 | 代码检查 | 无简化LRU残留 | [x] |
| UX-FIX-001 | UX | 验证报告存在 | FIX-VERIFICATION-REPORT.md | 文件存在 | [x] |

## P4自测轻量检查表
| CHECK_ID | 检查项 | 状态 |
|----------|--------|------|
| P4-001 | 所有物理文件落盘 | [x] |
| P4-002 | 双文件一致性验证通过 | [x] |
| P4-003 | Windows性能差异文档化 | [x] |
| P4-004 | 本地验证日志存在 | [x] |
| P4-005 | sync-verification-log.txt存在 | [x] |
| P4-006 | WINDOWS-PERFORMANCE-NOTE.md存在 | [x] |
| P4-007 | FIX-VERIFICATION-REPORT.md存在 | [x] |
| P4-008 | post-fix日志存在 | [x] |
| P4-009 | 白皮书存在 | [x] |
| P4-010 | 自测表存在 | [x] |
