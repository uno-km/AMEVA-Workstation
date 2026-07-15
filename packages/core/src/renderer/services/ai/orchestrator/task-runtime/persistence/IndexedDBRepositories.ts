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

  public async saveApprovalRecord(record: ApprovalRecord): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('approval_records', 'readwrite');
      const req = tx.objectStore('approval_records').put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  public async getApprovalRecord(approvalId: string): Promise<ApprovalRecord | null> {
    const db = await this.getDB();
    const result = await new Promise<ApprovalRecord | null>((resolve, reject) => {
      const tx = db.transaction('approval_records', 'readonly');
      const req = tx.objectStore('approval_records').get(approvalId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }

  public async updateApprovalStatus(approvalId: string, status: ApprovalRecordStatus): Promise<void> {
    const record = await this.getApprovalRecord(approvalId);
    if (!record) throw new Error(`Approval ${approvalId} not found`);
    record.status = status;
    if (status === 'APPROVED' || status === 'REJECTED') {
      record.approvedAt = Date.now();
    }
    if (status === 'CONSUMED') {
      record.consumedAt = Date.now();
    }
    await this.saveApprovalRecord(record);
  }

  public async listPendingApprovals(missionId: string): Promise<ApprovalRecord[]> {
    const db = await this.getDB();
    const results = await new Promise<ApprovalRecord[]>((resolve, reject) => {
      const tx = db.transaction('approval_records', 'readonly');
      const req = tx.objectStore('approval_records').getAll();
      req.onsuccess = () => {
        const all = (req.result as ApprovalRecord[]) ?? [];
        resolve(all.filter(a => a.missionId === missionId && a.status === 'REQUESTED'));
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return results;
  }

  public async compareAndConsumeApproval(approvalId: string, expectedOperationDigest: string, expectedPreviewDigest: string): Promise<boolean> {
    const record = await this.getApprovalRecord(approvalId);
    if (!record || record.status !== 'APPROVED') return false;
    
    if (record.operationDigest !== expectedOperationDigest || record.previewDigest !== expectedPreviewDigest) {
      return false; // Digest mismatch
    }

    if (record.singleUse) {
      await this.updateApprovalStatus(approvalId, 'CONSUMED');
    }
    return true;
  }

  public async expireApprovals(beforeTime: number): Promise<number> {
    const db = await this.getDB();
    let count = 0;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('approval_records', 'readwrite');
      const req = tx.objectStore('approval_records').getAll();
      req.onsuccess = () => {
        const all = (req.result as ApprovalRecord[]) ?? [];
        const toExpire = all.filter(a => a.status === 'REQUESTED' && a.expiresAt < beforeTime);
        for (const record of toExpire) {
          record.status = 'EXPIRED';
          tx.objectStore('approval_records').put(record);
          count++;
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return count;
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
