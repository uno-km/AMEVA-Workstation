import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactTransactionManager } from '../artifact/ArtifactTransactionManager';
import { ArtifactStore } from '../artifact/ArtifactStore';
import { InMemoryRuntimePersistenceAdapter } from '../persistence/RuntimePersistenceAdapter';
import { InMemoryFileSystemAdapter } from '../artifact/InMemoryFileSystemAdapter';
import { PersistenceIdempotencyStore } from '../artifact/IdempotencyStore';

describe('Phase 2: Artifact Transaction', () => {
  let adapter: InMemoryRuntimePersistenceAdapter;
  let store: ArtifactStore;
  let fsAdapter: InMemoryFileSystemAdapter;
  let manager: ArtifactTransactionManager;
  let idempotencyStore: PersistenceIdempotencyStore;

  beforeEach(() => {
    adapter = new InMemoryRuntimePersistenceAdapter();
    store = new ArtifactStore(adapter);
    fsAdapter = new InMemoryFileSystemAdapter();
    idempotencyStore = new PersistenceIdempotencyStore(adapter);
    manager = new ArtifactTransactionManager(store, fsAdapter, idempotencyStore);
  });

  it('should declare an artifact', async () => {
    await manager.declareArtifact({
      artifactId: 'art1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      kind: 'FILE',
      required: true,
      status: 'DECLARED',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      provenance: { missionId: 'm1', taskId: 't1', attemptId: 'a1' }
    });

    const m = await store.loadManifest('m1', 'art1');
    expect(m).not.toBeNull();
    expect(m!.status).toBe('DECLARED');
  });

  it('should stage an artifact', async () => {
    await manager.declareArtifact({
      artifactId: 'art1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      kind: 'FILE',
      required: true,
      status: 'DECLARED',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      provenance: { missionId: 'm1', taskId: 't1', attemptId: 'a1' }
    });

    await manager.markStaged('m1', 'art1');
    await manager.markWritten('m1', 'art1');
    const m = await store.loadManifest('m1', 'art1');
    expect(m!.status).toBe('WRITTEN');
  });

  it('should validate an artifact', async () => {
    await manager.declareArtifact({
      artifactId: 'art1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      kind: 'FILE',
      required: true,
      status: 'DECLARED',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      provenance: { missionId: 'm1', taskId: 't1', attemptId: 'a1' }
    });

    await manager.markStaged('m1', 'art1');
    await manager.markWritten('m1', 'art1');
    await manager.markValidated('m1', 'art1');
    const m = await store.loadManifest('m1', 'art1');
    expect(m!.status).toBe('VALIDATED');
  });

  it('should commit an artifact atomically', async () => {
    // 1. Declare
    await manager.declareArtifact({
      artifactId: 'art1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      kind: 'FILE',
      required: true,
      status: 'DECLARED',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      provenance: { missionId: 'm1', taskId: 't1', attemptId: 'a1' }
    });

    // 2. Set up staging file
    const stagedPath = '/missions/m1/staging/art1.txt';
    const finalPath = '/missions/m1/final/art1.txt';
    await fsAdapter.setFile(stagedPath, 'hello world');

    const manifest = await store.loadManifest('m1', 'art1');
    manifest!.stagedPath = stagedPath;
    manifest!.finalPath = finalPath;
    await store.saveManifest(manifest!);

    // 3. Mark WRITTEN and VALIDATED
    await manager.markStaged('m1', 'art1');
    await manager.markWritten('m1', 'art1');
    await manager.markValidated('m1', 'art1');

    // 4. Commit
    await manager.commitArtifact('m1', 'art1');

    // Verification
    const committed = await store.loadManifest('m1', 'art1');
    expect(committed!.status).toBe('COMMITTED');
    expect(committed!.size).toBeGreaterThan(0);
    expect(committed!.contentHash).toBeDefined();

    const finalStat = await fsAdapter.stat(finalPath);
    expect(finalStat.exists).toBe(true);

    const stagingStat = await fsAdapter.stat(stagedPath);
    expect(stagingStat.exists).toBe(false); // moved
  });

  it('should rollback and mark CORRUPTED if hash mismatch occurs', async () => {
    await manager.declareArtifact({
      artifactId: 'art2',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      kind: 'FILE',
      required: true,
      status: 'DECLARED',
      revision: 0,
      createdAt: 0,
      updatedAt: 0,
      provenance: { missionId: 'm1', taskId: 't1', attemptId: 'a1' }
    });

    const stagedPath = '/missions/m1/staging/art2.txt';
    const finalPath = '/missions/m1/final/art2.txt';
    await fsAdapter.setFile(stagedPath, 'hello');

    const manifest = await store.loadManifest('m1', 'art2');
    manifest!.stagedPath = stagedPath;
    manifest!.finalPath = finalPath;
    await store.saveManifest(manifest!);

    await manager.markStaged('m1', 'art2');
    await manager.markWritten('m1', 'art2');
    await manager.markValidated('m1', 'art2');

    // Mock fsAdapter to simulate corruption during move
    const originalHash = fsAdapter.hash.bind(fsAdapter);
    fsAdapter.hash = async (path: string) => {
      if (path === finalPath) return 'corrupted-hash';
      return originalHash(path);
    };

    await expect(manager.commitArtifact('m1', 'art2')).rejects.toThrow(/Hash mismatch/);

    const result = await store.loadManifest('m1', 'art2');
    expect(result!.status).toBe('CORRUPTED');

    // Should rollback
    const stagingStat = await fsAdapter.stat(stagedPath);
    expect(stagingStat.exists).toBe(true);
    const finalStat = await fsAdapter.stat(finalPath);
    expect(finalStat.exists).toBe(false);
  });
});
