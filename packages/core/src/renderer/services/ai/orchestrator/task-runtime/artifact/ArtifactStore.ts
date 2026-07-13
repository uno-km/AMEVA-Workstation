import type { ArtifactManifest, ArtifactEvent, ArtifactStatus, ArtifactKind } from './types';
import type { IRuntimePersistenceAdapter } from '../persistence/RuntimePersistenceAdapter';

export class ArtifactStore {
  constructor(private readonly persistence: IRuntimePersistenceAdapter) {}

  public async saveManifest(manifest: ArtifactManifest): Promise<void> {
    await this.persistence.saveArtifactManifest(manifest);
  }

  public async loadManifest(missionId: string, artifactId: string): Promise<ArtifactManifest | null> {
    return this.persistence.loadArtifactManifest(missionId, artifactId);
  }

  public async listManifests(missionId: string): Promise<ArtifactManifest[]> {
    return this.persistence.listArtifactManifests(missionId);
  }
}
