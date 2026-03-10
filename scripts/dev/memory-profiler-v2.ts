/**
 * memory-profiler-v2.ts - B-02: Pool内存监控 (≤120行)
 */

import { getGlobalPool } from '../../src/utils/buffer-pool';

interface Sample { t: number; rss: number; heap: number; poolT: number; poolU: number; }

export class MemoryProfilerV2 {
  private samples: Sample[] = [];
  private interval?: NodeJS.Timeout;

  start(intervalMs = 1000): void {
    this.samples = [];
    this.interval = setInterval(() => {
      const m = process.memoryUsage();
      const p = getGlobalPool().getStats();
      this.samples.push({ t: Date.now(), rss: m.rss, heap: m.heapUsed, poolT: p.total, poolU: p.inUse });
    }, intervalMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    const rss = this.samples.map(s => s.rss);
    const [start, end, peak, min] = [rss[0], rss[rss.length - 1], Math.max(...rss), Math.min(...rss)];
    return {
      duration: this.samples[this.samples.length - 1].t - this.samples[0].t,
      rssStart: start, rssEnd: end, rssPeak: peak,
      fluctuation: ((peak - min) / start) * 100,
    };
  }

  report(): string {
    const r = this.stop();
    return `RSS: ${(r.rssStart / 1048576).toFixed(1)}MB → ${(r.rssEnd / 1048576).toFixed(1)}MB\nFluctuation: ${r.fluctuation.toFixed(2)}% ${r.fluctuation < 10 ? '✅' : '❌'}`;
  }

  static async runStress(durationMs = 180000) {
    const p = new MemoryProfilerV2(), pool = getGlobalPool();
    p.start(1000);
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      const bufs = Array.from({ length: 100 }, () => pool.acquire());
      bufs.forEach(b => b.fill(0));
      bufs.forEach(b => pool.release(b));
    }
    console.log(p.report());
  }
}

export default MemoryProfilerV2;
if (require.main === module) MemoryProfilerV2.runStress();
