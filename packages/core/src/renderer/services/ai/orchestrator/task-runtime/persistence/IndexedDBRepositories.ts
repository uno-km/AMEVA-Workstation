/**
 * @file orchestrator/task-runtime/persistence/IndexedDBRepositories.ts
 * @system AMEVA OS Desktop Workstation
 * @role IndexedDB Implementations for Phase 6.4 Repositories
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
import type {
  ApprovalPersistenceResult,
  ApprovalReservationInput,
  ApprovalConsumptionInput,
  ApprovalReservationReleaseInput,
  ApprovalInvalidationInput
} from '../approval/types';

/**
 * 헬퍼 함수 타입 (IndexedDB 연결 헬퍼 주입용)
 */
export type IDBProvider = () => Promise<IDBDatabase>;

export class ArtifactRepositoryIndexedDB implements IArtifactRepositoryPersistence {
  constructor(private readonly getDB: IDBProvider) {}

  public async saveRepositoryArtifact(artifact: RepositoryArtifact): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('artifact_repository', 'readwrite');
      const req = tx.objectStore('artifact_repository').put(artifact);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getRepositoryArtifact(repositoryArtifactId: string): Promise<RepositoryArtifact | null> {
    const db = await this.getDB();
    const result = await new Promise<RepositoryArtifact | null>((resolve, reject) => {
      const tx = db.transaction('artifact_repository', 'readonly');
      const req = tx.objectStore('artifact_repository').get(repositoryArtifactId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async listRepositoryArtifacts(missionId: string): Promise<RepositoryArtifact[]> {
    const db = await this.getDB();
    const results = await new Promise<RepositoryArtifact[]>((resolve, reject) => {
      const tx = db.transaction('artifact_repository', 'readonly');
      const req = tx.objectStore('artifact_repository').getAll();
      req.onsuccess = () => {
        const all = (req.result as RepositoryArtifact[]) ?? [];
        resolve(all.filter(a => a.missionId === missionId));
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return results;
  }

  public async updateArtifactStatus(repositoryArtifactId: string, status: ArtifactStatus): Promise<void> {
    const artifact = await this.getRepositoryArtifact(repositoryArtifactId);
    if (!artifact) throw new Error(`Artifact ${repositoryArtifactId} not found`);
    artifact.status = status;
    artifact.updatedAt = Date.now();
    await this.saveRepositoryArtifact(artifact);
  }

  public async saveRetentionMetadata(metadata: ArtifactRetentionMetadata): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('artifact_retention_metadata', 'readwrite');
      const req = tx.objectStore('artifact_retention_metadata').put(metadata);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getRetentionMetadata(repositoryArtifactId: string): Promise<ArtifactRetentionMetadata | null> {
    const db = await this.getDB();
    const result = await new Promise<ArtifactRetentionMetadata | null>((resolve, reject) => {
      const tx = db.transaction('artifact_retention_metadata', 'readonly');
      const req = tx.objectStore('artifact_retention_metadata').get(repositoryArtifactId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }
}

export class ApprovalRepositoryIndexedDB implements IApprovalRepositoryPersistence {
  constructor(private readonly getDB: IDBProvider) {}

  public async saveApprovalRecord(record: ApprovalRecord): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('approval_records', 'readwrite');
        const req = tx.objectStore('approval_records').put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
      return { success: true, record: { ...record } };
    } finally {
      db.close();
    }
  }

  public async getApprovalRecord(approvalId: string): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    try {
      const result = await new Promise<ApprovalRecord | null>((resolve, reject) => {
        const tx = db.transaction('approval_records', 'readonly');
        const req = tx.objectStore('approval_records').get(approvalId);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      if (!result) return { success: false, errorCode: 'APPROVAL_NOT_FOUND', retryable: false };
      return { success: true, record: result };
    } finally {
      db.close();
    }
  }

  public async getAuthorizationTicket(ticketId: string): Promise<import('../approval/types').ApprovalAuthorizationTicket | null> {
    // Stub implementation
    return null;
  }

  public async updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<ApprovalPersistenceResult> {
    const res = await this.getApprovalRecord(approvalId);
    if (!res.success || !res.record) return res;
    
    const record = res.record;
    record.status = status;
    record.updatedAt = Date.now();
    if (status === 'APPROVED' || status === 'REJECTED') {
      record.approvedAt = record.updatedAt;
    }
    if (status === 'CONSUMED') {
      record.consumedAt = record.updatedAt;
    }
    return this.saveApprovalRecord(record);
  }

  public async compareAndReserveApproval(input: ApprovalReservationInput): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult>((resolve) => {
      const tx = db.transaction(['approval_records', 'approval_authorization_tickets'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');
      const storeTickets = tx.objectStore('approval_authorization_tickets');

      const req = storeRecords.get(input.approvalId);
      
      let finalResult: ApprovalPersistenceResult | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      req.onsuccess = () => {
        const record = req.result as ApprovalRecord | undefined;
        if (!record) return abortWith('APPROVAL_NOT_FOUND');
        
        if (record.status === 'RESERVED') return abortWith('APPROVAL_ALREADY_RESERVED');
        if (record.status === 'CONSUMED') return abortWith('APPROVAL_ALREADY_CONSUMED');
        if (record.status !== 'APPROVED') return abortWith('APPROVAL_STATE_TRANSITION_INVALID');
        
        if (record.expiresAt <= input.now) return abortWith('APPROVAL_EXPIRED');

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
          return abortWith('APPROVAL_CONTEXT_MISMATCH');
        }

        const ticketId = `ticket_${crypto.randomUUID()}`;
        record.status = 'RESERVED';
        record.reservedAt = input.now;
        record.reservedByOperationId = input.sourceApplyOperationId;
        record.updatedAt = input.now;

        const ticket: import('../approval/types').ApprovalAuthorizationTicket = {
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

        const putReq1 = storeRecords.put(record);
        putReq1.onerror = () => abortWith('TRANSACTION_FAILED');
        const putReq2 = storeTickets.put(ticket);
        putReq2.onerror = () => abortWith('TRANSACTION_FAILED');

        if (!aborted) {
          finalResult = { success: true, record: { ...record }, ticket: { ...ticket } };
        }
      };

      req.onerror = () => {
        abortWith('TRANSACTION_FAILED');
      };

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }

  public async compareAndConsumeApproval(input: ApprovalConsumptionInput): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult>((resolve) => {
      const tx = db.transaction(['approval_records', 'approval_authorization_tickets'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');
      const storeTickets = tx.objectStore('approval_authorization_tickets');

      const reqRecord = storeRecords.get(input.approvalId);
      
      let finalResult: ApprovalPersistenceResult | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      reqRecord.onsuccess = () => {
        const record = reqRecord.result as ApprovalRecord | undefined;
        if (!record) return abortWith('APPROVAL_NOT_FOUND');
        
        if (record.status === 'CONSUMED') return abortWith('APPROVAL_ALREADY_CONSUMED');
        if (record.status !== 'RESERVED') return abortWith('APPROVAL_STATE_TRANSITION_INVALID');
        
        if (record.reservedByOperationId !== input.expectedReservedByOperationId || record.reservedByOperationId !== input.sourceApplyOperationId) {
          return abortWith('APPROVAL_RESERVATION_OWNER_MISMATCH');
        }

        if (record.sourceDigest !== input.sourceDigest ||
            record.previewDigest !== input.previewDigest ||
            record.operationDigest !== input.operationDigest ||
            record.affectedPathsDigest !== input.affectedPathsDigest) {
          return abortWith('APPROVAL_CONTEXT_MISMATCH');
        }

        if (record.expiresAt <= input.now) return abortWith('APPROVAL_EXPIRED');

        const reqTicket = storeTickets.get(input.authorizationTicketId);
        reqTicket.onsuccess = () => {
          const ticket = reqTicket.result as import('../approval/types').ApprovalAuthorizationTicket | undefined;
          if (!ticket) return abortWith('APPROVAL_NOT_FOUND');
          if (ticket.status !== 'RESERVED') return abortWith('APPROVAL_STATE_TRANSITION_INVALID');

          record.status = 'CONSUMED';
          record.consumedAt = input.now;
          record.updatedAt = input.now;
          
          ticket.status = 'CONSUMED';

          const putReq1 = storeRecords.put(record);
          putReq1.onerror = () => abortWith('TRANSACTION_FAILED');
          const putReq2 = storeTickets.put(ticket);
          putReq2.onerror = () => abortWith('TRANSACTION_FAILED');

          if (!aborted) {
            finalResult = { success: true, record: { ...record }, ticket: { ...ticket } };
          }
        };
        reqTicket.onerror = () => abortWith('TRANSACTION_FAILED');
      };

      reqRecord.onerror = () => {
        abortWith('TRANSACTION_FAILED');
      };

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }

  public async releaseApprovalReservation(input: ApprovalReservationReleaseInput): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult>((resolve) => {
      const tx = db.transaction(['approval_records', 'approval_authorization_tickets'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');
      const storeTickets = tx.objectStore('approval_authorization_tickets');

      const reqRecord = storeRecords.get(input.approvalId);
      let finalResult: ApprovalPersistenceResult | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      reqRecord.onsuccess = () => {
        const record = reqRecord.result as ApprovalRecord | undefined;
        if (!record) return abortWith('APPROVAL_NOT_FOUND');
        
        if (record.status !== 'RESERVED') return abortWith('APPROVAL_STATE_TRANSITION_INVALID');
        if (record.reservedByOperationId !== input.sourceApplyOperationId) return abortWith('APPROVAL_RESERVATION_OWNER_MISMATCH');

        const reqTicket = storeTickets.get(input.authorizationTicketId);
        reqTicket.onsuccess = () => {
          const ticket = reqTicket.result as import('../approval/types').ApprovalAuthorizationTicket | undefined;
          if (!ticket) return abortWith('APPROVAL_NOT_FOUND');
          
          record.status = 'RELEASED';
          record.releasedAt = input.now;
          record.updatedAt = input.now;
          
          ticket.status = 'RELEASED';

          const putReq1 = storeRecords.put(record);
          putReq1.onerror = () => abortWith('TRANSACTION_FAILED');
          const putReq2 = storeTickets.put(ticket);
          putReq2.onerror = () => abortWith('TRANSACTION_FAILED');

          if (!aborted) {
            finalResult = { success: true, record: { ...record }, ticket: { ...ticket } };
          }
        };
        reqTicket.onerror = () => abortWith('TRANSACTION_FAILED');
      };

      reqRecord.onerror = () => abortWith('TRANSACTION_FAILED');

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }

  public async invalidateApproval(input: ApprovalInvalidationInput): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult>((resolve) => {
      const tx = db.transaction(['approval_records', 'approval_authorization_tickets'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');
      const storeTickets = tx.objectStore('approval_authorization_tickets');

      const reqRecord = storeRecords.get(input.approvalId);
      let finalResult: ApprovalPersistenceResult | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      reqRecord.onsuccess = () => {
        const record = reqRecord.result as ApprovalRecord | undefined;
        if (!record) return abortWith('APPROVAL_NOT_FOUND');
        
        if (record.status === 'CONSUMED' || record.status === 'INVALIDATED') {
          return abortWith('APPROVAL_STATE_TRANSITION_INVALID');
        }

        record.status = 'INVALIDATED';
        record.invalidatedAt = input.now;
        record.invalidationReason = input.invalidationReason;
        record.updatedAt = input.now;

        const putReq1 = storeRecords.put(record);
        putReq1.onerror = () => abortWith('TRANSACTION_FAILED');

        if (input.authorizationTicketId) {
          const reqTicket = storeTickets.get(input.authorizationTicketId);
          reqTicket.onsuccess = () => {
            const ticket = reqTicket.result as import('../approval/types').ApprovalAuthorizationTicket | undefined;
            if (ticket) {
              ticket.status = 'INVALIDATED';
              const putReq2 = storeTickets.put(ticket);
              putReq2.onerror = () => abortWith('TRANSACTION_FAILED');
              if (!aborted) {
                finalResult = { success: true, record: { ...record }, ticket: { ...ticket } };
              }
            } else {
              if (!aborted) {
                finalResult = { success: true, record: { ...record } };
              }
            }
          };
          reqTicket.onerror = () => abortWith('TRANSACTION_FAILED');
        } else {
          if (!aborted) {
            finalResult = { success: true, record: { ...record } };
          }
        }
      };

      reqRecord.onerror = () => abortWith('TRANSACTION_FAILED');

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }

  public async revokeApproval(approvalId: string, reason?: string): Promise<ApprovalPersistenceResult> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult>((resolve) => {
      const tx = db.transaction(['approval_records'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');

      const reqRecord = storeRecords.get(approvalId);
      let finalResult: ApprovalPersistenceResult | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      reqRecord.onsuccess = () => {
        const record = reqRecord.result as ApprovalRecord | undefined;
        if (!record) return abortWith('APPROVAL_NOT_FOUND');
        
        if (record.status === 'CONSUMED' || record.status === 'RESERVED') {
          return abortWith('APPROVAL_STATE_TRANSITION_INVALID');
        }

        record.status = 'REVOKED';
        record.updatedAt = Date.now();

        const putReq = storeRecords.put(record);
        putReq.onerror = () => abortWith('TRANSACTION_FAILED');

        if (!aborted) {
          finalResult = { success: true, record: { ...record } };
        }
      };

      reqRecord.onerror = () => abortWith('TRANSACTION_FAILED');

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }

  public async listPendingApprovals(filter?: { missionId?: string; workbenchSessionId?: string }): Promise<ApprovalPersistenceResult<ApprovalRecord[]>> {
    const db = await this.getDB();
    try {
      const results = await new Promise<ApprovalRecord[]>((resolve, reject) => {
        const tx = db.transaction('approval_records', 'readonly');
        const req = tx.objectStore('approval_records').getAll();
        req.onsuccess = () => {
          const all = (req.result as ApprovalRecord[]) ?? [];
          resolve(all.filter(a => 
            a.status === 'REQUESTED' && 
            (!filter?.missionId || a.missionId === filter.missionId) &&
            (!filter?.workbenchSessionId || a.workbenchSessionId === filter.workbenchSessionId)
          ));
        };
        req.onerror = () => reject(req.error);
      });
      return { success: true, data: results };
    } finally {
      db.close();
    }
  }

  public async expireApprovals(now: number): Promise<ApprovalPersistenceResult<number>> {
    const db = await this.getDB();
    return new Promise<ApprovalPersistenceResult<number>>((resolve) => {
      const tx = db.transaction(['approval_records'], 'readwrite');
      const storeRecords = tx.objectStore('approval_records');

      const reqAll = storeRecords.getAll();
      let finalResult: ApprovalPersistenceResult<number> | null = null;
      let aborted = false;

      const abortWith = (errorCode: string) => {
        aborted = true;
        finalResult = { success: false, errorCode, retryable: false };
        tx.abort();
      };

      reqAll.onsuccess = () => {
        const records = reqAll.result as ApprovalRecord[];
        let count = 0;
        
        for (const record of records) {
          if ((record.status === 'REQUESTED' || record.status === 'APPROVED') && record.expiresAt <= now) {
            record.status = 'EXPIRED';
            record.updatedAt = now;
            storeRecords.put(record);
            count++;
          }
        }

        if (!aborted) {
          finalResult = { success: true, data: count };
        }
      };

      reqAll.onerror = () => abortWith('TRANSACTION_FAILED');

      tx.oncomplete = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'UNKNOWN_ERROR' });
      };

      tx.onerror = () => {
        db.close();
        if (!aborted) resolve({ success: false, errorCode: 'TRANSACTION_FAILED', retryable: false });
      };

      tx.onabort = () => {
        db.close();
        resolve(finalResult ?? { success: false, errorCode: 'TRANSACTION_ABORTED', retryable: false });
      };
    });
  }
}

export class SourceApplyRepositoryIndexedDB implements ISourceApplyRepositoryPersistence {
  constructor(private readonly getDB: IDBProvider) {}

  public async saveSourceApplyRequest(request: SourceApplyRequest): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('source_apply_requests', 'readwrite');
      const req = tx.objectStore('source_apply_requests').put(request);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getSourceApplyRequest(requestId: string): Promise<SourceApplyRequest | null> {
    const db = await this.getDB();
    const result = await new Promise<SourceApplyRequest | null>((resolve, reject) => {
      const tx = db.transaction('source_apply_requests', 'readonly');
      const req = tx.objectStore('source_apply_requests').get(requestId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async saveSourceApplyPreview(preview: SourceApplyPreview): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('source_apply_previews', 'readwrite');
      const req = tx.objectStore('source_apply_previews').put(preview);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getSourceApplyPreview(requestId: string): Promise<SourceApplyPreview | null> {
    const db = await this.getDB();
    const result = await new Promise<SourceApplyPreview | null>((resolve, reject) => {
      const tx = db.transaction('source_apply_previews', 'readonly');
      const req = tx.objectStore('source_apply_previews').get(requestId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async saveSourceApplyOperation(operation: SourceApplyOperation): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('source_apply_operations', 'readwrite');
      const req = tx.objectStore('source_apply_operations').put(operation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getSourceApplyOperation(operationId: string): Promise<SourceApplyOperation | null> {
    const db = await this.getDB();
    const result = await new Promise<SourceApplyOperation | null>((resolve, reject) => {
      const tx = db.transaction('source_apply_operations', 'readonly');
      const req = tx.objectStore('source_apply_operations').get(operationId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async updateSourceApplyOperation(operation: SourceApplyOperation): Promise<void> {
    operation.updatedAt = Date.now();
    await this.saveSourceApplyOperation(operation);
  }

  public async saveRollbackSnapshotReference(reference: RollbackSnapshotReference): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('rollback_snapshots', 'readwrite');
      const req = tx.objectStore('rollback_snapshots').put(reference);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getRollbackSnapshotReference(snapshotId: string): Promise<RollbackSnapshotReference | null> {
    const db = await this.getDB();
    const result = await new Promise<RollbackSnapshotReference | null>((resolve, reject) => {
      const tx = db.transaction('rollback_snapshots', 'readonly');
      const req = tx.objectStore('rollback_snapshots').get(snapshotId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async saveApplyVerificationResult(result: ApplyVerificationResult): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('apply_verifications', 'readwrite');
      const req = tx.objectStore('apply_verifications').put(result);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }
}
