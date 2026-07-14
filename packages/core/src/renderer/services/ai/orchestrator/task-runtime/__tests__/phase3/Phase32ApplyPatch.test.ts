import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../../../ToolRegistry';
import { V2RuntimeFeatureFlag } from '../../domain/V2RuntimeFeatureFlag';

class MockFSAdapter {
  private files = new Map<string, string>();
  async write(path: string, content: string) { this.files.set(path, content); }
  async read(path: string) { return this.files.get(path) ?? null; }
  async stat(path: string) { return this.files.has(path) ? { size: this.files.get(path)!.length } : null; }
  async hash(path: string) { return this.files.has(path) ? 'hash-' + this.files.get(path)!.length : null; }
}

describe('Phase 3.2: apply_patch validation', () => {
  beforeAll(() => { 
    V2RuntimeFeatureFlag.setMode('V2_ONLY'); 
    (global as any).window = { electronAPI: { llmAddLog: () => {}, executeTerminal: () => {} } };
  });
  afterAll(() => { V2RuntimeFeatureFlag.setMode('LEGACY_ONLY'); });

  it('should reject patch if sourceRevision does not match currentRevision', async () => {
    const fs = new MockFSAdapter() as any;
    const registry = new ToolRegistry(fs);
    await registry.registerDefaultTools();

    const result = await registry.executeTool('apply_patch', {
      targetPath: 'test.txt',
      sourceRevision: 1,
    }, {
      currentRevision: 2,
      missionId: 'm1', taskId: 't1', attemptId: 'a1'
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('STALE: sourceRevision does not match current artifact revision.'));
  });

  it('should detect AMBIGUOUS_REPAIR_TARGET if targetSection is found multiple times', async () => {
    const fs = new MockFSAdapter() as any;
    await fs.write('test.txt', 'hello\nhello\nworld');
    const registry = new ToolRegistry(fs);
    await registry.registerDefaultTools();

    const result = await registry.executeTool('apply_patch', {
      targetPath: 'test.txt',
      targetSection: 'hello',
      replacement: 'hi'
    }, {
      currentRevision: 1,
      missionId: 'm1', taskId: 't1', attemptId: 'a1',
      retryScope: 'SECTION'
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('AMBIGUOUS_REPAIR_TARGET'));
  });
});
