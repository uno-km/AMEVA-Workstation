import type { ArtifactManifest, ArtifactStatus, ArtifactKind } from './types';
import type { ArtifactStore } from './ArtifactStore';
import type { IArtifactReader } from './IArtifactReader';
import { executeTerminal } from '../../../../ipc/electronApiAdapter';
import { PathSanitizer } from '../policy/PathSanitizer';

export class ArtifactTransactionManager {
  constructor(
    private readonly store: ArtifactStore,
    private readonly reader: IArtifactReader
  ) {}

  /**
   * STAGED -> COMMITTED 원자적 전이 (Rename via Host)
   */
  public async commitArtifact(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);
    
    if (manifest.status !== 'STAGED' && manifest.status !== 'VALIDATED') {
      throw new Error(`Invalid status for commit: ${manifest.status}`);
    }

    if (!manifest.stagedPath || !manifest.finalPath) {
      throw new Error(`Paths are missing in manifest for commit: ${artifactId}`);
    }

    const safeStaged = PathSanitizer.sanitizePath(manifest.stagedPath, 'write');
    const safeFinal = PathSanitizer.sanitizePath(manifest.finalPath, 'write');

    try {
      // 1. Move file (Atomic Rename in OS)
      const res = await executeTerminal(`Move-Item -Path "${safeStaged}" -Destination "${safeFinal}" -Force`, undefined);
      if (res.exitCode !== 0) {
        throw new Error(`Move-Item failed: ${res.stderr}`);
      }

      // 2. Update hash & size
      const size = await this.reader.getSize(manifest.finalPath);
      const hash = await this.reader.getHash(manifest.finalPath) ?? undefined;

      manifest.size = size;
      manifest.contentHash = hash;
      manifest.status = 'COMMITTED';
      manifest.updatedAt = Date.now();
      manifest.revision += 1;

      // 3. Save updated manifest
      await this.store.saveManifest(manifest);

    } catch (e) {
      console.error(`[ArtifactTransactionManager] Commit failed for ${artifactId}`, e);
      throw e;
    }
  }

  /**
   * DECLARED 단계 생성
   */
  public async declareArtifact(manifest: ArtifactManifest): Promise<void> {
    const existing = await this.store.loadManifest(manifest.missionId, manifest.artifactId);
    if (existing) {
      throw new Error(`Artifact already declared: ${manifest.artifactId}`);
    }
    manifest.status = 'DECLARED';
    manifest.createdAt = Date.now();
    manifest.updatedAt = manifest.createdAt;
    manifest.revision = 0;
    await this.store.saveManifest(manifest);
  }

  /**
   * 파일 쓰기 직후 호출되어 상태를 STAGED로 전이
   */
  public async markStaged(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);
    
    manifest.status = 'STAGED';
    manifest.updatedAt = Date.now();
    await this.store.saveManifest(manifest);
  }

  /**
   * VALIDATED 전이
   */
  public async markValidated(missionId: string, artifactId: string): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);

    manifest.status = 'VALIDATED';
    manifest.updatedAt = Date.now();
    await this.store.saveManifest(manifest);
  }

  /**
   * REJECTED 전이
   */
  public async rejectArtifact(missionId: string, artifactId: string, errors: string[]): Promise<void> {
    const manifest = await this.store.loadManifest(missionId, artifactId);
    if (!manifest) throw new Error(`Artifact not found: ${artifactId}`);

    manifest.status = 'REJECTED';
    manifest.validationErrors = errors;
    manifest.updatedAt = Date.now();
    await this.store.saveManifest(manifest);
  }
}
