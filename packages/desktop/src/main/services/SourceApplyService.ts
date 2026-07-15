/**
 * @file main/services/SourceApplyService.ts
 * @system AMEVA OS Desktop Workstation
 * @role Main Process Source Apply Execution Service
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';

import type { SourceApplyRequest, SourceApplyPreview, SourceApplyOperation, ConflictType, ApplyMode } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types';
import type { RepositoryArtifact } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/artifact/repository/types';
import type { IApprovalRepositoryPersistence, IArtifactRepositoryPersistence, ISourceApplyRepositoryPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces';
import type { ApprovalRecord, ApprovalAuthorizationTicket } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/approval/types';
import { SourceApplyDigestService } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/SourceApplyDigestService';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager';
import type { IpcAuthorizeSourceApplyRequest, IpcAuthorizeSourceApplyResponse } from '../../../../core/src/shared/ipc/sourceApplyIpcContract';

export class SourceApplyService {
  constructor(
    private readonly approvalRepo: IApprovalRepositoryPersistence,
    private readonly previewRepo: ISourceApplyRepositoryPersistence,
    private readonly artifactRepo: IArtifactRepositoryPersistence,
    private readonly traceManager: ExecutionTraceManager
  ) {}

  public async authorizeOperation(
    request: IpcAuthorizeSourceApplyRequest,
    session: any
  ): Promise<IpcAuthorizeSourceApplyResponse> {
    const traceContext = {
      correlationId: crypto.randomUUID(),
      approvalId: request.approvalId,
      previewId: request.previewId
    };

    try {
      this.traceManager.emitTrace(request.missionId, 'AUTHORIZATION_REQUESTED', 'SourceApplyService', traceContext);

      // 1. Re-query Approval Repository
      const approval = await this.approvalRepo.getApprovalRecord(request.approvalId);
      if (!approval) {
        this.emitAuthFailure(request.missionId, traceContext, 'APPROVAL_NOT_FOUND');
        return { success: false, errorCode: 'APPROVAL_NOT_FOUND', errorMessage: 'Approval record not found.' };
      }

      if (approval.status === 'INVALIDATED') {
        this.emitAuthFailure(request.missionId, traceContext, 'APPROVAL_INVALIDATED');
        return { success: false, errorCode: 'APPROVAL_INVALIDATED', errorMessage: 'Approval has been invalidated.' };
      }

      // 2. Re-query Preview and Artifact
      const preview = await this.previewRepo.getPreview(request.previewId);
      if (!preview) {
        return { success: false, errorCode: 'DIGEST_MISMATCH', errorMessage: 'Preview not found.' };
      }

      const artifact = await this.artifactRepo.getRepositoryArtifact(request.repositoryArtifactId);
      
      // 3. Artifact Validation Hardening
      if (!artifact || artifact.missionId !== request.missionId || artifact.revision !== request.artifactRevision) {
        this.emitAuthFailure(request.missionId, traceContext, 'ARTIFACT_MISMATCH');
        return { success: false, errorCode: 'ARTIFACT_MISMATCH', errorMessage: 'Artifact validation failed.' };
      }

      // 4. Approval-Preview-Artifact Linking Hardening
      if (approval.previewId !== request.previewId || preview.repositoryArtifactId !== artifact.repositoryArtifactId) {
         this.emitAuthFailure(request.missionId, traceContext, 'DIGEST_MISMATCH');
         return { success: false, errorCode: 'DIGEST_MISMATCH', errorMessage: 'Linkage validation failed.' };
      }

      // 5. Capability Token Hard Validation
      if (
        approval.missionId !== request.missionId ||
        approval.taskId !== request.taskId ||
        approval.attemptId !== request.attemptId ||
        approval.workbenchSessionId !== request.workbenchSessionId
      ) {
         this.emitAuthFailure(request.missionId, traceContext, 'CAPABILITY_INVALID');
         return { success: false, errorCode: 'CAPABILITY_INVALID', errorMessage: 'Capability token binding mismatch.' };
      }

      // 6. Full Digest Recomputation (MANDATORY)
      const allowedWorkspaceRoot = session.allowedWorkspaceRoot;
      const actualSourceDigest = await SourceApplyDigestService.computeSourceDigest(allowedWorkspaceRoot, preview.affectedPaths);
      
      if (actualSourceDigest !== approval.sourceDigest) {
         // STALE detection
         await this.previewRepo.updatePreviewStatus(request.previewId, 'STALE');
         await this.approvalRepo.invalidateApproval({
            approvalId: request.approvalId,
            invalidationReason: 'SOURCE_DIGEST_MISMATCH',
            currentSourceDigest: actualSourceDigest,
            now: Date.now()
         });
         this.emitAuthFailure(request.missionId, traceContext, 'PREVIEW_STALE');
         return { success: false, errorCode: 'PREVIEW_STALE', errorMessage: 'Preview is stale.' };
      }

      const recomputedPreviewDigest = SourceApplyDigestService.computePreviewDigest(preview);
      const recomputedOperationDigest = SourceApplyDigestService.computeOperationDigest(preview);
      const recomputedAffectedPathsDigest = SourceApplyDigestService.computeAffectedPathsDigest(preview.affectedPaths);
      const recomputedArtifactDigest = SourceApplyDigestService.computeArtifactDigest(artifact.revision, artifact.contentHash);

      if (
        recomputedPreviewDigest !== approval.previewDigest ||
        recomputedOperationDigest !== approval.operationDigest ||
        recomputedAffectedPathsDigest !== approval.affectedPathsDigest ||
        recomputedArtifactDigest !== approval.artifactDigest
      ) {
         await this.approvalRepo.invalidateApproval({
            approvalId: request.approvalId,
            invalidationReason: 'DIGEST_MISMATCH',
            now: Date.now()
         });
         this.emitAuthFailure(request.missionId, traceContext, 'DIGEST_MISMATCH');
         return { success: false, errorCode: 'DIGEST_MISMATCH', errorMessage: 'Digest recomputation mismatch.' };
      }

      // 7. Atomic Consumption
      const reserveResult = await this.approvalRepo.compareAndReserveApproval({
         approvalId: request.approvalId,
         sourceApplyRequestId: request.sourceApplyRequestId,
         sourceApplyOperationId: request.sourceApplyOperationId,
         missionId: request.missionId,
         taskId: request.taskId,
         attemptId: request.attemptId,
         workbenchSessionId: request.workbenchSessionId,
         repositoryArtifactId: request.repositoryArtifactId,
         artifactRevision: request.artifactRevision,
         sourceWorkspaceId: request.sourceWorkspaceReference,
         sourceDigest: actualSourceDigest,
         previewDigest: recomputedPreviewDigest,
         operationDigest: recomputedOperationDigest,
         affectedPathsDigest: recomputedAffectedPathsDigest,
         riskLevel: approval.riskLevel,
         now: Date.now()
      });

      if (!reserveResult.success) {
         this.emitAuthFailure(request.missionId, traceContext, 'APPROVAL_INVALIDATED');
         return { success: false, errorCode: 'APPROVAL_INVALIDATED', errorMessage: 'Atomic reservation failed.' };
      }

      this.traceManager.emitTrace(request.missionId, 'AUTHORIZATION_GRANTED', 'SourceApplyService', {
        ...traceContext,
        result: 'SUCCESS'
      });

      return {
        success: true,
        authorizationTicketId: reserveResult.ticket!.ticketId
      };

    } catch (e: any) {
      this.emitAuthFailure(request.missionId, traceContext, 'DIGEST_MISMATCH');
      return { success: false, errorCode: 'DIGEST_MISMATCH', errorMessage: e.message };
    }
  }

  private emitAuthFailure(missionId: string, context: any, reasonCode: string) {
    this.traceManager.emitTrace(missionId, 'AUTHORIZATION_VALIDATION_FAILED', 'SourceApplyService', {
      ...context,
      result: 'FAIL',
      reasonCode
    });
  }

  public async executeApply(): Promise<any> {
    throw new Error('Phase 6.4.1B Required');
  }

  public async rollbackApply(): Promise<any> {
    throw new Error('Phase 6.4.1B Required');
  }

  public async createPreview(): Promise<any> {
     throw new Error('Preview creation moved to Renderer Phase');
  }
}
