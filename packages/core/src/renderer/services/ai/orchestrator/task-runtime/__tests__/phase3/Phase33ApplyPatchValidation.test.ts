import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../../../ToolRegistry';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { ArtifactTransactionManager } from '../../artifact/ArtifactTransactionManager';

describe('Phase 3.3 Apply Patch Validation', () => {
  let fs: IFileSystemAdapter;
  let artifactManager: any;
  let registry: ToolRegistry;

  beforeEach(async () => {
    globalThis.window = { electronAPI: { llmAddLog: vi.fn() } } as any;
    fs = {
      read: vi.fn().mockResolvedValue('line1\nline2\nline3\nline4\nline5'),
      write: vi.fn(),
      stat: vi.fn().mockResolvedValue({ size: 100 }),
      hash: vi.fn().mockResolvedValue('hash123'),
      list: vi.fn(),
      delete: vi.fn(),
      mkdir: vi.fn(),
      exists: vi.fn()
    } as unknown as IFileSystemAdapter;

    artifactManager = {
      getManifest: vi.fn().mockResolvedValue({
        missionId: 'm1',
        taskId: 't1',
        artifactId: 'art1',
        finalPath: '/m1/art1.txt',
        revision: 1
      })
    };

    registry = new ToolRegistry(fs, artifactManager as any);
    await registry.registerDefaultTools();
  });

  it('rejects patch if context is missing', async () => {
    const result = await registry.executeTool('apply_patch', { patch: 'test' }, { missionId: 'm1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('INVALID_ARTIFACT_CONTEXT');
  });

  it('rejects patch if manifest does not match context', async () => {
    artifactManager.getManifest.mockResolvedValueOnce({
      missionId: 'm1',
      taskId: 't2', // Mismatch
      artifactId: 'art1',
      finalPath: '/m1/art1.txt',
      revision: 1
    });

    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1' };
    const result = await registry.executeTool('apply_patch', { patch: 'test' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('CONTEXT_MISMATCH');
  });

  it('rejects patch if prototype pollution is attempted in FIELD scope', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'FIELD' };
    vi.mocked(fs.read).mockResolvedValueOnce('{"a": {}}');

    const result = await registry.executeTool('apply_patch', { targetSelector: '__proto__.b', patch: '"hacked"' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Prototype pollution');
  });

  it('requires allowedRanges for TEST scope', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'TEST' };
    vi.mocked(fs.read).mockResolvedValueOnce('test content');

    const result = await registry.executeTool('apply_patch', { patch: 'new test content' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires explicit allowedRanges');
  });

  it('applies section patch correctly', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'SECTION' };
    vi.mocked(fs.read).mockResolvedValueOnce('# Title\n\n## Section 1\nContent 1\n## Section 2\nContent 2\n');

    const result = await registry.executeTool('apply_patch', { targetSection: '## Section 1', patch: '## Section 1\nNew Content 1\n' }, context);
    expect(result.success).toBe(true);
    
    // Check what was written to staging
    expect(fs.write).toHaveBeenCalledWith(
      expect.any(String),
      '# Title\n\n## Section 1\nNew Content 1\n## Section 2\nContent 2\n'
    );
  });

  it('preserves other fields in FIELD scope', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'FIELD' };
    vi.mocked(fs.read).mockResolvedValueOnce('{"a": 1, "b": {"c": 2}}');

    const result = await registry.executeTool('apply_patch', { targetSelector: 'b.c', patch: '3' }, context);
    expect(result.success).toBe(true);
    
    const written = vi.mocked(fs.write).mock.calls[0][1];
    expect(JSON.parse(written)).toEqual({ a: 1, b: { c: 3 } });
  });

  it('rejects patch outside allowedRanges', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'FULL_TASK' };
    vi.mocked(fs.read).mockResolvedValueOnce('line 1\nline 2\nline 3\nline 4\nline 5');
    
    // Changing line 4, but allowed is only L1-L2
    const result = await registry.executeTool('apply_patch', { patch: 'line 1\nline 2\nline 3\nchanged 4\nline 5', allowedRanges: ['L1-L2'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('outside allowedRanges');
  });

  it('rejects patch intersecting protectedRanges', async () => {
    const context = { missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', currentRevision: 1, finalPath: '/m1/art1.txt', idempotencyKey: 'idem1', retryScope: 'FULL_TASK' };
    vi.mocked(fs.read).mockResolvedValueOnce('line 1\nline 2\nline 3\nline 4\nline 5');
    
    // Changing line 2, protected is L2-L3
    const result = await registry.executeTool('apply_patch', { patch: 'line 1\nchanged 2\nline 3\nline 4\nline 5', protectedRanges: ['L2-L3'] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Intersects with protectedRanges');
  });
});
