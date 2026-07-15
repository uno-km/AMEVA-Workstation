/**
 * @file orchestrator/task-runtime/approval/ApprovalResolver.ts
 * @system AMEVA OS Desktop Workstation
 * @role Facade for Approval Record Management
 */

import type { IApprovalRepositoryPersistence } from '../../persistence/RepositoryInterfaces';
import type { ApprovalRecord, ApprovalRecordStatus } from './types';
import type { ToolRiskLevel } from '../trace/ExecutionTraceTypes';

export class ApprovalResolver {
  constructor(private readonly persistence: IApprovalRepositoryPersistence) {}

  public async requestApproval(
    params: {
      missionId: string;
      taskId: string;
      workbenchSessionId: string;
      requestType: string;
      operationDigest: string;
      previewDigest: string;
      artifactId?: string;
      artifactRevision?: number;
      sourceWorkspaceDigest?: string;
      affectedPaths: string[];
      riskLevel: ToolRiskLevel;
      singleUse?: boolean;
    }
  ): Promise<ApprovalRecord> {
    const approvalId = `appr-${crypto.randomUUID()}`;
    const record: ApprovalRecord = {
      approvalId,
      missionId: params.missionId,
      taskId: params.taskId,
      workbenchSessionId: params.workbenchSessionId,
      requestType: params.requestType,
      operationDigest: params.operationDigest,
      previewDigest: params.previewDigest,
      artifactId: params.artifactId,
      artifactRevision: params.artifactRevision,
      sourceWorkspaceDigest: params.sourceWorkspaceDigest,
      affectedPaths: params.affectedPaths,
      riskLevel: params.riskLevel,
      requestedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      status: 'REQUESTED',
      singleUse: params.singleUse ?? true
    };

    await this.persistence.saveApprovalRecord(record);
    return record;
  }

  public async resolveApproval(
    approvalId: string, 
    status: 'APPROVED' | 'REJECTED' | 'REVOKED', 
    approvedBy?: string
  ): Promise<void> {
    const record = await this.persistence.getApprovalRecord(approvalId);
    if (!record) throw new Error(`Approval ${approvalId} not found`);

    if (record.status !== 'REQUESTED') {
      throw new Error(`Approval ${approvalId} is already in status ${record.status}`);
    }

    record.status = status;
    if (status === 'APPROVED' || status === 'REJECTED') {
      record.approvedAt = Date.now();
      if (approvedBy) {
        record.approvedBy = approvedBy;
      }
    }
    await this.persistence.saveApprovalRecord(record);
  }

  public async getApprovalStatus(approvalId: string): Promise<ApprovalRecordStatus | null> {
    const record = await this.persistence.getApprovalRecord(approvalId);
    return record ? record.status : null;
  }

  public async listPendingApprovals(missionId: string): Promise<ApprovalRecord[]> {
    return this.persistence.listPendingApprovals(missionId);
  }

  public async consumeApproval(approvalId: string, expectedOperationDigest: string, expectedPreviewDigest: string): Promise<boolean> {
    return this.persistence.compareAndConsumeApproval(approvalId, expectedOperationDigest, expectedPreviewDigest);
  }
}
