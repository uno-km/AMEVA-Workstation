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
import type { 
  ApprovalRecord, 
  ApprovalRecordStatus,
  ApprovalPersistenceResult,
  ApprovalReservationInput,
  ApprovalConsumptionInput,
  ApprovalReservationReleaseInput,
  ApprovalInvalidationInput,
  ApprovalAuthorizationTicket
} from '../approval/types';
import type { 
  SourceApplyRequest, 
  SourceApplyPreview, 
  SourceApplyOperation, 
  RollbackSnapshotReference, 
  ApplyVerificationResult 
} from '../apply/types';

import { randomUUID } from 'crypto';

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
  private readonly tickets = new Map<string, ApprovalAuthorizationTicket>();
  
  // Per-approval Mutex to ensure atomicity
  private readonly mutexes = new Map<string, Promise<void>>();

  private async acquireLock(approvalId: string): Promise<() => void> {
    let unlock: () => void = () => {};
    const lockPromise = new Promise<void>(resolve => {
      unlock = resolve;
    });

    const previousLock = this.mutexes.get(approvalId) ?? Promise.resolve();
    this.mutexes.set(approvalId, previousLock.then(() => lockPromise));

    await previousLock;

    return () => {
      unlock();
      if (this.mutexes.get(approvalId) === lockPromise) {
        this.mutexes.delete(approvalId);
      }
    };
  }

  private withLock<T>(approvalId: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.acquireLock(approvalId).then(unlock => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(unlock);
      });
    });
  }

  public async saveApprovalRecord(record: ApprovalRecord): Promise<ApprovalPersistenceResult> {
    return this.withLock(record.approvalId, async () => {
      this.records.set(record.approvalId, { ...record });
      return { success: true, record: { ...record } };
    });
  }

  public async getApprovalRecord(approvalId: string): Promise<ApprovalPersistenceResult> {
    return this.withLock(approvalId, async () => {
      const record = this.records.get(approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      return { success: true, record: { ...record } };
    });
  }

  public async updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<ApprovalPersistenceResult> {
    return this.withLock(approvalId, async () => {
      const record = this.records.get(approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      record.status = status;
      record.updatedAt = Date.now();
      
      if (status === 'APPROVED' || status === 'REJECTED') {
        record.approvedAt = Date.now();
      }
      
      return { success: true, record: { ...record } };
    });
  }

  public async compareAndReserveApproval(input: ApprovalReservationInput): Promise<ApprovalPersistenceResult> {
    return this.withLock(input.approvalId, async () => {
      const record = this.records.get(input.approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      if (record.status === 'RESERVED') return { success: false, errorCode: 'APPROVAL_ALREADY_RESERVED', retryable: false };
      if (record.status === 'CONSUMED') return { success: false, errorCode: 'APPROVAL_ALREADY_CONSUMED', retryable: false };
      if (record.status !== 'APPROVED') return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };
      
      if (record.expiresAt <= input.now) return { success: false, errorCode: 'APPROVAL_EXPIRED', retryable: false };

      if (record.missionId !== input.missionId ||
          record.taskId !== input.taskId ||
          record.attemptId !== input.attemptId ||
          record.workbenchSessionId !== input.workbenchSessionId ||
          record.repositoryArtifactId !== input.repositoryArtifactId ||
          record.artifactRevision !== input.artifactRevision ||
          record.sourceWorkspaceId !== input.sourceWorkspaceId ||
          record.sourceDigest !== input.sourceDigest ||
          record.previewDigest !== input.previewDigest ||
          record.operationDigest !== input.operationDigest ||
          record.affectedPathsDigest !== input.affectedPathsDigest ||
          record.riskLevel !== input.riskLevel) {
        return { success: false, errorCode: 'APPROVAL_CONTEXT_MISMATCH', retryable: false };
      }

      const ticketId = `ticket_${randomUUID()}`;
      record.status = 'RESERVED';
      record.reservedAt = input.now;
      record.reservedByOperationId = input.sourceApplyOperationId;
      record.updatedAt = input.now;

      const ticket: ApprovalAuthorizationTicket = {
        authorizationTicketId: ticketId,
        approvalId: record.approvalId,
        sourceApplyRequestId: input.sourceApplyRequestId,
        sourceApplyOperationId: input.sourceApplyOperationId,
        missionId: record.missionId,
        taskId: record.taskId,
        attemptId: record.attemptId,
        workbenchSessionId: record.workbenchSessionId,
        repositoryArtifactId: record.repositoryArtifactId,
        artifactRevision: record.artifactRevision,
        sourceWorkspaceId: record.sourceWorkspaceId,
        sourceDigest: record.sourceDigest,
        previewDigest: record.previewDigest,
        operationDigest: record.operationDigest,
        affectedPathsDigest: record.affectedPathsDigest,
        riskLevel: record.riskLevel,
        reservedAt: input.now,
        expiresAt: record.expiresAt,
        status: 'RESERVED',
        schemaVersion: record.schemaVersion
      };

      this.tickets.set(ticketId, { ...ticket });
      return { success: true, record: { ...record }, ticket: { ...ticket } };
    });
  }

  public async compareAndConsumeApproval(input: ApprovalConsumptionInput): Promise<ApprovalPersistenceResult> {
    return this.withLock(input.approvalId, async () => {
      const record = this.records.get(input.approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      if (record.status === 'CONSUMED') return { success: false, errorCode: 'APPROVAL_ALREADY_CONSUMED', retryable: false };
      if (record.status !== 'RESERVED') return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };
      
      if (record.reservedByOperationId !== input.expectedReservedByOperationId || record.reservedByOperationId !== input.sourceApplyOperationId) {
        return { success: false, errorCode: 'APPROVAL_RESERVATION_OWNER_MISMATCH', retryable: false };
      }

      if (record.sourceDigest !== input.sourceDigest ||
          record.previewDigest !== input.previewDigest ||
          record.operationDigest !== input.operationDigest ||
          record.affectedPathsDigest !== input.affectedPathsDigest) {
        return { success: false, errorCode: 'APPROVAL_CONTEXT_MISMATCH', retryable: false };
      }

      if (record.expiresAt <= input.now) return { success: false, errorCode: 'APPROVAL_EXPIRED', retryable: false };

      const ticket = this.tickets.get(input.authorizationTicketId);
      if (!ticket) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      if (ticket.status !== 'RESERVED') return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };

      record.status = 'CONSUMED';
      record.consumedAt = input.now;
      record.updatedAt = input.now;
      
      ticket.status = 'CONSUMED';

      return { success: true, record: { ...record }, ticket: { ...ticket } };
    });
  }

  public async releaseApprovalReservation(input: ApprovalReservationReleaseInput): Promise<ApprovalPersistenceResult> {
    return this.withLock(input.approvalId, async () => {
      const record = this.records.get(input.approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      if (record.status !== 'RESERVED') return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };
      if (record.reservedByOperationId !== input.sourceApplyOperationId) return { success: false, errorCode: 'APPROVAL_RESERVATION_OWNER_MISMATCH', retryable: false };

      const ticket = this.tickets.get(input.authorizationTicketId);
      if (!ticket) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      record.status = 'RELEASED';
      record.releasedAt = input.now;
      record.updatedAt = input.now;
      
      ticket.status = 'RELEASED';

      return { success: true, record: { ...record }, ticket: { ...ticket } };
    });
  }

  public async invalidateApproval(input: ApprovalInvalidationInput): Promise<ApprovalPersistenceResult> {
    return this.withLock(input.approvalId, async () => {
      const record = this.records.get(input.approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      if (record.status === 'CONSUMED' || record.status === 'INVALIDATED') {
        return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };
      }

      record.status = 'INVALIDATED';
      record.invalidatedAt = input.now;
      record.invalidationReason = input.invalidationReason;
      record.updatedAt = input.now;

      let ticketResponse: ApprovalAuthorizationTicket | undefined;
      if (input.authorizationTicketId) {
        const ticket = this.tickets.get(input.authorizationTicketId);
        if (ticket) {
          ticket.status = 'INVALIDATED';
          ticketResponse = { ...ticket };
        }
      }

      return { success: true, record: { ...record }, ticket: ticketResponse };
    });
  }

  public async revokeApproval(approvalId: string, reason?: string): Promise<ApprovalPersistenceResult> {
    return this.withLock(approvalId, async () => {
      const record = this.records.get(approvalId);
      if (!record) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      
      if (record.status === 'CONSUMED' || record.status === 'RESERVED') {
        return { success: false, errorCode: 'APPROVAL_STATE_TRANSITION_INVALID', retryable: false };
      }

      record.status = 'REVOKED';
      record.updatedAt = Date.now();
      
      return { success: true, record: { ...record } };
    });
  }

  public async listPendingApprovals(filter?: { missionId?: string; workbenchSessionId?: string }): Promise<ApprovalPersistenceResult<ApprovalRecord[]>> {
    const list = Array.from(this.records.values())
      .filter(r => r.status === 'REQUESTED' && 
        (!filter?.missionId || r.missionId === filter.missionId) &&
        (!filter?.workbenchSessionId || r.workbenchSessionId === filter.workbenchSessionId))
      .map(r => ({ ...r }));
      
    return { success: true, data: list };
  }

  public async expireApprovals(now: number): Promise<ApprovalPersistenceResult<number>> {
    let count = 0;
    // For safety, we should lock individually, but to avoid deadlocks we can do a pass to gather IDs
    const toExpire: string[] = [];
    for (const record of this.records.values()) {
      if ((record.status === 'REQUESTED' || record.status === 'APPROVED') && record.expiresAt <= now) {
        toExpire.push(record.approvalId);
      }
    }
    
    for (const id of toExpire) {
      await this.withLock(id, async () => {
        const record = this.records.get(id);
        if (record && (record.status === 'REQUESTED' || record.status === 'APPROVED') && record.expiresAt <= now) {
          record.status = 'EXPIRED';
          record.updatedAt = now;
          count++;
        }
      });
    }

    return { success: true, data: count };
  }

  public async getAuthorizationTicket(ticketId: string): Promise<ApprovalAuthorizationTicket | null> {
    const ticket = this.tickets.get(ticketId);
    return ticket ? { ...ticket } : null;
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
import type { IApplyExecutionPersistence } from './RepositoryInterfaces';
import type { 
  SourceApplyExecutionRecord, 
  ApplyJournalEntry, 
  WorkspaceExecutionLease,
  SourceApplyOperationStatus
} from '../apply/types';

export class ApplyExecutionPersistenceInMemory implements IApplyExecutionPersistence {
  private readonly leases = new Map<string, WorkspaceExecutionLease>();
  private readonly quarantines = new Set<string>();
  private readonly executions = new Map<string, SourceApplyExecutionRecord>();
  private readonly journals = new Map<string, Map<number, ApplyJournalEntry>>();

  public async acquireLease(workspaceRoot: string, executionId: string, leaseOwner: string, expiresAt: number): Promise<boolean> {
    const existing = this.leases.get(workspaceRoot);
    if (existing && existing.expiresAt > Date.now() && existing.executionId !== executionId) {
      return false;
    }
    this.leases.set(workspaceRoot, {
      workspaceRoot,
      executionId,
      leaseOwner,
      acquiredAt: Date.now(),
      expiresAt
    });
    return true;
  }

  public async releaseLease(workspaceRoot: string, executionId: string): Promise<void> {
    const existing = this.leases.get(workspaceRoot);
    if (existing && existing.executionId === executionId) {
      this.leases.delete(workspaceRoot);
    }
  }

  public async getLease(workspaceRoot: string): Promise<WorkspaceExecutionLease | null> {
    const lease = this.leases.get(workspaceRoot);
    if (lease && lease.expiresAt > Date.now()) {
      return { ...lease };
    }
    if (lease) {
      return { ...lease }; 
    }
    return null;
  }

  public async quarantineWorkspace(workspaceRoot: string, reason: string): Promise<void> {
    this.quarantines.add(workspaceRoot);
  }

  public async isWorkspaceQuarantined(workspaceRoot: string): Promise<boolean> {
    return this.quarantines.has(workspaceRoot);
  }

    public async getExecutionByTicketId(ticketId: string): Promise<SourceApplyExecutionRecord | null> {
    for (const rec of this.executions.values()) {
      if (rec.authorizationTicketId === ticketId) {
        return { ...rec };
      }
    }
    return null;
  }
  public async saveExecutionRecord(record: SourceApplyExecutionRecord): Promise<void> {
    this.executions.set(record.executionId, { ...record });
  }

  public async getExecutionRecord(executionId: string): Promise<SourceApplyExecutionRecord | null> {
    const rec = this.executions.get(executionId);
    return rec ? { ...rec } : null;
  }

  public async updateExecutionStatus(executionId: string, status: SourceApplyOperationStatus, error?: string): Promise<void> {
    const rec = this.executions.get(executionId);
    if (rec) {
      rec.status = status;
      rec.updatedAt = Date.now();
      if (error) rec.error = error;
      this.executions.set(executionId, rec);
    }
  }

  public async appendJournalEntry(entry: ApplyJournalEntry): Promise<void> {
    let executionJournal = this.journals.get(entry.executionId);
    if (!executionJournal) {
      executionJournal = new Map<number, ApplyJournalEntry>();
      this.journals.set(entry.executionId, executionJournal);
    }
    executionJournal.set(entry.sequence, { ...entry });
  }

  public async updateJournalEntryStatus(executionId: string, sequence: number, status: ApplyJournalEntry['restoreStatus']): Promise<void> {
    const executionJournal = this.journals.get(executionId);
    if (executionJournal) {
      const entry = executionJournal.get(sequence);
      if (entry) {
        entry.restoreStatus = status;
        if (status === 'RESTORED' || status === 'FAILED' || status === 'NOT_NEEDED') {
          entry.restoredAt = Date.now();
        }
        executionJournal.set(sequence, entry);
      }
    }
  }

  public async getJournalEntries(executionId: string): Promise<ApplyJournalEntry[]> {
    const executionJournal = this.journals.get(executionId);
    if (!executionJournal) return [];
    return Array.from(executionJournal.values()).sort((a, b) => a.sequence - b.sequence).map(e => ({...e}));
  }
}
