/**
 * @file orchestrator/task-runtime/persistence/InMemoryRepositories.ts
 * @system AMEVA OS Desktop Workstation
 * @role In-Memory Implementations for Phase 6.4 Repositories
 */

import type {
  IArtifactRepositoryPersistence,
  IApprovalRepositoryPersistence,
  ISourceApplyRepositoryPersistence
} from './RepositoryInterfaces';

import type { RepositoryArtifact, ArtifactRetentionMetadata, ArtifactStatus } from '../artifact/repository/types';
import type { ApprovalRecord, ApprovalRecordStatus } from '../approval/types';
import type { 
  SourceApplyRequest, 
  SourceApplyPreview, 
  SourceApplyOperation, 
  RollbackSnapshotReference, 
  ApplyVerificationResult 
} from '../apply/types';

export class ArtifactRepositoryInMemory implements IArtifactRepositoryPersistence {
  private readonly artifacts = new Map<string, RepositoryArtifact>();
  private readonly retentions = new Map<string, ArtifactRetentionMetadata>();

  public async saveRepositoryArtifact(artifact: RepositoryArtifact): Promise<void> {
    this.artifacts.set(artifact.repositoryArtifactId, { ...artifact });
  }

  public async getRepositoryArtifact(repositoryArtifactId: string): Promise<RepositoryArtifact | null> {
    const artifact = this.artifacts.get(repositoryArtifactId);
    return artifact ? { ...artifact } : null;
  }

  public async listRepositoryArtifacts(missionId: string): Promise<RepositoryArtifact[]> {
    return Array.from(this.artifacts.values())
      .filter(a => a.missionId === missionId)
      .map(a => ({ ...a }));
  }

  public async updateArtifactStatus(repositoryArtifactId: string, status: ArtifactStatus): Promise<void> {
    const artifact = this.artifacts.get(repositoryArtifactId);
    if (!artifact) throw new Error(`Artifact ${repositoryArtifactId} not found`);
    artifact.status = status;
    artifact.updatedAt = Date.now();
  }

  public async saveRetentionMetadata(metadata: ArtifactRetentionMetadata): Promise<void> {
    this.retentions.set(metadata.repositoryArtifactId, { ...metadata });
  }

  public async getRetentionMetadata(repositoryArtifactId: string): Promise<ArtifactRetentionMetadata | null> {
    const metadata = this.retentions.get(repositoryArtifactId);
    return metadata ? { ...metadata } : null;
  }
}

export class ApprovalRepositoryInMemory implements IApprovalRepositoryPersistence {
  private readonly records = new Map<string, ApprovalRecord>();

  public async saveApprovalRecord(record: ApprovalRecord): Promise<void> {
    this.records.set(record.approvalId, { ...record });
  }

  public async getApprovalRecord(approvalId: string): Promise<ApprovalRecord | null> {
    const record = this.records.get(approvalId);
    return record ? { ...record } : null;
  }

  public async updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<void> {
    const record = this.records.get(approvalId);
    if (!record) throw new Error(`Approval ${approvalId} not found`);
    record.status = status;
    if (status === 'APPROVED' || status === 'REJECTED') {
      record.approvedAt = Date.now();
    }
    if (status === 'CONSUMED') {
      record.consumedAt = Date.now();
    }
  }

  public async listPendingApprovals(missionId: string): Promise<ApprovalRecord[]> {
    return Array.from(this.records.values())
      .filter(r => r.missionId === missionId && r.status === 'REQUESTED')
      .map(r => ({ ...r }));
  }

  public async compareAndConsumeApproval(approvalId: string, expectedOperationDigest: string, expectedPreviewDigest: string): Promise<boolean> {
    const record = this.records.get(approvalId);
    if (!record || record.status !== 'APPROVED') return false;

    if (record.operationDigest !== expectedOperationDigest || record.previewDigest !== expectedPreviewDigest) {
      return false;
    }

    if (record.singleUse) {
      record.status = 'CONSUMED';
      record.consumedAt = Date.now();
    }
    return true;
  }

  public async expireApprovals(beforeTime: number): Promise<number> {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.status === 'REQUESTED' && record.expiresAt < beforeTime) {
        record.status = 'EXPIRED';
        count++;
      }
    }
    return count;
  }
}

export class SourceApplyRepositoryInMemory implements ISourceApplyRepositoryPersistence {
  private readonly requests = new Map<string, SourceApplyRequest>();
  private readonly previews = new Map<string, SourceApplyPreview>();
  private readonly operations = new Map<string, SourceApplyOperation>();
  private readonly snapshots = new Map<string, RollbackSnapshotReference>();
  private readonly verifications = new Map<string, ApplyVerificationResult>();

  public async saveSourceApplyRequest(request: SourceApplyRequest): Promise<void> {
    this.requests.set(request.sourceApplyRequestId, { ...request });
  }

  public async getSourceApplyRequest(requestId: string): Promise<SourceApplyRequest | null> {
    const req = this.requests.get(requestId);
    return req ? { ...req } : null;
  }

  public async saveSourceApplyPreview(preview: SourceApplyPreview): Promise<void> {
    this.previews.set(preview.requestId, { ...preview });
  }

  public async getSourceApplyPreview(requestId: string): Promise<SourceApplyPreview | null> {
    const p = this.previews.get(requestId);
    return p ? { ...p } : null;
  }

  public async saveSourceApplyOperation(operation: SourceApplyOperation): Promise<void> {
    this.operations.set(operation.operationId, { ...operation });
  }

  public async getSourceApplyOperation(operationId: string): Promise<SourceApplyOperation | null> {
    const op = this.operations.get(operationId);
    return op ? { ...op } : null;
  }

  public async updateSourceApplyOperation(operation: SourceApplyOperation): Promise<void> {
    operation.updatedAt = Date.now();
    this.operations.set(operation.operationId, { ...operation });
  }

  public async saveRollbackSnapshotReference(reference: RollbackSnapshotReference): Promise<void> {
    this.snapshots.set(reference.rollbackSnapshotId, { ...reference });
  }

  public async getRollbackSnapshotReference(snapshotId: string): Promise<RollbackSnapshotReference | null> {
    const s = this.snapshots.get(snapshotId);
    return s ? { ...s } : null;
  }

  public async saveApplyVerificationResult(result: ApplyVerificationResult): Promise<void> {
    this.verifications.set(result.verificationId, { ...result });
  }
}
