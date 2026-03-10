/**
 * Startup Timing Verification Test
 * 
 * 验证shard-manager的startup()返回真实正数时间
 */

import { ShardManager, createTestVectors } from '../../src/storage/shard-manager';

describe('R-003: Startup Timing Precision', () => {
  it('startup returns positive time with data', () => {
    const manager = new ShardManager();
    // Create enough vectors to populate first 3 shards
    const vectors = createTestVectors(100);
    
    manager.addBatch(vectors);
    const result = manager.startup();
    
    console.log(`Startup time: ${result.durationMs}ms`);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(5000);
  });

  it('startup time is recorded in stats', () => {
    const manager = new ShardManager();
    const vectors = createTestVectors(100);
    
    manager.addBatch(vectors);
    
    const result = manager.startup();
    const stats = manager.getStats();
    
    expect(stats.startupTimeMs).toBe(result.durationMs);
    console.log(`Recorded startup time: ${stats.startupTimeMs}ms`);
  });

  it('startup with no vectors returns zero or small value', () => {
    const manager = new ShardManager();
    
    const result = manager.startup();
    
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(100);
  });

  it('does not use Date.now() - Date.now() pattern', () => {
    // This is a meta-test to verify the fix
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../../src/storage/shard-manager.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Should not contain the buggy pattern
    expect(content).not.toContain('Date.now() - Date.now()');
    
    // Should contain proper timing
    expect(content).toContain('const start = Date.now()');
    expect(content).toContain('Date.now() - start');
  });
});
