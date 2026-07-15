/**
 * @file shared/ipc/sourceApplyIpcContract.ts
 * @system AMEVA OS Desktop Workstation
 * @role Source Apply IPC Communication Interfaces
 */

import type { SourceApplyRequest, SourceApplyPreview, SourceApplyOperation } from '../../renderer/services/ai/orchestrator/task-runtime/apply/types';
import type { RepositoryArtifact } from '../../renderer/services/ai/orchestrator/task-runtime/artifact/repository/types';

export interface IpcCreatePreviewRequest {
  requestId: string;
  missionId: string;
  taskId: string;
  workbenchSessionId: string;
  sourceWorkspaceDigest: string;
  targetArtifact: RepositoryArtifact;
}

export interface IpcCreatePreviewResponse {
  success: boolean;
  preview?: SourceApplyPreview;
  error?: string;
}

export interface IpcExecuteApplyRequest {
  operationId: string;
  applyRequest: SourceApplyRequest;
  preview: SourceApplyPreview;
  targetArtifact: RepositoryArtifact;
  approvalId?: string;
}

export interface IpcExecuteApplyResponse {
  success: boolean;
  operation?: SourceApplyOperation;
  error?: string;
}

export interface IpcRollbackApplyRequest {
  operationId: string;
  rollbackSnapshotId: string;
}

export interface IpcRollbackApplyResponse {
  success: boolean;
  error?: string;
}
