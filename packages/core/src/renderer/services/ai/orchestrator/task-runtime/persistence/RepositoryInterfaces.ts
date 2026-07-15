/**
 * @file orchestrator/task-runtime/persistence/RepositoryInterfaces.ts
 * @system AMEVA OS Desktop Workstation
 * @role Persistence Adapter Repository Interface Definitions
 */

import type { RepositoryArtifact, ArtifactRetentionMetadata, ArtifactStatus } from '../artifact/repository/types';
import type { ApprovalRecord, ApprovalRecordStatus } from '../approval/types';
import type { 
  SourceApplyRequest, 
  SourceApplyPreview, 
  SourceApplyOperation, 
  RollbackSnapshotReference, 
  ApplyVerificationResult 
} from '../apply/types';

export interface IArtifactRepositoryPersistence {
  saveRepositoryArtifact(artifact: RepositoryArtifact): Promise<void>;
  getRepositoryArtifact(repositoryArtifactId: string): Promise<RepositoryArtifact | null>;
  listRepositoryArtifacts(missionId: string): Promise<RepositoryArtifact[]>;
  updateArtifactStatus(repositoryArtifactId: string, status: ArtifactStatus): Promise<void>;
  saveRetentionMetadata(metadata: ArtifactRetentionMetadata): Promise<void>;
  getRetentionMetadata(repositoryArtifactId: string): Promise<ArtifactRetentionMetadata | null>;
}

export interface IApprovalRepositoryPersistence {
  saveApprovalRecord(record: ApprovalRecord): Promise<void>;
  getApprovalRecord(approvalId: string): Promise<ApprovalRecord | null>;
  updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<void>;
  listPendingApprovals(missionId: string): Promise<ApprovalRecord[]>;
  compareAndConsumeApproval(approvalId: string, expectedOperationDigest: string, expectedPreviewDigest: string): Promise<boolean>;
  expireApprovals(beforeTime: number): Promise<number>;
}

export interface ISourceApplyRepositoryPersistence {
  saveSourceApplyRequest(request: SourceApplyRequest): Promise<void>;
  getSourceApplyRequest(requestId: string): Promise<SourceApplyRequest | null>;
  
  saveSourceApplyPreview(preview: SourceApplyPreview): Promise<void>;
  getSourceApplyPreview(requestId: string): Promise<SourceApplyPreview | null>;
  
  saveSourceApplyOperation(operation: SourceApplyOperation): Promise<void>;
  getSourceApplyOperation(operationId: string): Promise<SourceApplyOperation | null>;
  updateSourceApplyOperation(operation: SourceApplyOperation): Promise<void>;
  
  saveRollbackSnapshotReference(reference: RollbackSnapshotReference): Promise<void>;
  getRollbackSnapshotReference(snapshotId: string): Promise<RollbackSnapshotReference | null>;
  
  saveApplyVerificationResult(result: ApplyVerificationResult): Promise<void>;
}
