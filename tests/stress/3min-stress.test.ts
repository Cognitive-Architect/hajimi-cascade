/**
 * 3min-stress.test.ts - Wave 1: 3分钟压力测试硬化，RSS<30%
 * 
 * 180000ms高频循环，内存泄漏检测，跨分片操作，LRU淘汰压力
 * 质量优先：严谨边界测试，可观测输出，完整诊断报告
 */

import { ShardManager, createTestVectors, VectorEntry } from '../../src/storage/shard-manager';

describe('3min-stress', () => {
  const STRESS_DURATION_MS = 180000; // 3分钟严格时长
  const MAX_GROWTH_PCT = 0.30;       // 30%增长红线（质量优先，严格于50%）

  /**
   * 核心压力测试：180000ms高频操作，每秒RSS采样
   * 
   * 操作混合：单向量添加(25%)、随机查询(25%)、批量添加(25%)、跨分片查询(25%)
   * 验证点：增长<30%，斜率<0.1MB/s，console.table诊断报告
   */
  test('3分钟高频压力 - RSS增长<30%', async () => {
    const manager = new ShardManager({
      shardCount: 10,
      vectorsPerShard: 1000,
      memoryLimitMB: 512,
      startupTimeLimitMs: 2000,
    });

    // 预热：加载1000向量启动分片缓存
    manager.addBatch(createTestVectors(1000, 768));
    manager.startup();

    const rssSamples: number[] = [];
    let opsCount = 0;
    const startTime = Date.now();

    // 180000ms高频操作循环
    for (let elapsed = 0; elapsed < STRESS_DURATION_MS; elapsed = Date.now() - startTime) {
      for (let i = 0; i < 100; i++) {
        const op = opsCount++ % 4;
        if (op === 0) {
          // 单向量添加 - 高频写入压力
          const v = createTestVectors(1, 768)[0];
          v.id = `stress_${opsCount}`;
          manager.addVector(v);
        } else if (op === 1) {
          // 随机查询 - 读压力
          manager.findVector(`vec_${Math.floor(Math.random() * 1000)}`);
        } else if (op === 2) {
          // 批量添加 - 分片切换压力
          manager.addBatch(createTestVectors(10, 768).map((v, j) => ({ ...v, id: `batch_${opsCount}_${j}` })));
        } else {
          // 跨分片查询 - LRU淘汰压力
          manager.findVector(`stress_${Math.floor(Math.random() * Math.max(opsCount, 1))}`);
        }
      }
      // 每秒RSS内存采样
      if (opsCount % 100 === 0) rssSamples.push(process.memoryUsage().rss);
    }

    // 内存增长分析
    const initial = rssSamples[0], final = rssSamples[rssSamples.length - 1];
    const growth = (final - initial) / initial;
    const slope = (final - initial) / rssSamples.length / 1048576;

    // 可观测console.table诊断报告
    console.table({
      durationSec: STRESS_DURATION_MS / 1000,
      totalOps: opsCount,
      initRSS_MB: Math.floor(initial / 1048576),
      finalRSS_MB: Math.floor(final / 1048576),
      growth: `${(growth * 100).toFixed(1)}%`,
      slope_MBps: slope.toFixed(3),
      samples: rssSamples.length,
      status: growth < MAX_GROWTH_PCT ? '✅ PASS' : '❌ FAIL',
    });

    // 严格质量断言
    expect(growth).toBeLessThan(MAX_GROWTH_PCT);
    expect(slope).toBeLessThan(0.1);
  }, 200000);

  /** 边界测试：空向量/不存在ID处理 - 验证不崩溃 */
  test('边界：空向量压力', () => {
    const m = new ShardManager();
    expect(() => m.findVector('')).not.toThrow();
    expect(() => m.findVector('nonexistent')).not.toThrow();
    expect(m.findVector('nonexistent')).toBeUndefined();
  });

  /** 边界测试：10MB超大向量 - 验证正常处理不OOM */
  test('边界：超大向量压力', () => {
    const m = new ShardManager();
    // 10MB = 2,621,440 floats × 4 bytes
    const huge: VectorEntry = { id: 'huge_vec', data: new Float32Array(2_621_440).fill(0.5) };
    expect(() => m.addVector(huge)).not.toThrow();
    expect(m.findVector('huge_vec')).toBeDefined();
  });

  /** 异常测试：强制GC后内存可下降 - 验证无顽固泄漏 */
  test('异常：强制GC响应', async () => {
    if (!global.gc) {
      console.log('⚠️ 跳过：需 --expose-gc 启动Node.js');
      return;
    }
    const m = new ShardManager();
    m.addBatch(createTestVectors(5000, 768));
    const before = process.memoryUsage().rss;
    global.gc();
    await new Promise(r => setTimeout(r, 100));
    expect(process.memoryUsage().rss).toBeLessThanOrEqual(before * 1.05);
  });
});
