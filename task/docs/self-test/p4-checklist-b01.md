# B-01 P4自测轻量检查表 - 内存泄漏检测

> 执行时间: 2026-02-25T03:22:13Z
> 执行者: 唐音

## 检查点清单

| 检查点ID | 自检问题 | 覆盖情况 | 相关用例ID | 证据文件路径 |
|----------|----------|----------|------------|--------------|
| CF-001 | 内存监控功能是否至少有1条CF用例？ | [x] | FUNC-MEM-001 | blade-risk-b01.md L1 |
| CF-002 | 100K操作执行是否覆盖？ | [x] | FUNC-MEM-002 | blade-risk-b01.md L2 |
| RG-001 | 无内存泄漏约束是否覆盖？ | [x] | CONST-MEM-001 | blade-risk-b01.md L3 |
| RG-002 | 方差稳定性约束是否覆盖？ | [x] | CONST-MEM-002 | blade-risk-b01.md L4 |
| NG-001 | 内存爆炸场景是否有NG用例？ | [x] | NEG-MEM-001 | blade-risk-b01.md L5 |
| NG-002 | 非法输入场景是否有NG用例？ | [x] | NEG-MEM-002 | blade-risk-b01.md L6 |
| UX-001 | 日志可读性是否有UX用例？ | [x] | UX-MEM-001 | blade-risk-b01.md L7 |
| E2E-001 | 从脚本运行到结果判定是否端到端？ | [x] | FUNC-MEM-001002 | mem-test-log.txt |
| HIGH-001 | 内存泄漏风险是否为High等级？ | [x] | CONST-MEM-001 | 风险等级High |
| FIELD-001 | 所有用例是否填写完整字段？ | [x] | 全部 | blade-risk-b01.md 全表 |

## 统计

- **总检查点**: 10
- **已勾选**: 10
- **覆盖率**: 100%

## 验收命令验证

```bash
# 脚本存在
test -f scripts/memory-leak-test.mjs && echo "EXISTS"
# 输出: EXISTS

# 脚本可运行
node --expose-gc scripts/memory-leak-test.mjs
# exit code: 0

# 日志存在
test -f evidence/mem-test-log.txt && echo "EXISTS"
# 输出: EXISTS

# 日志格式验证
grep -E "^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z.*Round [1-3]/3$" evidence/mem-test-log.txt | wc -l
# 输出: 3

# RSS增长<1%
grep "Growth Rate" evidence/mem-test-log.txt | awk '{print $3}' | sed 's/%//' | awk '$1 >= 1.0 {exit 1}'
# exit: 0

# 方差<0.1%
grep "Variance" evidence/mem-test-log.txt | tail -1 | awk '{print $2}' | sed 's/%//' | awk '$1 >= 0.1 {exit 1}'
# exit: 0

# 结果PASS
tail -1 evidence/mem-test-log.txt
# 包含: Result: PASS
```
