import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { SourceApplyDigestService } from '../SourceApplyDigestService';

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    writeFileSync: (...args: any[]) => { (globalThis as any).writeFileSyncCount++; return actual.writeFileSync(...args); },
    renameSync: (...args: any[]) => { (globalThis as any).renameSyncCount++; return actual.renameSync(...args); },
    rmSync: (...args: any[]) => { (globalThis as any).rmSyncCount++; return actual.rmSync(...args); },
    unlinkSync: (...args: any[]) => { (globalThis as any).unlinkSyncCount++; return actual.unlinkSync(...args); },
  }
});

vi.mock('fs/promises', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    writeFile: async (...args: any[]) => { (globalThis as any).writeFileCount++; return actual.writeFile(...args); },
    rename: async (...args: any[]) => { (globalThis as any).renameCount++; return actual.rename(...args); },
    rm: async (...args: any[]) => { (globalThis as any).rmCount++; return actual.rm(...args); },
    unlink: async (...args: any[]) => { (globalThis as any).unlinkCount++; return actual.unlink(...args); },
  }
});

describe('Phase 6.4.1A-3: Preview Read-Only Enforcement', () => {
  beforeEach(() => {
    (globalThis as any).writeFileSyncCount = 0;
    (globalThis as any).renameSyncCount = 0;
    (globalThis as any).rmSyncCount = 0;
    (globalThis as any).unlinkSyncCount = 0;
    (globalThis as any).writeFileCount = 0;
    (globalThis as any).renameCount = 0;
    (globalThis as any).rmCount = 0;
    (globalThis as any).unlinkCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('MUST NOT perform any write operations during Preview construction or validation', async () => {
    const affectedPaths = ['test.txt'];
    const preview = {
      previewId: 'prev-1',
      sourceApplyRequestId: 'req-1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 's1',
      repositoryArtifactId: 'art-1',
      artifactRevision: 1,
      sourceWorkspaceId: 'w1',
      sourceDigest: 'abc',
      artifactDigest: 'def',
      addedFiles: [],
      modifiedFiles: affectedPaths,
      deletedFiles: [],
      renamedCandidates: [],
      changedSymbols: [],
      changedRanges: [],
      affectedPaths,
      protectedPathViolations: [],
      conflicts: [],
      riskLevel: 'LOW' as any,
    };

    // Run preview digest generations that touch fs
    await SourceApplyDigestService.createSourceDigest(__dirname, affectedPaths);
    await SourceApplyDigestService.createPreviewDigest(preview);

    const writeFileSyncCount = (globalThis as any).writeFileSyncCount;
    const renameSyncCount = (globalThis as any).renameSyncCount;
    const rmSyncCount = (globalThis as any).rmSyncCount;
    const unlinkSyncCount = (globalThis as any).unlinkSyncCount;

    const proof = {
      writeFile: writeFileCount,
      writeFileSync: writeFileSyncCount,
      rename: renameCount,
      renameSync: renameSyncCount,
      unlink: unlinkCount,
      unlinkSync: unlinkSyncCount,
      rm: rmCount,
      rmSync: rmSyncCount
    };

    console.log('[Read-Only Proof JSON]\n' + JSON.stringify(proof, null, 2));

    expect(writeFileSyncCount).toBe(0);
    expect(renameSyncCount).toBe(0);
    expect(rmSyncCount).toBe(0);
    expect(unlinkSyncCount).toBe(0);
    expect(writeFileCount).toBe(0);
    expect(renameCount).toBe(0);
    expect(rmCount).toBe(0);
    expect(unlinkCount).toBe(0);
  });
});
