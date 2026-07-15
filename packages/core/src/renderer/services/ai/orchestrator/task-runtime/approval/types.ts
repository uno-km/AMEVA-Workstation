/**
 * @file orchestrator/task-runtime/approval/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Approval Repository Domain Types
 */

import type { ToolRiskLevel } from '../trace/ExecutionTraceTypes';

export type ApprovalRecordStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'CONSUMED';

export interface ApprovalRecord {
  approvalId: string;
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
  requestedAt: number;
  expiresAt: number;
  status: ApprovalRecordStatus;
  approvedBy?: string;
  approvedAt?: number;
  consumedAt?: number;
  singleUse: boolean;
}
