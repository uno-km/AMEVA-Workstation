import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  const generatePreviewAndDigest = async () => {
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

    await SourceApplyDigestService.createSourceDigest(__dirname, affectedPaths);
    await SourceApplyDigestService.createPreviewDigest(preview);
  };

  it('MUST NOT perform writeFileSync operations during Preview construction or validation', async () => {
    await generatePreviewAndDigest();
    const proof = {
      writeFile: (globalThis as any).writeFileCount,
      writeFileSync: (globalThis as any).writeFileSyncCount,
      rename: (globalThis as any).renameCount,
      renameSync: (globalThis as any).renameSyncCount,
      unlink: (globalThis as any).unlinkCount,
      unlinkSync: (globalThis as any).unlinkSyncCount,
      rm: (globalThis as any).rmCount,
      rmSync: (globalThis as any).rmSyncCount
    };
    console.log('[Read-Only Proof JSON]\n' + JSON.stringify(proof, null, 2));
    expect((globalThis as any).writeFileSyncCount).toBe(0);
  });

  it('MUST NOT perform renameSync operations during Preview construction or validation', async () => {
    await generatePreviewAndDigest();
    expect((globalThis as any).renameSyncCount).toBe(0);
  });

  it('MUST NOT perform rmSync operations during Preview construction or validation', async () => {
    await generatePreviewAndDigest();
    expect((globalThis as any).rmSyncCount).toBe(0);
  });

  it('MUST NOT perform unlinkSync operations during Preview construction or validation', async () => {
    await generatePreviewAndDigest();
    expect((globalThis as any).unlinkSyncCount).toBe(0);
  });

  it('MUST NOT perform async write/rename/rm/unlink operations during Preview construction or validation', async () => {
    await generatePreviewAndDigest();
    expect((globalThis as any).writeFileCount).toBe(0);
    expect((globalThis as any).renameCount).toBe(0);
    expect((globalThis as any).rmCount).toBe(0);
    expect((globalThis as any).unlinkCount).toBe(0);
  });
});
