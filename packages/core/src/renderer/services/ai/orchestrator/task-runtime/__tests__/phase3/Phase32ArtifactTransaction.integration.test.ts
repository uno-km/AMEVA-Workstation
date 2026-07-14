import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { ArtifactTransactionManager } from '../../artifact/ArtifactTransactionManager';
import { InMemoryRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';
import { V2RuntimeFeatureFlag } from '../../domain/V2RuntimeFeatureFlag';

import { ArtifactStore } from '../../artifact/ArtifactStore';
import { PersistenceIdempotencyStore } from '../../artifact/IdempotencyStore';

// Mocks
class MockFSAdapter {
  private files = new Map<string, string>();
  async write(path: string, content: string) { this.files.set(path, content); }
  async read(path: string) { return this.files.get(path) ?? null; }
  async stat(path: string) { return this.files.has(path) ? { exists: true, size: this.files.get(path)!.length } : { exists: false, size: 0 }; }
  async hash(path: string) { return this.files.has(path) ? 'hash-' + this.files.get(path)!.length : null; }
  async move(from: string, to: string) { 
    if (!this.files.has(from)) throw new Error('Not found');
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
  }
}

describe('Phase 3.2: ArtifactTransaction Integration', () => {
  beforeAll(() => { V2RuntimeFeatureFlag.setMode('V2_ONLY'); });
  afterAll(() => { V2RuntimeFeatureFlag.setMode('LEGACY_ONLY'); });

  it('should successfully transition through STAGED -> WRITTEN -> VALIDATED -> COMMITTING -> COMMITTED', async () => {
    const fsAdapter = new MockFSAdapter() as any;
    const persistence = new InMemoryRuntimePersistenceAdapter();
    const store = new ArtifactStore(persistence);
    const idempotency = new PersistenceIdempotencyStore(persistence);
    const txManager = new ArtifactTransactionManager(store, fsAdapter, idempotency);

    const missionId = 'm-1';
    const taskId = 't-1';
    const attemptId = 'a-1';
    const artifactId = 'art-1';
    const stagedPath = '/missions/m-1/staging/t-1/a-1/art-1_rev2.txt';
    const finalPath = '/missions/m-1/final/art-1.txt';

    await fsAdapter.write(stagedPath, 'patch content');

    await txManager.declareArtifact({
      artifactId,
      missionId,
      taskId,
      attemptId,
      kind: 'FILE',
      stagedPath,
      finalPath,
      status: 'DECLARED',
      revision: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provenance: { missionId, taskId, attemptId, producer: 'apply_patch' }
    });

    await txManager.markStaged(missionId, artifactId);
    await txManager.markWritten(missionId, artifactId);
    let m = await txManager.getManifest(missionId, artifactId);
    assert.equal(m!.status, 'WRITTEN');

    await txManager.markValidated(missionId, artifactId);
    m = await txManager.getManifest(missionId, artifactId);
    assert.equal(m!.status, 'VALIDATED');

    await txManager.commitArtifact(missionId, artifactId, finalPath);
    m = await txManager.getManifest(missionId, artifactId);
    assert.equal(m!.status, 'COMMITTED');
    assert.equal(m!.finalPath, finalPath);
    
    const finalContent = await fsAdapter.read(finalPath);
    assert.equal(finalContent, 'patch content');
  });
});
