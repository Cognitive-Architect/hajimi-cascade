🚀 饱和攻击波次：HAJIMI-B-03-FIX-FINAL-REWORK-001 地狱级硬钢返工集群

火力配置： 4 Agent 并行（唐音×2、黄瓜睦×1、咕咕嘎嘎×1）

轰炸目标： 3项P0致命缺失（测试脚本缺失+自测画饼+指标未验证）→ 产出可运行的测试脚本+执行证据+双自测表全绿

---

⚠️ 质量门禁（地狱级红线 - 必须全部满足才能开工）

偷工减料即D级铁律：
- 脚本实体门禁：每个工单必须交付可独立运行的.mjs测试脚本，缺少一个直接判D级
- 自测执行门禁：禁止口头填表，必须提供Node.js实际运行截图/日志（含时间戳）
- 双自测表门禁：必须同时填写《刀刃》风险自测表（大类覆盖）+《P4自测轻量检查表》（细节覆盖）
- 证据链门禁：每个自测表条目必须关联具体测试脚本+行号+输出片段，无法追溯直接判D级
- 诚实指标门禁：延迟指标必须实测（非文档声称），0.8μs必须有1000次采样统计

---

📋 工单矩阵（地狱级副本）

📋 工单 B-01/04 【唐音-地狱】→ TEST-MEM-001 内存泄漏检测脚本硬钢

执行者：唐音（Engineer）

目标：交付可运行的内存泄漏检测脚本，验证100K/1M操作RSS增长<1%，3轮测试方差<0.1%，产出双自测表执行证据

---

🔒 输入基线（精确到符号）

输入项	强制要求	验证命令	
代码文件	`src/storage/w-tinylfu-cache-v2.ts` 必须存在	`ls src/storage/w-tinylfu-cache-v2.ts` 返回0	
类定义	必须导出 `WTinyLFUCache` 类	`grep "export class WTinyLFUCache" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
方法签名	必须包含 `get(key: string): string \| undefined`	`grep -E "get\\(.*key.*string.*\\).*:.*string.*\|.*undefined" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
方法签名	必须包含 `set(key: string, value: string): void`	`grep -E "set\\(.*key.*string.*value.*string.*\\).*:.*void" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
Node版本	必须 Node.js v20.0.0+	`node --version` 返回 v20 或更高	
API可用性	`process.memoryUsage()` 必须可用	`node -e "console.log(process.memoryUsage().rss)"` 返回数字	

---

🎯 输出交付物（精确到文件内容与格式）

交付物 1：测试脚本（强制路径）
文件路径：`scripts/memory-leak-test.mjs`

必须包含的函数与代码结构：

```javascript
// 第1-10行：imports与配置
import { WTinyLFUCache } from '../src/storage/w-tinylfu-cache-v2.js';
const CONFIG = {
  rounds: 3,
  operations: 100000,
  varianceThreshold: 0.001, // 0.1%
  growthThreshold: 0.01     // 1%
};

// 第11-20行：measureRSS函数（必须存在）
function measureRSS() {
  const usage = process.memoryUsage();
  return usage.rss / 1024 / 1024; // 转换为MB
}

// 第21-50行：runMemoryTest函数（必须存在）
async function runMemoryTest(roundNum, ops) {
  const cache = new WTinyLFUCache({ capacity: 10000 });
  const initialRSS = measureRSS();
  let peakRSS = initialRSS;
  
  // 必须执行的操作序列
  for (let i = 0; i < ops; i++) {
    cache.set(`key-${i}`, `value-${i}-`.repeat(100));
    if (i % 1000 === 0) {
      const current = measureRSS();
      if (current > peakRSS) peakRSS = current;
    }
  }
  
  // 必须强制GC（如果可用）
  if (global.gc) global.gc();
  await new Promise(r => setTimeout(r, 1000));
  
  const finalRSS = measureRSS();
  const growth = (finalRSS - initialRSS) / initialRSS;
  
  return { initialRSS, peakRSS, finalRSS, growth };
}

// 第51-80行：主执行逻辑（必须存在）
async function main() {
  const results = [];
  const timestamp = new Date().toISOString();
  
  for (let i = 1; i <= CONFIG.rounds; i++) {
    const result = await runMemoryTest(i, CONFIG.operations);
    results.push(result);
    // 必须实时输出到控制台
    console.log(`[${timestamp}] Round ${i}/${CONFIG.rounds}`);
    console.log(`Initial RSS: ${result.initialRSS.toFixed(2)} MB`);
    console.log(`Peak RSS: ${result.peakRSS.toFixed(2)} MB`);
    console.log(`Final RSS: ${result.finalRSS.toFixed(2)} MB`);
    console.log(`Growth Rate: ${(result.growth * 100).toFixed(2)}%`);
  }
  
  // 方差计算（必须存在）
  const avgGrowth = results.reduce((a,b) => a + b.growth, 0) / results.length;
  const variance = Math.sqrt(results.reduce((sq, n) => sq + Math.pow(n.growth - avgGrowth, 2), 0) / results.length);
  
  // 最终判定（必须输出）
  const passed = avgGrowth < CONFIG.growthThreshold && variance < CONFIG.varianceThreshold;
  console.log(`\n[${timestamp}] Variance: ${(variance * 100).toFixed(4)}%`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  
  return { results, avgGrowth, variance, passed, timestamp };
}

// 必须执行main
main().then(r => process.exit(r.passed ? 0 : 1));
```

交付物 2：执行日志（强制路径与格式）
文件路径：`evidence/mem-test-log.txt`

必须包含的日志格式（正则匹配严格验证）：

```
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Round [1-3]/3$
^Initial RSS: \d+\.\d{2} MB$
^Peak RSS: \d+\.\d{2} MB$
^Final RSS: \d+\.\d{2} MB$
^Growth Rate: \d+\.\d{2}%$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Variance: \d+\.\d{4}%$
^Result: PASS$
```

交付物 3：《刀刃》风险自测表（强制条目）
文件路径：`docs/self-test/blade-risk-b01.md`

必须包含的表格行（不得删减，不得合并）：

测试用例ID	宏观类别	测试场景	测试步骤	预期结果	自测状态	证据行号	
FUNC-MEM-001	1. 核心功能验收	内存监控功能正常	1. 运行脚本2. 检查RSS输出	RSS数值为合理正数（>10MB）	[ ] Pass [ ] Fail	mem-test-log.txt L2	
FUNC-MEM-002	1. 核心功能验收	100K操作执行	1. 运行脚本2. 检查Round完成	3轮全部显示"Round X/3"	[ ] Pass [ ] Fail	mem-test-log.txt L1,L8,L15	
CONST-MEM-001	2. 核心约束回归	无内存泄漏	1. 查看Growth Rate2. 对比阈值	所有Growth Rate < 1.00%	[ ] Pass [ ] Fail	mem-test-log.txt L5,L12,L19	
CONST-MEM-002	2. 核心约束回归	方差稳定性	1. 查看Variance行2. 对比阈值	Variance < 0.1000%	[ ] Pass [ ] Fail	mem-test-log.txt L22	
NEG-MEM-001	3. 负面路径测试	内存爆炸容错	1. 模拟1M操作2. 检查OOM处理	脚本不崩溃，返回FAIL而非抛出	[ ] Pass [ ] Fail	脚本exit code 1	
NEG-MEM-002	3. 负面路径测试	非法容量处理	1. 测试capacity=02. 检查行为	不抛出异常，返回空或报错信息	[ ] Pass [ ] Fail	代码第25行边界检查	
UX-MEM-001	4. 用户体验验收	日志可读性	1. 打开日志文件2. 人工可读性检查	时间戳、数值、单位清晰，无科学计数法	[ ] Pass [ ] Fail	mem-test-log.txt 全文	

交付物 4：《P4自测轻量检查表》（强制勾选）
文件路径：`docs/self-test/p4-checklist-b01.md`

必须填写的检查点（禁止留空，禁止"N/A"）：

检查点ID	自检问题	覆盖情况	相关用例ID	证据文件路径	
CF-001	内存监控功能是否至少有1条CF用例？	[]	FUNC-MEM-001	blade-risk-b01.md L1	
CF-002	100K操作执行是否覆盖？	[]	FUNC-MEM-002	blade-risk-b01.md L2	
RG-001	无内存泄漏约束是否覆盖？	[]	CONST-MEM-001	blade-risk-b01.md L3	
RG-002	方差稳定性约束是否覆盖？	[]	CONST-MEM-002	blade-risk-b01.md L4	
NG-001	内存爆炸场景是否有NG用例？	[]	NEG-MEM-001	blade-risk-b01.md L5	
NG-002	非法输入场景是否有NG用例？	[]	NEG-MEM-002	blade-risk-b01.md L6	
UX-001	日志可读性是否有UX用例？	[]	UX-MEM-001	blade-risk-b01.md L7	
E2E-001	从脚本运行到结果判定是否端到端？	[]	FUNC-MEM-001002	mem-test-log.txt	
HIGH-001	内存泄漏风险是否为High等级？	[]	CONST-MEM-001	风险等级High	
FIELD-001	所有用例是否填写完整字段？	[]	全部	blade-risk-b01.md 全表

⚖️ 验收标准（数值化、可复现）
验收项	验收命令	通过标准	失败标准	
脚本存在	`test -f scripts/memory-leak-test.mjs && echo "EXISTS"`	输出"EXISTS"	无输出或文件不存在	
脚本可运行	`node scripts/memory-leak-test.mjs`	exit code 0	exit code非0或抛出异常	
日志存在	`test -f evidence/mem-test-log.txt && echo "EXISTS"`	输出"EXISTS"	文件不存在	
日志格式	`grep -E "^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z.*Round [1-3]/3$" evidence/mem-test-log.txt \| wc -l`	返回3	返回非3	
RSS增长<1%	`grep "Growth Rate" evidence/mem-test-log.txt \| awk '{print $3}' \| sed 's/%//' \| awk '$1 >= 1.0 {exit 1}'`	exit 0	exit 1（表示有>=1%的值）	
方差<0.1%	`grep "Variance" evidence/mem-test-log.txt \| tail -1 \| awk '{print $2}' \| sed 's/%//' \| awk '$1 >= 0.1 {exit 1}'`	exit 0	exit 1（表示>=0.1%）	
结果PASS	`tail -1 evidence/mem-test-log.txt`	包含"Result: PASS"	包含"Result: FAIL"或不含	
刀刃表完整	`grep -c "^\| FUNC-\| CONST-\| NEG-\| UX-" docs/self-test/blade-risk-b01.md`	返回≥7	返回<7	
P4表勾选	`grep -c "\[x\]" docs/self-test/p4-checklist-b01.md`	返回10	返回<10

🔴 D级红线（一票否决制，无任何商量余地）

触发以下任一条件，立即判D级，视为未交付，自动触发打回，无需审核：
1. 
脚本缺失： scripts/memory-leak-test.mjs  不存在（ test -f  返回假）
2. 
运行失败： node scripts/memory-leak-test.mjs  抛出异常或exit code非0（且非测试失败导致的1）
3. 
日志缺失： evidence/mem-test-log.txt  不存在
4. 
数值不达标：RSS增长≥1.00%（任一轮）或方差≥0.1000%
5. 
结果FAIL：日志最后一行非"Result: PASS"
6. 
表格缺失：《刀刃》表或《P4》表任一文件不存在
7. 
条目缺失：《刀刃》表少于7行用例，或《P4》表少于10个[x]
8. 
证据断层：自测表中的Pass状态无法对应到日志文件的具体行号（如未标注"mem-test-log.txt L5"）

---

📋 工单 B-02/04 【黄瓜睦-地狱】→ TEST-CON-001 并发压力测试脚本硬钢

执行者：黄瓜睦（Architect/并发专家）

目标：交付可运行的并发压力测试脚本，验证1000并发×100操作0数据丢失，SHA256一致性校验通过，TPS≥45K，产出双自测表执行证据

---

🔒 输入基线（精确到符号）

输入项	强制要求	验证命令	
代码文件	`src/storage/w-tinylfu-cache-v2.ts` 必须存在	`ls src/storage/w-tinylfu-cache-v2.ts` 返回0	
类定义	必须导出 `WTinyLFUCache` 类	`grep "export class WTinyLFUCache" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
线程模块	Node.js `worker_threads` 必须可用	`node -e "const {Worker}=require('worker_threads');console.log('OK')"` 输出OK	
加密模块	`crypto.createHash` 必须可用	`node -e "console.log(require('crypto').createHash('sha256').update('test').digest('hex').length)"` 返回64	
CPU核心数	必须≥2（用于并发测试）	`node -e "console.log(require('os').cpus().length)"` 返回≥2	
Node版本	必须 Node.js v20.0.0+	`node --version` 返回 v20 或更高	

---

🎯 输出交付物（精确到文件内容与格式）

交付物 1：测试脚本（强制路径）

文件路径：`scripts/concurrency-stress-test.mjs`

必须包含的函数与代码结构：

```javascript
// 第1-15行：imports与配置
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';
import { WTinyLFUCache } from '../src/storage/w-tinylfu-cache-v2.js';
import os from 'os';

const CONFIG = {
  concurrency: 1000,
  operationsPerThread: 100,
  rounds: 10,
  tpsThreshold: 45000,
  workers: Math.min(1000, os.cpus().length * 2)
};

// 第16-30行：SHA256序列化函数（必须存在）
function serializeCacheState(cache) {
  const entries = [];
  for (const [key, value] of cache.entries()) {
    entries.push(`${key}:${value}`);
  }
  entries.sort();
  return crypto.createHash('sha256').update(entries.join('|')).digest('hex');
}

// 第31-60行：Worker线程逻辑（必须存在）
if (!isMainThread) {
  const { threadId, ops, keys } = workerData;
  const cache = new WTinyLFUCache({ capacity: 10000 });
  
  for (let i = 0; i < ops; i++) {
    const key = keys[i % keys.length];
    const value = `thread-${threadId}-op-${i}`;
    cache.set(key, value);
    cache.get(key);
  }
  
  const state = serializeCacheState(cache);
  parentPort.postMessage({ threadId, state, opsCompleted: ops });
}

// 第61-120行：主线程协调逻辑（必须存在）
async function runConcurrencyTest(roundNum) {
  const startTime = process.hrtime.bigint();
  const sharedKeys = Array.from({length: 100}, (_, i) => `shared-key-${i}`);
  
  const workers = [];
  const results = [];
  
  for (let i = 0; i < CONFIG.workers; i++) {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {
        threadId: i,
        ops: Math.floor(CONFIG.operationsPerThread / CONFIG.workers),
        keys: sharedKeys
      }
    });
    
    workers.push(new Promise((resolve, reject) => {
      worker.on('message', (msg) => {
        results.push(msg);
        resolve(msg);
      });
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker ${i} exited with ${code}`));
      });
    }));
  }
  
  await Promise.all(workers);
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1000000;
  const tps = (CONFIG.operationsPerThread * CONFIG.workers) / (durationMs / 1000);
  
  const dataLoss = results.length !== CONFIG.workers;
  const states = results.map(r => r.state);
  const allSameState = states.every(s => s === states[0]);
  
  return {
    roundNum,
    durationMs,
    tps,
    dataLoss: dataLoss ? 1 : 0,
    consistencyCheck: allSameState,
    workerResults: results.length
  };
}

// 第121-150行：主执行与日志输出（必须存在）
async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Concurrency Stress Test Starting`);
  console.log(`Config: ${CONFIG.concurrency} threads, ${CONFIG.operationsPerThread} ops/thread, ${CONFIG.rounds} rounds`);
  
  const results = [];
  let totalDataLoss = 0;
  
  for (let i = 1; i <= CONFIG.rounds; i++) {
    const result = await runConcurrencyTest(i);
    results.push(result);
    totalDataLoss += result.dataLoss;
    
    console.log(`[${timestamp}] Round ${i}/${CONFIG.rounds}`);
    console.log(`Duration: ${result.durationMs.toFixed(2)} ms`);
    console.log(`TPS: ${Math.floor(result.tps)}`);
    console.log(`Data Loss: ${result.dataLoss}`);
    console.log(`Consistency: ${result.consistencyCheck ? 'PASS' : 'FAIL'}`);
  }
  
  const avgTps = results.reduce((a,b) => a + b.tps, 0) / results.length;
  const passed = totalDataLoss === 0 && avgTps >= CONFIG.tpsThreshold;
  
  console.log(`\n[${timestamp}] Average TPS: ${Math.floor(avgTps)}`);
  console.log(`Total Data Loss Events: ${totalDataLoss}`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  
  return { passed, avgTps, totalDataLoss, timestamp };
}

main().then(r => process.exit(r.passed ? 0 : 1));
```

交付物 2：执行日志（强制路径与格式）

文件路径：`evidence/con-test-log.txt`

必须包含的日志格式（正则匹配严格验证）：

^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Concurrency Stress Test Starting$
^Config: \d+ threads, \d+ ops/thread, \d+ rounds$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Round [1-9]/10$
^Duration: \d+\.\d{2} ms$
^TPS: \d+$
^Data Loss: 0$
^Consistency: PASS$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Average TPS: \d+$
^Total Data Loss Events: 0$
^Result: PASS$

交付物 3：《刀刃》风险自测表（强制条目）
文件路径： docs/self-test/blade-risk-b02.md 
必须包含的表格行（不得删减，不得合并）：

测试用例ID	宏观类别	测试场景	测试步骤	预期结果	自测状态	证据行号	
FUNC-CON-001	1. 核心功能验收	1000并发执行	1. 运行脚本2. 检查Round完成	10轮全部显示"Round X/10"	[ ] Pass [ ] Fail	con-test-log.txt L3,L8...	
FUNC-CON-002	1. 核心功能验收	Worker线程创建	1. 检查Worker启动2. 无崩溃	1000个Worker全部启动无OOM	[ ] Pass [ ] Fail	con-test-log.txt L1	
CONST-CON-001	2. 核心约束回归	0数据丢失	1. 查看Data Loss行2. 对比阈值	所有Round的Data Loss = 0	[ ] Pass [ ] Fail	con-test-log.txt L6,L11...	
CONST-CON-002	2. 核心约束回归	SHA256一致性	1. 查看Consistency行2. 全为PASS	所有Round的Consistency = PASS	[ ] Pass [ ] Fail	con-test-log.txt L7,L12...	
CONST-CON-003	2. 核心约束回归	TPS性能基准	1. 查看Average TPS2. 对比45K阈值	Average TPS ≥ 45000	[ ] Pass [ ] Fail	con-test-log.txt L48	
NEG-CON-001	3. 负面路径测试	竞态条件检测	1. 检查日志无报错2. 无重复插入	无"duplicate key"或"undefined"错误	[ ] Pass [ ] Fail	con-test-log.txt 全文无ERROR	
NEG-CON-002	3. 负面路径测试	Worker异常退出	1. 模拟Worker崩溃2. 检查主线程处理	主线程捕获错误，记录FAIL而非崩溃	[ ] Pass [ ] Fail	代码第85行reject处理	
UX-CON-001	4. 用户体验验收	进度可观测	1. 实时查看日志2. 检查Round进度	每轮测试实时输出进度（非批量后输出）	[ ] Pass [ ] Fail	con-test-log.txt 时间戳间隔

交付物 4：《P4自测轻量检查表》（强制勾选）
文件路径： docs/self-test/p4-checklist-b02.md

必须填写的检查点（禁止留空，禁止"N/A"）：

检查点ID	自检问题	覆盖情况	相关用例ID	证据文件路径	
CF-001	1000并发功能是否至少有1条CF用例？	[ ]	FUNC-CON-001	blade-risk-b02.md L1	
CF-002	Worker创建功能是否覆盖？	[ ]	FUNC-CON-002	blade-risk-b02.md L2	
RG-001	0数据丢失约束是否覆盖？	[ ]	CONST-CON-001	blade-risk-b02.md L3	
RG-002	SHA256一致性约束是否覆盖？	[ ]	CONST-CON-002	blade-risk-b02.md L4	
RG-003	TPS性能约束是否覆盖？	[ ]	CONST-CON-003	blade-risk-b02.md L5	
NG-001	竞态条件场景是否有NG用例？	[ ]	NEG-CON-001	blade-risk-b02.md L6	
NG-002	Worker崩溃场景是否有NG用例？	[ ]	NEG-CON-002	blade-risk-b02.md L7	
UX-001	进度观测是否有UX用例？	[ ]	UX-CON-001	blade-risk-b02.md L8	
E2E-001	从并发执行到一致性判定是否端到端？	[ ]	FUNC-CON-001002	con-test-log.txt	
HIGH-001	数据丢失风险是否为High等级？	[ ]	CONST-CON-001	风险等级High

⚖️ 验收标准（数值化、可复现）

验收项	验收命令	通过标准	失败标准	
脚本存在	`test -f scripts/concurrency-stress-test.mjs && echo "EXISTS"`	输出"EXISTS"	无输出或文件不存在	
脚本可运行	`node scripts/concurrency-stress-test.mjs`	exit code 0	exit code非0或抛出异常	
日志存在	`test -f evidence/con-test-log.txt && echo "EXISTS"`	输出"EXISTS"	文件不存在	
日志格式	`grep -E "^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z.*Round [1-9]/10$" evidence/con-test-log.txt \| wc -l`	返回10	返回非10	
0数据丢失	`grep "Data Loss" evidence/con-test-log.txt \| grep -v "Data Loss: 0" \| wc -l`	返回0	返回>0（表示有非0值）	
一致性PASS	`grep "Consistency" evidence/con-test-log.txt \| grep -v "Consistency: PASS" \| wc -l`	返回0	返回>0（表示有FAIL）	
TPS达标	`grep "Average TPS" evidence/con-test-log.txt \| awk '{print $3}' \| awk '$1 < 45000 {exit 1}'`	exit 0	exit 1（表示<45K）	
结果PASS	`tail -1 evidence/con-test-log.txt`	包含"Result: PASS"	包含"Result: FAIL"或不含	
刀刃表完整	`grep -c "^\| FUNC-\| CONST-\| NEG-\| UX-" docs/self-test/blade-risk-b02.md`	返回≥8	返回<8	
P4表勾选	`grep -c "\[x\]" docs/self-test/p4-checklist-b02.md`	返回10	返回<10


🔴 D级红线（一票否决，无任何商量余地）
触发以下任一条件，立即判D级，视为未交付，自动触发打回，无需审核：
1. 
脚本缺失： scripts/concurrency-stress-test.mjs  不存在（ test -f  返回假）
2. 
运行失败： node scripts/concurrency-stress-test.mjs  抛出异常或exit code非0（且非测试失败导致的1）
3. 
日志缺失： evidence/con-test-log.txt  不存在
4. 
数据丢失：任一轮测试Data Loss ≠ 0
5. 
一致性失败：任一轮测试Consistency ≠ PASS
6. 
TPS不达标：Average TPS < 45000
7. 
表格缺失：《刀刃》表或《P4》表任一文件不存在
8. 
条目缺失：《刀刃》表少于8行用例，或《P4》表少于10个[x]
9. 
证据断层：自测表中的Pass状态无法对应到日志文件的具体行号（如未标注"con-test-log.txt L6"）

---

📋 工单 B-03/04 【唐音-地狱】→ TEST-PERF-001 性能指标实测硬钢

执行者：唐音（Engineer）

目标：交付可运行的性能基准测试脚本，实测延迟0.8μs（非声称），命中率82%，P99<2μs，产出双自测表执行证据，纠正所有性能画饼

---

🔒 输入基线（精确到符号）

输入项	强制要求	验证命令	
代码文件	`src/storage/w-tinylfu-cache-v2.ts` 必须存在	`ls src/storage/w-tinylfu-cache-v2.ts` 返回0	
类定义	必须导出 `WTinyLFUCache` 类	`grep "export class WTinyLFUCache" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
方法签名	必须包含 `get(key: string): string \| undefined`	`grep -E "get\\(.*key.*string.*\\).*:.*string.*\|.*undefined" src/storage/w-tinylfu-cache-v2.ts` 返回非空	
高精度计时	`process.hrtime.bigint()` 必须可用	`node -e "console.log(process.hrtime.bigint())"` 返回数字	
性能历史	ID-166事实面板中0.21μs→0.8μs修正记录	`grep "0.21μs→0.8μs" docs/audit report/15-B-03-FIX-FINAL-AUDIT.md` 返回非空	
Node版本	必须 Node.js v20.0.0+	`node --version` 返回 v20 或更高	

---

🎯 输出交付物（精确到文件内容与格式）

交付物 1：测试脚本（强制路径）

文件路径：`scripts/perf-benchmark.mjs`

必须包含的函数与代码结构：

// 第1-15行：imports与配置
import { WTinyLFUCache } from '../src/storage/w-tinylfu-cache-v2.js';
import { createHash } from 'crypto';

const CONFIG = {
  latencySamples: 1000,
  zipfSize: 10000,
  zipfSkew: 1.01,
  hitRateThreshold: 0.82,
  latencyTarget: 0.8,  // μs
  p99Threshold: 2.0,   // μs
  tolerance: 0.1       // ±0.1μs
};

// 第16-30行：高精度计时函数（必须存在）
function measureLatency(fn) {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  return Number(end - start) / 1000; // 转换为μs
}

// 第31-50行：Zipf分布生成器（必须存在）
function generateZipfSequence(size, skew, count) {
  const weights = [];
  for (let i = 1; i <= size; i++) {
    weights.push(1 / Math.pow(i, skew));
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const probabilities = weights.map(w => w / totalWeight);
  
  const sequence = [];
  for (let i = 0; i < count; i++) {
    let random = Math.random();
    let cumulative = 0;
    for (let j = 0; j < size; j++) {
      cumulative += probabilities[j];
      if (random <= cumulative) {
        sequence.push(j);
        break;
      }
    }
  }
  return sequence;
}

// 第51-90行：延迟基准测试（必须存在）
async function runLatencyBenchmark() {
  const cache = new WTinyLFUCache({ capacity: 10000 });
  const latencies = [];
  
  // 预热
  for (let i = 0; i < 1000; i++) {
    cache.set(`key-${i}`, `value-${i}`);
  }
  
  // 采样
  for (let i = 0; i < CONFIG.latencySamples; i++) {
    const key = `key-${i % 1000}`;
    const latency = measureLatency(() => {
      cache.get(key);
    });
    latencies.push(latency);
  }
  
  // 统计计算
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const max = latencies[latencies.length - 1];
  
  return { avg, p50, p90, p99, max, samples: latencies };
}

// 第91-120行：命中率测试（必须存在）
async function runHitRateTest() {
  const cache = new WTinyLFUCache({ capacity: 1000 });
  const zipfKeys = generateZipfSequence(10000, CONFIG.zipfSkew, 100000);
  
  let hits = 0;
  let misses = 0;
  
  // 填充阶段
  for (let i = 0; i < 5000; i++) {
    cache.set(`key-${zipfKeys[i]}`, `value-${zipfKeys[i]}`);
  }
  
  // 测试阶段
  for (let i = 5000; i < zipfKeys.length; i++) {
    const key = `key-${zipfKeys[i]}`;
    if (cache.get(key) !== undefined) {
      hits++;
    } else {
      misses++;
      cache.set(key, `value-${zipfKeys[i]}`);
    }
  }
  
  const hitRate = hits / (hits + misses);
  return { hitRate, hits, misses, total: hits + misses };
}

// 第121-160行：主执行与日志输出（必须存在）
async function main() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Performance Benchmark Starting`);
  console.log(`Config: ${CONFIG.latencySamples} latency samples, Zipf skew=${CONFIG.zipfSkew}`);
  
  // 延迟测试
  console.log(`\n[${timestamp}] Running Latency Benchmark...`);
  const latencyResult = await runLatencyBenchmark();
  console.log(`Average Latency: ${latencyResult.avg.toFixed(2)} μs`);
  console.log(`P50: ${latencyResult.p50.toFixed(2)} μs`);
  console.log(`P90: ${latencyResult.p90.toFixed(2)} μs`);
  console.log(`P99: ${latencyResult.p99.toFixed(2)} μs`);
  console.log(`Max: ${latencyResult.max.toFixed(2)} μs`);
  
  // 命中率测试
  console.log(`\n[${timestamp}] Running Hit Rate Test...`);
  const hitResult = await runHitRateTest();
  console.log(`Hit Rate: ${(hitResult.hitRate * 100).toFixed(2)}%`);
  console.log(`Hits: ${hitResult.hits}, Misses: ${hitResult.misses}`);
  
  // 诚实化声明（必须包含）
  console.log(`\n[${timestamp}] Honesty Check:`);
  console.log(`Previous Claim: 0.21μs (C级画饼)`);
  console.log(`Current Reality: ${latencyResult.avg.toFixed(2)}μs (A级诚实)`);
  console.log(`Deviation: ${((latencyResult.avg - 0.21) / 0.21 * 100).toFixed(0)}% (explained in docs)`);
  
  // 最终判定
  const latencyPassed = Math.abs(latencyResult.avg - CONFIG.latencyTarget) <= CONFIG.tolerance 
    && latencyResult.p99 <= CONFIG.p99Threshold;
  const hitRatePassed = hitResult.hitRate >= CONFIG.hitRateThreshold;
  const passed = latencyPassed && hitRatePassed;
  
  console.log(`\n[${timestamp}] Latency Check: ${latencyPassed ? 'PASS' : 'FAIL'} (target: ${CONFIG.latencyTarget}±${CONFIG.tolerance}μs)`);
  console.log(`Hit Rate Check: ${hitRatePassed ? 'PASS' : 'FAIL'} (target: ≥${CONFIG.hitRateThreshold * 100}%)`);
  console.log(`Result: ${passed ? 'PASS' : 'FAIL'}`);
  
  return { passed, latencyResult, hitResult, timestamp };
}

main().then(r => process.exit(r.passed ? 0 : 1));

交付物 2：执行日志（强制路径与格式）
文件路径： evidence/perf-test-log.txt 
必须包含的日志格式（正则匹配严格验证）：

^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Performance Benchmark Starting$
^Config: \d+ latency samples, Zipf skew=\d+\.\d+$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Running Latency Benchmark...$
^Average Latency: \d+\.\d{2} μs$
^P50: \d+\.\d{2} μs$
^P90: \d+\.\d{2} μs$
^P99: \d+\.\d{2} μs$
^Max: \d+\.\d{2} μs$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Running Hit Rate Test...$
^Hit Rate: \d+\.\d{2}%$
^Hits: \d+, Misses: \d+$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Honesty Check:$
^Previous Claim: 0\.21μs \(C级画饼\)$
^Current Reality: \d+\.\d{2}μs \(A级诚实\)$
^Deviation: -?\d+% \(explained in docs\)$
^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z Latency Check: PASS \(target: 0\.8±0\.1μs\)$
^Hit Rate Check: PASS \(target: ≥82%\)$
^Result: PASS$

交付物 3：《刀刃》风险自测表（强制条目）
文件路径： docs/self-test/blade-risk-b03.md 
必须包含的表格行（不得删减，不得合并）：

测试用例ID	宏观类别	测试场景	测试步骤	预期结果	自测状态	证据行号	
FUNC-PERF-001	1. 核心功能验收	延迟基准测试	1. 运行脚本2. 检查Latency输出	Average Latency在0.7-0.9μs范围内	[ ] Pass [ ] Fail	perf-test-log.txt L4	
FUNC-PERF-002	1. 核心功能验收	命中率测试	1. 运行脚本2. 检查Hit Rate	Hit Rate ≥ 82.00%	[ ] Pass [ ] Fail	perf-test-log.txt L11	
CONST-PERF-001	2. 核心约束回归	P99延迟约束	1. 查看P99行2. 对比2μs阈值	P99 Latency < 2.00μs	[ ] Pass [ ] Fail	perf-test-log.txt L8	
CONST-PERF-002	2. 核心约束回归	长尾延迟不隐藏	1. 查看Max行2. 确认Max被记录	Max Latency被诚实记录（即使很大）	[ ] Pass [ ] Fail	perf-test-log.txt L9	
NEG-PERF-001	3. 负面路径测试	低容量性能退化	1. 测试capacity=1002. 检查命中率	命中率下降但系统不崩溃	[ ] Pass [ ] Fail	代码第94行边界测试	
NEG-PERF-002	3. 负面路径测试	极端热点访问	1. 同一key连续get 10K次2. 检查延迟稳定性	延迟无指数级增长（无热点退化）	[ ] Pass [ ] Fail	脚本循环逻辑	
UX-PERF-001	4. 用户体验验收	性能报告可读性	1. 查看Honesty Check段2. 确认画饼承认	明确承认C级历史（0.21μs画饼）	[ ] Pass [ ] Fail	perf-test-log.txt L13-L15	
UX-PERF-002	4. 用户体验验收	百分位透明度	1. 查看P50/P90/P992. 确认分布完整	提供完整延迟分布（不隐瞒长尾）	[ ] Pass [ ] Fail	perf-test-log.txt L5-L8

交付物 4：《P4自测轻量检查表》（强制勾选）
文件路径： docs/self-test/p4-checklist-b03.md 
必须填写的检查点（禁止留空，禁止"N/A"）：

检查点ID	自检问题	覆盖情况	相关用例ID	证据文件路径	
CF-001	延迟基准测试是否至少有1条CF用例？	[ ]	FUNC-PERF-001	blade-risk-b03.md L1	
CF-002	命中率测试是否覆盖？	[ ]	FUNC-PERF-002	blade-risk-b03.md L2	
RG-001	P99延迟约束是否覆盖？	[ ]	CONST-PERF-001	blade-risk-b03.md L3	
RG-002	长尾延迟诚实性是否覆盖？	[ ]	CONST-PERF-002	blade-risk-b03.md L4	
NG-001	低容量退化场景是否有NG用例？	[ ]	NEG-PERF-001	blade-risk-b03.md L5	
NG-002	极端热点场景是否有NG用例？	[ ]	NEG-PERF-002	blade-risk-b03.md L6	
UX-001	画饼承认是否有UX用例？	[ ]	UX-PERF-001	blade-risk-b03.md L7	
UX-002	百分位透明度是否有UX用例？	[ ]	UX-PERF-002	blade-risk-b03.md L8	
E2E-001	从延迟测试到命中率是否端到端？	[ ]	FUNC-PERF-001002	perf-test-log.txt	
HIGH-001	性能指标诚实性是否为High等级？	[ ]	UX-PERF-001	风险等级High

⚖️ 验收标准（数值化、可复现）
验收项	验收命令	通过标准	失败标准	
脚本存在	`test -f scripts/perf-benchmark.mjs && echo "EXISTS"`	输出"EXISTS"	无输出或文件不存在	
脚本可运行	`node scripts/perf-benchmark.mjs`	exit code 0	exit code非0或抛出异常	
日志存在	`test -f evidence/perf-test-log.txt && echo "EXISTS"`	输出"EXISTS"	文件不存在	
延迟达标	`grep "Average Latency" evidence/perf-test-log.txt \| awk '{print $3}' \| awk '$1 < 0.7 \|\| $1 > 0.9 {exit 1}'`	exit 0	exit 1（表示超出0.7-0.9μs范围）	
P99达标	`grep "P99" evidence/perf-test-log.txt \| awk '{print $2}' \| awk '$1 >= 2.0 {exit 1}'`	exit 0	exit 1（表示≥2.0μs）	
命中率达标	`grep "Hit Rate" evidence/perf-test-log.txt \| awk '{print $2}' \| sed 's/%//' \| awk '$1 < 82.00 {exit 1}'`	exit 0	exit 1（表示<82%）	
诚实声明	`grep "C级画饼" evidence/perf-test-log.txt \| wc -l`	返回≥1	返回0（未承认历史）	
结果PASS	`tail -1 evidence/perf-test-log.txt`	包含"Result: PASS"	包含"Result: FAIL"或不含	
刀刃表完整	`grep -c "^\| FUNC-\| CONST-\| NEG-\| UX-" docs/self-test/blade-risk-b03.md`	返回≥8	返回<8	
P4表勾选	`grep -c "\[x\]" docs/self-test/p4-checklist-b03.md`	返回10	返回<10


🔴 D级红线（一票否决，无任何商量余地）
触发以下任一条件，立即判D级，视为未交付，自动触发打回，无需审核：
1. 
脚本缺失： scripts/perf-benchmark.mjs  不存在（ test -f  返回假）
2. 
运行失败： node scripts/perf-benchmark.mjs  抛出异常或exit code非0（且非测试失败导致的1）
3. 
日志缺失： evidence/perf-test-log.txt  不存在
4. 
延迟画饼：Average Latency 超出 0.7-0.9μs 范围（即偏离0.8μs±0.1μs）
5. 
P99超标：P99 Latency ≥ 2.0μs
6. 
命中率不足：Hit Rate < 82.00%
7. 
不诚实：日志中未包含"C级画饼"承认历史声明
8. 
表格缺失：《刀刃》表或《P4》表任一文件不存在
9. 
条目缺失：《刀刃》表少于8行用例，或《P4》表少于10个[x]
10. 
证据断层：自测表中的Pass状态无法对应到日志文件的具体行号（如未标注"perf-test-log.txt L4"）


---

工单 B-04/04 【咕咕嘎嘎-地狱】→ 自测执行与 40 项全绿验证

目标：整合 B-01/B-02/B-03 测试脚本的实际执行输出，完成 40 项自测全部标记 ✅，产出双自测表完整填写版 + 证据链归档

---

输入基线（精确到符号）

输入项	强制要求	验证命令	
B-01 交付物	`scripts/memory-leak-test.mjs` 必须存在且 exit 0	`ls scripts/memory-leak-test.mjs && node scripts/memory-leak-test.mjs`	
B-02 交付物	`scripts/concurrency-stress-test.mjs` 必须存在且 exit 0	`ls scripts/concurrency-stress-test.mjs && node scripts/concurrency-stress-test.mjs`	
B-03 交付物	`scripts/perf-benchmark.mjs` 必须存在且 exit 0	`ls scripts/perf-benchmark.mjs && node scripts/perf-benchmark.mjs`	
证据日志	`evidence/mem-test-log.txt` 必须含时间戳 + RSS 数据	`grep -E "^\d{4}-\d{2}-\d{2}T.*RSS:" evidence/mem-test-log.txt`	
证据日志	`evidence/con-test-log.txt` 必须含 "Data loss: 0"	`grep "Data loss: 0" evidence/con-test-log.txt`	
证据日志	`evidence/perf-test-log.txt` 必须含 "Average Latency: 0.8"	`grep -E "Average Latency: 0\.[7-9]" evidence/perf-test-log.txt`	
自测表 V1	`B-03-FIX-FINAL-自测表-v1.0.md` 必须存在且 40 项全部为 ⬜	`grep -c "⬜" B-03-FIX-FINAL-自测表-v1.0.md` 返回 40	
SLRU 代码	`src/storage/w-tinylfu-cache-v2.ts` 必须导出 `WTinyLFUCache` 类	`grep "export class WTinyLFUCache" src/storage/w-tinylfu-cache-v2.ts`	

---

输出交付物（4 项，路径锁定）

1. `B-03-FIX-FINAL-自测表-v2.0-EXECUTED.md`（40 项全绿版）
- 格式：Markdown 表格，40 行，每行必须标记 `[x]`（非 `[ ]` 或 `⬜`）
- 必须包含列：CHECK_ID | CATEGORY | 检查项 | 验证方法 | 实际结果 | 证据指针 | 状态
- 证据指针格式：`scripts/xxx.mjs:行号` 或 `evidence/xxx.txt:时间戳`
- 顶部必须包含诚实声明头：
  
```markdown
  > ⚠️ 诚实声明：本表 40 项全部基于实际执行的测试脚本（B-01/B-02/B-03），
  > 无口头填表，无画饼，可复现。执行时间：$(date -Iseconds)
  ```

2. `docs/self-test/blade-risk-b04.md`（刀刃风险自测表-整合版）
- 强制 8 行用例（FUNC×2, CONST×2, NEG×2, UX×2）
- 每行必须关联 B-01/B-02/B-03 的具体测试项
- 结构：
  
```markdown
  | 用例ID | 类别 | 场景描述 | 验证脚本 | 通过标准 | 状态 |
  |--------|------|----------|----------|----------|------|
  | FUNC-INT-001 | FUNC | 内存监控功能 | memory-leak-test.mjs | RSS<1% | [ ] |
  | FUNC-INT-002 | FUNC | 并发一致性 | concurrency-stress-test.mjs | Data loss=0 | [ ] |
  | CONST-INT-001 | CONST | 无内存泄漏约束 | memory-leak-test.mjs | 3轮方差<0.1% | [ ] |
  | CONST-INT-002 | CONST | 延迟约束 | perf-benchmark.mjs | P99<2μs | [ ] |
  | NEG-INT-001 | NEG | 内存爆炸容错 | memory-leak-test.mjs:78 | 1M无OOM | [ ] |
  | NEG-INT-002 | NEG | 并发冲突容错 | concurrency-stress-test.mjs:92 | 无竞态报错 | [ ] |
  | UX-INT-001 | UX | 性能可观测 | perf-benchmark.mjs | 输出histogram | [ ] |
  | UX-INT-002 | UX | 日志完整性 | all scripts | 时间戳+结果完整 | [ ] |
  ```

3. `docs/self-test/p4-checklist-b04.md`（P4 自测轻量检查表-整合版）
- 强制 10 项检查点（CF/RG/NG/UX/E2E/High/完整性/映射/执行/边界）
- 覆盖情况列必须留空 `[ ]`，由执行者根据 B-01/B-02/B-03 实际执行结果勾选
- 必须包含列：检查点 | 自检问题 | 覆盖情况 | 相关用例ID | 备注
- 相关用例 ID 必须填写 blade-risk-b04.md 中的对应 ID（如 FUNC-INT-001）

4. `evidence/self-test-evidence/`（证据目录）
- 必须包含 3 个截图文件：
  - `mem-test-run.png`：memory-leak-test.mjs 运行终端截图（含时间戳）
  - `con-test-run.png`：concurrency-stress-test.mjs 运行终端截图
  - `perf-test-run.png`：perf-benchmark.mjs 运行终端截图
- 必须包含 1 个汇总文件：
  - `execution-summary.json`：
    
```json
    {
      "timestamp": "2026-02-25Txx:xx:xx",
      "total_checks": 40,
      "passed": 40,
      "failed": 0,
      "scripts_verified": ["memory-leak-test.mjs", "concurrency-stress-test.mjs", "perf-benchmark.mjs"],
      "integrity_hash": "sha256:xxx"
    }
    ```

---

自测硬性标准（必须全部通过）

标准项	验收命令	通过标准	失败标准	
40 项全绿	`grep -c "\[x\]" B-03-FIX-FINAL-自测表-v2.0-EXECUTED.md`	返回 40	返回 <40	
证据链完整	`grep -E "scripts/.*\.mjs:[0-9]+" B-03-FIX-FINAL-自测表-v2.0-EXECUTED.md \| wc -l`	返回 ≥40	返回 <40	
脚本一致性	`cat evidence/execution-summary.json \| jq '.scripts_verified \| length'`	返回 3	返回 <3	
时间戳真实性	`grep -E "2026-02-2[5-6]T" evidence/-test-log.txt \| wc -l`	返回 ≥3	返回 0	
数值交叉验证	B-04 表中的 RSS 值与 B-01 日志偏差	<0.1%	≥0.1%	
刀刃表覆盖	`grep -c "FUNC-INT\|CONST-INT\|NEG-INT\|UX-INT" docs/self-test/blade-risk-b04.md`	返回 8	返回 <8	
P4 表完整	`grep -c "^\| \[ \] \|" docs/self-test/p4-checklist-b04.md`	返回 10（待填）	返回 <10	
诚实声明	`head -5 B-03-FIX-FINAL-自测表-v2.0-EXECUTED.md \| grep "诚实声明"`	非空	空	

---

D 级红线（10 项一票否决）

触发以下任一条件，立即判 D 级，全集群返工：

1. 脚本缺失：B-01/B-02/B-03 任一脚本不存在或 `node` 执行报错
2. 口头填表：40 项自测表标记 `[x]` 但无法提供 `evidence/` 中的对应日志片段
3. 数值矛盾：B-04 表中声称的 RSS/延迟/TPS 与 B-01/B-02/B-03 日志偏差 >10%
4. 时间戳伪造：`evidence/` 中的时间戳早于当前时间或格式错误（非 ISO8601）
5. 证据断层：自测表条目无法追溯到具体脚本行号（如 `memory-leak-test.mjs:45`）
6. 双表缺失：未交付 `blade-risk-b04.md` 或 `p4-checklist-b04.md`
7. 刀刃表缺类：FUNC/CONST/NEG/UX 四大类任一类缺失
8. P4 预填勾选：`p4-checklist-b04.md` 中覆盖情况列已预填 `[x]`（必须由执行者现场勾选）
9. JSON 损坏：`execution-summary.json` 无法被 `jq` 解析或字段缺失
10. 诚实声明缺失：自测表顶部无"无口头填表"诚实声明

---

📦 收卷强制交付物（2份）

1. 《B-03-FIX-FINAL-REWORK-地狱白皮书-v1.0.md》
  
2. 《B-03-FIX-FINAL-REWORK-双自测表-v1.0.md》
  

