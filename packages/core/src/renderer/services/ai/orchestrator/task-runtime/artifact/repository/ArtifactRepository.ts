/**
 * @file orchestrator/task-runtime/artifact/repository/ArtifactRepository.ts
 * @system AMEVA OS Desktop Workstation
 * @role Facade for Artifact Repository Operations
 */

import type { IArtifactRepositoryPersistence } from '../../persistence/RepositoryInterfaces';
import type { RepositoryArtifact, ArtifactStatus, ArtifactApplyStatus, ArtifactProvenance, VerificationSummary } from './types';

export class ArtifactRepository {
  constructor(private readonly persistence: IArtifactRepositoryPersistence) {}

  public async registerArtifact(
    params: {
      missionId: string;
      taskId: string;
      attemptId: string;
      workbenchSessionId: string;
      sourceArtifactId: string;
      artifactKind: string;
      artifactFormat: string;
      logicalPath: string;
      storageReference: string;
      contentHash: string;
      sizeBytes: number;
      mimeType: string;
      provenance: ArtifactProvenance;
    }
  ): Promise<RepositoryArtifact> {
    const repositoryArtifactId = `repo-art-${crypto.randomUUID()}`;
    
    // Check for previous revisions to determine parentRevision and revision number
    const existing = await this.persistence.listRepositoryArtifacts(params.missionId);
    const samePath = existing.filter(a => a.logicalPath === params.logicalPath)
                             .sort((a, b) => b.revision - a.revision);
                             
    const parentRevision = samePath.length > 0 ? samePath[0].revision : undefined;
    const newRevision = parentRevision !== undefined ? parentRevision + 1 : 1;

    const artifact: RepositoryArtifact = {
      repositoryArtifactId,
      missionId: params.missionId,
      taskId: params.taskId,
      attemptId: params.attemptId,
      workbenchSessionId: params.workbenchSessionId,
      sourceArtifactId: params.sourceArtifactId,
      artifactKind: params.artifactKind,
      artifactFormat: params.artifactFormat,
      logicalPath: params.logicalPath,
      storageReference: params.storageReference,
      revision: newRevision,
      parentRevision,
      contentHash: params.contentHash,
      sizeBytes: params.sizeBytes,
      mimeType: params.mimeType,
      status: 'REGISTERING',
      provenance: params.provenance,
      sourceApplyStatus: 'NOT_APPLIED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      committedAt: 0
    };

    await this.persistence.saveRepositoryArtifact(artifact);
    return artifact;
  }

  public async commitArtifact(
    repositoryArtifactId: string, 
    verificationSummary?: VerificationSummary
  ): Promise<void> {
    const artifact = await this.persistence.getRepositoryArtifact(repositoryArtifactId);
    if (!artifact) throw new Error(`Artifact ${repositoryArtifactId} not found`);
    
    if (artifact.status !== 'REGISTERING') {
      throw new Error(`Artifact ${repositoryArtifactId} is not in REGISTERING status`);
    }

    artifact.status = 'AVAILABLE';
    artifact.committedAt = Date.now();
    artifact.updatedAt = Date.now();
    
    if (verificationSummary) {
      artifact.verificationSummary = verificationSummary;
      if (!verificationSummary.passed) {
        artifact.status = 'QUARANTINED';
      }
    }

    await this.persistence.saveRepositoryArtifact(artifact);
  }

  public async getArtifact(repositoryArtifactId: string): Promise<RepositoryArtifact | null> {
    return this.persistence.getRepositoryArtifact(repositoryArtifactId);
  }

  public async listArtifactsByMission(missionId: string): Promise<RepositoryArtifact[]> {
    return this.persistence.listRepositoryArtifacts(missionId);
  }

  public async getLatestRevisionByPath(missionId: string, logicalPath: string): Promise<RepositoryArtifact | null> {
    const existing = await this.persistence.listRepositoryArtifacts(missionId);
    const samePath = existing.filter(a => a.logicalPath === logicalPath)
                             .sort((a, b) => b.revision - a.revision);
    return samePath.length > 0 ? samePath[0] : null;
  }

  public async updateArtifactStatus(repositoryArtifactId: string, status: ArtifactStatus): Promise<void> {
    await this.persistence.updateArtifactStatus(repositoryArtifactId, status);
  }

  public async updateApplyStatus(repositoryArtifactId: string, applyStatus: ArtifactApplyStatus): Promise<void> {
    const artifact = await this.persistence.getRepositoryArtifact(repositoryArtifactId);
    if (!artifact) throw new Error(`Artifact ${repositoryArtifactId} not found`);
    
    artifact.sourceApplyStatus = applyStatus;
    artifact.updatedAt = Date.now();
    await this.persistence.saveRepositoryArtifact(artifact);
  }
}
