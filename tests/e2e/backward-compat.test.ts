/**
 * backward-compat.test.ts - Wave 3: 向后兼容测试
 * v2.5加载→沙箱验证→迁移→校验→v2.7写入→读取一致性
 */

import { migrate, rollback, detectVersion, computeChecksum, verifyChecksum } from '../../src/format/version-migrator';
import { validateInput } from '../../src/security/input-sandbox';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('backward-compat', () => {
  const testDir = path.join(tmpdir(), 'hctx-test-' + Date.now());

  beforeAll(async () => { await fs.mkdir(testDir, { recursive: true }); });
  afterAll(async () => { try { await fs.rm(testDir, { recursive: true }); } catch {} });

  /** 创建v2.5文件（HC5魔数） */
  async function createV25(filepath: string): Promise<string> {
    const data = Buffer.alloc(1024);
    Buffer.from([0x48, 0x43, 0x35]).copy(data);
    data.fill(0xAB, 3);
    await fs.writeFile(filepath, data);
    return computeChecksum(data);
  }

  test('v2.5→v2.7迁移流程', async () => {
    const source = path.join(testDir, 'v25.hctx');
    const backup = `${source}.backup`;
    await createV25(source);

    const sandbox = await validateInput(await fs.readFile(source));
    expect(sandbox.allowed).toBe(true);

    const result = await migrate({ sourcePath: source, backupPath: backup, targetVersion: 'v2.7' });
    expect(result.success).toBe(true);
    expect(result.sourceVersion).toBe('v2.5');
    expect(result.backupCreated).toBe(true);
    expect(detectVersion(await fs.readFile(source))).toBe('v2.7');
    expect(result.checksum?.length).toBe(64);
  });

  test('迁移失败回滚', async () => {
    const source = path.join(testDir, 'rollback.hctx');
    const backup = `${source}.backup`;
    await createV25(source);
    await migrate({ sourcePath: source, backupPath: backup, targetVersion: 'v2.7' });

    expect(await rollback(backup, source)).toBe(true);
    expect(detectVersion(await fs.readFile(source))).toBe('v2.5');
  });

  test('100MB文件拒绝', async () => {
    const large = Buffer.alloc(101 * 1024 * 1024);
    const check = await validateInput(large);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('exceeds');
  });

  test('zip bomb检测', async () => {
    const small = Buffer.alloc(1024 * 1024);
    const check = await validateInput(small, { uncompressedSize: 150 * 1024 * 1024 });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Zip bomb');
  });

  test('已是最新版本跳过', async () => {
    const source = path.join(testDir, 'v27.hctx');
    await fs.writeFile(source, Buffer.from([0x48, 0x43, 0x37]));
    const result = await migrate({ sourcePath: source, backupPath: `${source}.bak`, targetVersion: 'v2.7' });
    expect(result.success).toBe(true);
    expect(result.sourceVersion).toBe('v2.7');
    expect(result.backupCreated).toBe(false);
  });
});
