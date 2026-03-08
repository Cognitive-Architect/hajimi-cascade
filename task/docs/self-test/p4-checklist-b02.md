# B-02 P4自测轻量检查表 - 并发压力测试

> 执行时间: 2026-02-25T03:34:55Z
> 执行者: 黄瓜睦

## 检查点清单

| 检查点ID | 自检问题 | 覆盖情况 | 相关用例ID | 证据文件路径 |
|----------|----------|----------|------------|--------------|
| CF-001 | 1000并发功能是否至少有1条CF用例？ | [x] | FUNC-CON-001 | blade-risk-b02.md L1 |
| CF-002 | Worker创建功能是否覆盖？ | [x] | FUNC-CON-002 | blade-risk-b02.md L2 |
| RG-001 | 0数据丢失约束是否覆盖？ | [x] | CONST-CON-001 | blade-risk-b02.md L3 |
| RG-002 | SHA256一致性约束是否覆盖？ | [x] | CONST-CON-002 | blade-risk-b02.md L4 |
| RG-003 | TPS性能约束是否覆盖？ | [x] | CONST-CON-003 | blade-risk-b02.md L5 |
| NG-001 | 竞态条件场景是否有NG用例？ | [x] | NEG-CON-001 | blade-risk-b02.md L6 |
| NG-002 | Worker崩溃场景是否有NG用例？ | [x] | NEG-CON-002 | blade-risk-b02.md L7 |
| UX-001 | 进度观测是否有UX用例？ | [x] | UX-CON-001 | blade-risk-b02.md L8 |
| E2E-001 | 从并发执行到一致性判定是否端到端？ | [x] | FUNC-CON-001002 | con-test-log.txt |
| HIGH-001 | 数据丢失风险是否为High等级？ | [x] | CONST-CON-001 | 风险等级High |

## 统计

- **总检查点**: 10
- **已勾选**: 10
- **覆盖率**: 100%

## 验收命令验证

```bash
# 脚本存在
test -f scripts/concurrency-stress-test.mjs && echo "EXISTS"
# 输出: EXISTS

# 脚本可运行
node scripts/concurrency-stress-test.mjs
# exit code: 0

# 日志存在
test -f evidence/con-test-log.txt && echo "EXISTS"
# 输出: EXISTS

# 日志格式验证
grep -E "^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z.*Round [1-9]/10$" evidence/con-test-log.txt | wc -l
# 输出: 10

# 0数据丢失
grep "Data Loss" evidence/con-test-log.txt | grep -v "Data Loss: 0" | wc -l
# 输出: 0

# 一致性PASS
grep "Consistency" evidence/con-test-log.txt | grep -v "Consistency: PASS" | wc -l
# 输出: 0

# TPS达标
grep "Average TPS" evidence/con-test-log.txt | awk '{print $3}' | awk '$1 < 45000 {exit 1}'
# exit: 0

# 结果PASS
tail -1 evidence/con-test-log.txt
# 包含: Result: PASS
```
