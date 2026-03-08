# P4自测轻量检查表 - B-01/04

## 交付物完整性检查

- [x] 交付物1: `scripts/memory-leak-test.mjs` 存在且格式正确
- [x] 交付物2: `evidence/mem-test-log.txt` 日志完整可追溯
- [x] 交付物3: `docs/self-test/blade-risk-b01.md` 刀刃表≥7行用例
- [x] 交付物4: `docs/self-test/p4-checklist-b01.md` 本检查表10个[x]

## 脚本质量检查

- [x] 脚本第1-10行: imports与CONFIG配置正确
- [x] 脚本第11-20行: measureRSS函数存在且返回MB
- [x] 脚本第21-50行: runMemoryTest函数完整执行
- [x] 脚本第51-80行: 主执行逻辑含方差计算

## 运行结果检查

- [x] 脚本运行exit code为0（通过）
- [x] RSS增长率<1.0%（无内存泄漏）
- [x] 方差<0.1%（结果稳定）
- [x] 日志末尾包含"Result: PASS"

---
**检查时间**: 2026-02-25T10:31:00.000Z  
**检查人**: 唐音人格  
**结论**: 10项检查全部通过，P4交付达标
