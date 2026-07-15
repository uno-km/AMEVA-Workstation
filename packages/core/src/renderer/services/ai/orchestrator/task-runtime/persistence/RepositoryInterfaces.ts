/**
 * @file orchestrator/task-runtime/persistence/RepositoryInterfaces.ts
 * @system AMEVA OS Desktop Workstation
 * @role Persistence Adapter Repository Interface Definitions
 */

import type { RepositoryArtifact, ArtifactRetentionMetadata, ArtifactStatus } from '../artifact/repository/types';
import type { 
  ApprovalRecord, 
  ApprovalRecordStatus,
  ApprovalPersistenceResult,
  ApprovalReservationInput,
  ApprovalConsumptionInput,
  ApprovalReservationReleaseInput,
  ApprovalInvalidationInput
} from '../approval/types';
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
  saveApprovalRecord(record: ApprovalRecord): Promise<ApprovalPersistenceResult>;
  getApprovalRecord(approvalId: string): Promise<ApprovalPersistenceResult>;
  updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<ApprovalPersistenceResult>;
  compareAndReserveApproval(input: ApprovalReservationInput): Promise<ApprovalPersistenceResult>;
  compareAndConsumeApproval(input: ApprovalConsumptionInput): Promise<ApprovalPersistenceResult>;
  releaseApprovalReservation(input: ApprovalReservationReleaseInput): Promise<ApprovalPersistenceResult>;
  invalidateApproval(input: ApprovalInvalidationInput): Promise<ApprovalPersistenceResult>;
  expireApprovals(now: number): Promise<ApprovalPersistenceResult<number>>;
  revokeApproval(approvalId: string, reason?: string): Promise<ApprovalPersistenceResult>;
  listPendingApprovals(filter?: { missionId?: string; workbenchSessionId?: string }): Promise<ApprovalPersistenceResult<ApprovalRecord[]>>;
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
