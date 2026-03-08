# .ts → .js 逐行功能映射表

## 第1-50行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 1-17 | 文件头注释 | 1-17 | 文件头注释 | ✅ |
| 19-25 | WTinyLFUOptions接口 | - | 移除（JS不需要接口） | ✅ |
| 27-35 | WTinyLFUStats接口 | - | 移除（JS不需要接口） | ✅ |
| 37-38 | Zone类型别名 | - | 移除（JS不需要类型别名） | ✅ |
| 40-50 | Entry接口 | - | 移除（JS不需要接口） | ✅ |
| 55-84 | CountMinSketch类 | 19-48 | CountMinSketch类 | ✅ |

## 第51-100行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 89-145 | LRUList类 | 49-109 | LRUList类 | ✅ |
| 150-195 | WTinyLFUCacheV2类构造函数 | 111-142 | WTinyLFUCacheV2类构造函数 | ✅ |

## 第101-150行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 197-247 | get方法 | 144-194 | get方法 | ✅ |
| 249-297 | put方法 | 196-244 | put方法 | ✅ |

## 第151-200行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 299-317 | promoteFromWindow方法 | 246-264 | promoteFromWindow方法 | ✅ |
| 319-336 | promoteToProtected方法 | 266-283 | promoteToProtected方法 | ✅ |
| 338-351 | demoteFromProtected方法 | 285-298 | demoteFromProtected方法 | ✅ |

## 第201-250行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 353-365 | insertToProbation方法 | 300-312 | insertToProbation方法 | ✅ |
| 367-378 | evictFromWindow方法 | 314-325 | evictFromWindow方法 | ✅ |
| 380-410 | evictFromProbation方法 | 327-357 | evictFromProbation方法 | ✅ |

## 第251-300行
| TS行号 | TS代码 | JS行号 | JS代码 | 功能一致性 |
|--------|--------|--------|--------|------------|
| 412-437 | delete方法 | 359-384 | delete方法 | ✅ |
| 439-449 | clear方法 | 386-397 | clear方法 | ✅ |
| 452-463 | getStats方法 | 399-410 | getStats方法 | ✅ |
| 468-474 | getCapacities方法 | 412-421 | getCapacities方法 | ✅ |
| 476-478 | isScanAttackDetected方法 | 423-425 | isScanAttackDetected方法 | ✅ |
