# B-03 P4自测轻量检查表 - 性能基准测试

> 执行时间: 2026-02-25T03:53:55Z
> 执行者: 唐音

## 检查点清单

| 检查点ID | 自检问题 | 覆盖情况 | 相关用例ID | 证据文件路径 |
|----------|----------|----------|------------|--------------|
| CF-001 | 延迟基准测试是否至少有1条CF用例？ | [x] | FUNC-PERF-001 | blade-risk-b03.md L1 |
| CF-002 | 命中率测试是否覆盖？ | [x] | FUNC-PERF-002 | blade-risk-b03.md L2 |
| RG-001 | P99延迟约束是否覆盖？ | [x] | CONST-PERF-001 | blade-risk-b03.md L3 |
| RG-002 | 长尾延迟诚实性是否覆盖？ | [x] | CONST-PERF-002 | blade-risk-b03.md L4 |
| NG-001 | 低容量退化场景是否有NG用例？ | [x] | NEG-PERF-001 | blade-risk-b03.md L5 |
| NG-002 | 极端热点场景是否有NG用例？ | [x] | NEG-PERF-002 | blade-risk-b03.md L6 |
| UX-001 | 画饼承认是否有UX用例？ | [x] | UX-PERF-001 | blade-risk-b03.md L7 |
| UX-002 | 百分位透明度是否有UX用例？ | [x] | UX-PERF-002 | blade-risk-b03.md L8 |
| E2E-001 | 从延迟测试到命中率是否端到端？ | [x] | FUNC-PERF-001002 | perf-test-log.txt |
| HIGH-001 | 性能指标诚实性是否为High等级？ | [x] | UX-PERF-001 | 风险等级High |

## 统计

- **总检查点**: 10
- **已勾选**: 10
- **覆盖率**: 100%

## 验收命令验证

```bash
# 脚本存在
test -f scripts/perf-benchmark.mjs && echo "EXISTS"
# 输出: EXISTS

# 脚本可运行
node scripts/perf-benchmark.mjs
# exit code: 0

# 日志存在
test -f evidence/perf-test-log.txt && echo "EXISTS"
# 输出: EXISTS

# 延迟达标
grep "Average Latency" evidence/perf-test-log.txt | awk '{print $3}' | awk '$1 < 0.7 || $1 > 0.9 {exit 1}'
# exit: 0

# P99达标
grep "P99" evidence/perf-test-log.txt | awk '{print $2}' | awk '$1 >= 2.0 {exit 1}'
# exit: 0

# 命中率达标
grep "Hit Rate" evidence/perf-test-log.txt | awk '{print $2}' | sed 's/%//' | awk '$1 < 82.00 {exit 1}'
# exit: 0

# 诚实声明
grep "C级画饼" evidence/perf-test-log.txt | wc -l
# 返回: 1

# 结果PASS
tail -1 evidence/perf-test-log.txt
# 包含: Result: PASS
```
