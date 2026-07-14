import type { ArtifactManifest, ArtifactStatus, ArtifactKind } from './types';
import type { ArtifactStore } from './ArtifactStore';
import type { IFileSystemAdapter } from './IFileSystemAdapter';

export class IllegalTransitionError extends Error {
  constructor(public from: ArtifactStatus, public to: ArtifactStatus, public artifactId: string) {
    super(`Illegal transition from ${from} to ${to} for artifact ${artifactId}`);
    this.name = 'IllegalTransitionError';
  }
}

export class ArtifactTransactionManager {
  constructor(
    private readonly store: ArtifactStore,
    private readonly fsAdapter: IFileSystemAdapter,
    private readonly idempotencyStore?: import('./IdempotencyStore').IIdempotencyStore
  ) {}

  private validateTransition(current: ArtifactStatus, next: ArtifactStatus, artifactId: string) {
    const validTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
      'DECLARED': ['STAGED', 'WRITTEN', 'REJECTED'],
      'STAGED': ['WRITTEN', 'REJECTED'],
      'WRITTEN': ['VALIDATED', 'REJECTED'],
      'VALIDATED': ['COMMITTING', 'REJECTED'],
      'COMMITTING': ['COMMITTED', 'CORRUPTED', 'STALE'],
      'COMMITTED': ['STALE', 'WRITTEN'], // e.g. overwritten by new attempt
      'REJECTED': [],
      'CORRUPTED': [],
      'STALE': []
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new IllegalTransitionError(current, next, artifactId);
    }
  }

  private async updateStatus(manifest: ArtifactManifest, nextStatus: ArtifactStatus): Promise<void> {
    this.validateTransition(manifest.status, nextStatus, manifest.artifactId);
    manifest.status = nextStatus;
    manifest.updatedAt = Date.now();
    await this.store.saveManifest(manifest);
  }

  public async getManifest(missionId: string, artifactId: string): Promise<ArtifactManifest | null> {
    return this.store.loadManifest(missionId, artifactId);
  }

  /**
   * DECLARED 단계 생성
   */
  public async declareArtifact(manifest: ArtifactManifest): Promise<void> {
    const existing = await this.store.loadManifest(manifest.missionId, manifest.artifactId);
    if (existing) {
      if (existing.status === 'COMMITTED') {
         // Deduplication check
         if (manifest.idempotencyKey && existing.idempotencyKey === manifest.idempotencyKey) {
            return; // Already exists with same idempotency
         }
      }
      // Depending on policy, we might overwrite DECLARED or throw
    }
    manifest.status = 'DECLARED';
    manifest.createdAt = Date.now();
    manifest.updatedAt = manifest.createdAt;
    manifest.revision = (existing?.revision ?? 0) + 1;
    await this.store.saveManifest(manifest);
  }

  public async markWritten(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);
    await this.updateStatus(manifest, 'WRITTEN');
  }

  public async markValidated(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);
    await this.updateStatus(manifest, 'VALIDATED');
  }

  /**
   * VALIDATED -> COMMITTING -> COMMITTED 원자적 전이 (Rename via Adapter)
   */
  public async commitArtifact(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);
    
    // Deduplication check
    if (manifest.status === 'COMMITTED') {
      return; // Already committed
    }

    if (this.idempotencyStore && manifest.idempotencyKey) {
      const record = await this.idempotencyStore.getRecord(manifest.idempotencyKey);
      if (record && record.status === 'COMMITTED') {
         // Already committed by a previous attempt. Verify hash.
         if (manifest.stagedPath) {
           const stagingHash = await this.fsAdapter.hash(manifest.stagedPath);
           if (stagingHash && stagingHash !== record.contentHash) {
             manifest.status = 'CORRUPTED';
             manifest.validationErrors = [...(manifest.validationErrors || []), `Hash mismatch with already committed artifact`];
             await this.store.saveManifest(manifest);
             await this.idempotencyStore.markCorrupted(manifest.idempotencyKey);
             throw new Error(`Hash mismatch with already committed artifact for ${artifactId}`);
           }
         }
         // Idempotent success
         manifest.status = 'COMMITTED';
         await this.store.saveManifest(manifest);
         return;
      }

      const acquired = await this.idempotencyStore.acquireLease(
        manifest.idempotencyKey,
        manifest.artifactId,
        manifest.revision,
        manifest.missionId,
        manifest.taskId,
        manifest.attemptId,
        30000 // 30 seconds ttl
      );
      if (!acquired) {
         throw new Error(`Commit locked for ${artifactId}`);
      }
    }

    if (!manifest.stagedPath || !manifest.finalPath) {
      if (this.idempotencyStore && manifest.idempotencyKey) {
         await this.idempotencyStore.releaseLease(manifest.idempotencyKey);
      }
      throw new Error(`Paths are missing in manifest for commit: ${artifactId}`);
    }

    // 1. Transition to COMMITTING
    await this.updateStatus(manifest, 'COMMITTING');

    const stagedPath = manifest.stagedPath;
    const finalPath = manifest.finalPath;
    const backupPath = finalPath + '.bak';

    try {
      // 2. Pre-move Stat/Hash on staging
      const stagingStat = await this.fsAdapter.stat(stagedPath);
      if (!stagingStat.exists) {
        throw new Error(`Staging file not found: ${stagedPath}`);
      }
      const stagingHash = await this.fsAdapter.hash(stagedPath);

      // 3. Move file (Atomic Rename via Adapter)
      await this.fsAdapter.move(stagedPath, finalPath, backupPath);

      // 4. Post-move Stat/Hash on final
      const finalStat = await this.fsAdapter.stat(finalPath);
      if (!finalStat.exists) {
        throw new Error(`Final file missing after move: ${finalPath}`);
      }
      const finalHash = await this.fsAdapter.hash(finalPath);

      if (stagingHash !== finalHash) {
        // CORRUPTED marking
        manifest.status = 'CORRUPTED';
        manifest.validationErrors = [...(manifest.validationErrors || []), 'Hash mismatch after move'];
        await this.store.saveManifest(manifest);
        if (this.idempotencyStore && manifest.idempotencyKey) {
           await this.idempotencyStore.markCorrupted(manifest.idempotencyKey);
        }
        // Attempt rollback
        try {
          const backupStat = await this.fsAdapter.stat(backupPath);
          if (backupStat.exists) {
            await this.fsAdapter.move(backupPath, finalPath);
          } else {
            await this.fsAdapter.move(finalPath, stagedPath);
          }
        } catch (rbErr) {
          console.error(`Rollback failed for ${artifactId}`);
        }
        throw new Error(`Hash mismatch after commit for ${artifactId}`);
      }

      // 5. Success
      manifest.size = finalStat.size;
      manifest.contentHash = finalHash ?? undefined;
      manifest.updatedAt = Date.now();
      
      // Update status to COMMITTED
      this.validateTransition('COMMITTING', 'COMMITTED', artifactId);
      manifest.status = 'COMMITTED';
      await this.store.saveManifest(manifest);

      if (this.idempotencyStore && manifest.idempotencyKey && finalHash) {
         await this.idempotencyStore.markCommitted(manifest.idempotencyKey, finalHash);
      }

      // Cleanup backup if exists
      const backupStat = await this.fsAdapter.stat(backupPath);
      if (backupStat.exists) {
        await this.fsAdapter.remove(backupPath);
      }

    } catch (e: unknown) {
      if (this.idempotencyStore && manifest.idempotencyKey) {
         await this.idempotencyStore.releaseLease(manifest.idempotencyKey);
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ArtifactTransactionManager] Commit failed for ${artifactId}: ${msg}`);
      
      // Fallback status if we didn't mark it CORRUPTED
      if (manifest.status === 'COMMITTING') {
         // Determine if rollback is needed
         try {
           const finalStat = await this.fsAdapter.stat(finalPath);
           const backupStat = await this.fsAdapter.stat(backupPath);
           if (!finalStat.exists && backupStat.exists) {
              await this.fsAdapter.move(backupPath, finalPath); // Rollback
           }
         } catch (rbErr) {
            console.error(`Rollback failed for ${artifactId}`);
         }
         
         // Mark as CORRUPTED if move failed critically, else back to VALIDATED?
         // Policy: if it failed during move, we mark CORRUPTED to be safe, requiring retry.
         manifest.status = 'CORRUPTED';
         manifest.updatedAt = Date.now();
         manifest.validationErrors = [...(manifest.validationErrors || []), `Commit failed: ${msg}`];
         await this.store.saveManifest(manifest);
      }
      throw e;
    }
  }

  public async rejectArtifact(missionId: string, artifactId: string, errors: string[]): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);

    await this.updateStatus(manifest, 'REJECTED');
    manifest.validationErrors = errors;
    await this.store.saveManifest(manifest);
  }
}
