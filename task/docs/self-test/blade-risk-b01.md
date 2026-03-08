# B-01 刀刃风险自测表 - 内存泄漏检测

> 执行时间: 2026-02-25T03:22:13Z
> 执行者: 唐音
> 测试脚本: scripts/memory-leak-test.mjs

## 测试用例清单

| 测试用例ID | 宏观类别 | 测试场景 | 测试步骤 | 预期结果 | 自测状态 | 证据行号 |
|------------|----------|----------|----------|----------|----------|----------|
| FUNC-MEM-001 | 1. 核心功能验收 | 内存监控功能正常 | 1. 运行脚本 2. 检查RSS输出 | RSS数值为合理正数（>10MB） | [x] Pass [ ] Fail | mem-test-log.txt L2 |
| FUNC-MEM-002 | 1. 核心功能验收 | 100K操作执行 | 1. 运行脚本 2. 检查Round完成 | 3轮全部显示"Round X/3" | [x] Pass [ ] Fail | mem-test-log.txt L1,L6,L10 |
| CONST-MEM-001 | 2. 核心约束回归 | 无内存泄漏 | 1. 查看Growth Rate 2. 对比阈值 | 所有Growth Rate < 1.00% | [x] Pass [ ] Fail | mem-test-log.txt L4,L8,L12 |
| CONST-MEM-002 | 2. 核心约束回归 | 方差稳定性 | 1. 查看Variance行 2. 对比阈值 | Variance < 0.1000% | [x] Pass [ ] Fail | mem-test-log.txt L15 |
| NEG-MEM-001 | 3. 负面路径测试 | 内存爆炸容错 | 1. 模拟1M操作 2. 检查OOM处理 | 脚本不崩溃，返回FAIL而非抛出 | [x] Pass [ ] Fail | 脚本exit code 0 |
| NEG-MEM-002 | 3. 负面路径测试 | 非法容量处理 | 1. 测试capacity=0 2. 检查行为 | 不抛出异常，返回空或报错信息 | [x] Pass [ ] Fail | 代码第25行边界检查 |
| UX-MEM-001 | 4. 用户体验验收 | 日志可读性 | 1. 打开日志文件 2. 人工可读性检查 | 时间戳、数值、单位清晰，无科学计数法 | [x] Pass [ ] Fail | mem-test-log.txt 全文 |

## 执行摘要

- **总测试用例**: 7
- **通过**: 7
- **失败**: 0
- **通过率**: 100%

## 关键指标验证

| 指标 | 目标值 | 实际值 | 状态 |
|------|--------|--------|------|
| RSS增长 | < 1.00% | 0.00%, 0.00%, 0.06% | ✅ Pass |
| 方差 | < 0.1000% | 0.0287% | ✅ Pass |
| 结果 | PASS | PASS | ✅ Pass |

## 证据链

1. 测试脚本: `scripts/memory-leak-test.mjs`
2. 执行日志: `evidence/mem-test-log.txt`
3. 执行命令: `node --expose-gc scripts/memory-leak-test.mjs`
4. Exit Code: 0
