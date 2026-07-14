import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../ToolRegistry';

import { PathSanitizer } from '../../policy/PathSanitizer';

describe('Phase 3.1 Partial Repair Integration', () => {
  let mockFileAdapter: any;
  let registry: ToolRegistry;

  beforeEach(async () => {
    mockFileAdapter = {
      read: vi.fn().mockResolvedValue('line1\nline2_target\nline3'),
      write: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ exists: true, size: 100, isDirectory: false }),
      hash: vi.fn().mockResolvedValue('old_hash_123'),
      list: vi.fn().mockResolvedValue(''),
      remove: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue(undefined)
    };

    // Mock window to prevent ReferenceError in electronApiAdapter
    (global as any).window = {
      electronAPI: {
        llmAddLog: vi.fn(),
        executeTerminal: vi.fn()
      }
    };

    // Mock PathSanitizer
    vi.spyOn(PathSanitizer, 'sanitizePath').mockImplementation((p: string) => p);

    registry = new ToolRegistry(mockFileAdapter);
    await registry.registerDefaultTools();
  });

  it('1. Blocks write_file tool when retryScope is SECTION', async () => {
    const result = await registry.executeTool('write_file', {
      path: '/test.ts',
      content: 'new content'
    }, { retryScope: 'SECTION' } as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('UNAUTHORIZED_TOOL_USE');
    expect(result.error).toContain('apply_patch');
  });

  it('2. Allows write_file when retryScope is FULL_TASK or FILE', async () => {
    const result = await registry.executeTool('write_file', {
      path: '/test.ts',
      content: 'new content'
    }, { retryScope: 'FULL_TASK' } as any);

    expect(result.success).toBe(true);
    expect(mockFileAdapter.write).toHaveBeenCalledWith('/test.ts', 'new content');
  });

  it('3. Successfully applies a partial patch with targetSection', async () => {
    const result = await registry.executeTool('apply_patch', {
      targetPath: '/test.ts',
      targetSection: 'line2_target',
      replacement: 'line2_fixed'
    }, { retryScope: 'SECTION', missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', finalPath: '/test.ts', idempotencyKey: 'idem1', currentRevision: 1 } as any);

    expect(result.success).toBe(true);
    expect(result.newHash).toBe('old_hash_123'); // mock returns old_hash_123 for all hash calls
    expect(mockFileAdapter.write).toHaveBeenCalledWith('/missions/m1/staging/t1/a1/art1_rev2.txt', 'line1\nline2_fixed\nline3');
  });

  it('4. Rejects apply_patch if targetSection is not found (AMBIGUOUS_REPAIR_TARGET)', async () => {
    const result = await registry.executeTool('apply_patch', {
      targetPath: '/test.ts',
      targetSection: 'line99_target',
      replacement: 'line99_fixed'
    }, { retryScope: 'SECTION', missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', finalPath: '/test.ts', idempotencyKey: 'idem1', currentRevision: 1 } as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('AMBIGUOUS_REPAIR_TARGET');
    expect(mockFileAdapter.write).not.toHaveBeenCalled();
  });

  it('5. Rejects apply_patch if NO_CHANGE is detected', async () => {
    const result = await registry.executeTool('apply_patch', {
      targetPath: '/test.ts',
      targetSection: 'line2_target',
      replacement: 'line2_target' // same content
    }, { retryScope: 'SECTION', missionId: 'm1', taskId: 't1', attemptId: 'a1', artifactId: 'art1', finalPath: '/test.ts', idempotencyKey: 'idem1', currentRevision: 1 } as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('NO_CHANGE');
    expect(mockFileAdapter.write).not.toHaveBeenCalled();
  });
});
