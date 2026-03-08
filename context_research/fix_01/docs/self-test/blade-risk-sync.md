| 用例ID | 类别 | 场景 | 验证命令 | 通过标准 | 状态 |
|--------|------|------|----------|----------|------|
| FUNC-SYNC-001 | FUNC | 双文件类定义一致 | node -e "require('./src/storage/w-tinylfu-cache-v2.js')" | Exit 0 | [x] |
| CONST-SYNC-001 | CONST | package.json指向有效 | node -e "require('./src/storage/w-tinylfu-cache-v2.js')" | Exit 0 | [x] |
| NEG-SYNC-001 | NEG | 无简化LRU残留 | findstr /C:"LRU" src\storage\w-tinylfu-cache-v2.js | 无结果（证明是SLRU） | [x] |
| UX-SYNC-001 | UX | 文件大小一致 | dir src\storage\w-tinylfu-cache-v2.* | 差异<5% | [x] |
