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
  getAuthorizationTicket(ticketId: string): Promise<import('../approval/types').ApprovalAuthorizationTicket | null>;
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

export interface IApplyExecutionPersistence {
  // Lease Management
  acquireLease(workspaceRoot: string, executionId: string, leaseOwner: string, expiresAt: number): Promise<boolean>;
  releaseLease(workspaceRoot: string, executionId: string): Promise<void>;
  getLease(workspaceRoot: string): Promise<import('../apply/types').WorkspaceExecutionLease | null>;
  quarantineWorkspace(workspaceRoot: string, reason: string): Promise<void>;
  isWorkspaceQuarantined(workspaceRoot: string): Promise<boolean>;

  // Execution Record Management
    getExecutionByTicketId(ticketId: string): Promise<import('../apply/types').SourceApplyExecutionRecord | null>;
  saveExecutionRecord(record: import('../apply/types').SourceApplyExecutionRecord): Promise<void>;
  getExecutionRecord(executionId: string): Promise<import('../apply/types').SourceApplyExecutionRecord | null>;
  updateExecutionStatus(executionId: string, status: import('../apply/types').SourceApplyOperationStatus, error?: string): Promise<void>;

  // Journaling
  appendJournalEntry(entry: import('../apply/types').ApplyJournalEntry): Promise<void>;
  updateJournalEntryStatus(executionId: string, sequence: number, status: import('../apply/types').ApplyJournalEntry['restoreStatus']): Promise<void>;
  getJournalEntries(executionId: string): Promise<import('../apply/types').ApplyJournalEntry[]>;
}
