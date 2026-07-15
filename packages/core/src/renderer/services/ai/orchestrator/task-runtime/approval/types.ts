/**
 * @file orchestrator/task-runtime/approval/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Approval Repository Domain Types
 */

import type { ToolRiskLevel } from '../trace/ExecutionTraceTypes';

export type ApprovalRecordStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'RESERVED'
  | 'RELEASED'
  | 'CONSUMED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'INVALIDATED';

export interface ApprovalRecordBase {
  approvalId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  repositoryArtifactId: string;
  artifactRevision: number;
  sourceWorkspaceId: string;
  previewId: string;
  sourceDigest: string;
  previewDigest: string;
  operationDigest: string;
  affectedPathsDigest: string;
  artifactDigest: string;
  riskLevel: ToolRiskLevel;
  requestType: string;
  status: ApprovalRecordStatus;
  requestedAt: number;
  expiresAt: number;
  singleUse: boolean;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;

  approvedBy?: string;
  approvedAt?: number;
  reservedAt?: number;
  reservedByOperationId?: string;
  consumedAt?: number;
  releasedAt?: number;
  invalidatedAt?: number;
  invalidationReason?: string;
}

export interface RequestedApprovalRecord extends ApprovalRecordBase {
  status: 'REQUESTED';
}

export interface ApprovedApprovalRecord extends ApprovalRecordBase {
  status: 'APPROVED';
  approvedBy: string;
  approvedAt: number;
}

export interface ReservedApprovalRecord extends ApprovalRecordBase {
  status: 'RESERVED';
  approvedBy: string;
  approvedAt: number;
  reservedAt: number;
  reservedByOperationId: string;
}

export interface ConsumedApprovalRecord extends ApprovalRecordBase {
  status: 'CONSUMED';
  approvedBy: string;
  approvedAt: number;
  reservedAt: number;
  reservedByOperationId: string;
  consumedAt: number;
}

export interface InvalidatedApprovalRecord extends ApprovalRecordBase {
  status: 'INVALIDATED';
  invalidatedAt: number;
  invalidationReason: string;
}

export type ApprovalRecord =
  | RequestedApprovalRecord
  | ApprovedApprovalRecord
  | ReservedApprovalRecord
  | ConsumedApprovalRecord
  | InvalidatedApprovalRecord
  | (ApprovalRecordBase & { status: 'RELEASED' | 'REJECTED' | 'EXPIRED' | 'REVOKED' });

export type AuthorizationTicketStatus =
  | 'RESERVED'
  | 'RELEASED'
  | 'CONSUMED'
  | 'INVALIDATED'
  | 'EXPIRED';

export interface ApprovalAuthorizationTicket {
  authorizationTicketId: string;
  approvalId: string;
  sourceApplyRequestId: string;
  sourceApplyOperationId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  repositoryArtifactId: string;
  artifactRevision: number;
  sourceWorkspaceId: string;
  sourceDigest: string;
  previewDigest: string;
  operationDigest: string;
  affectedPathsDigest: string;
  riskLevel: ToolRiskLevel;
  reservedAt: number;
  expiresAt: number;
  status: AuthorizationTicketStatus;
  schemaVersion: number;
}

export interface ApprovalPersistenceResult<T = void> {
  success: boolean;
  errorCode?: string;
  retryable?: boolean;
  record?: ApprovalRecord;
  ticket?: ApprovalAuthorizationTicket;
  data?: T;
}

export interface ApprovalReservationInput {
  approvalId: string;
  sourceApplyRequestId: string;
  sourceApplyOperationId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  repositoryArtifactId: string;
  artifactRevision: number;
  sourceWorkspaceId: string;
  sourceDigest: string;
  previewDigest: string;
  operationDigest: string;
  affectedPathsDigest: string;
  riskLevel: ToolRiskLevel;
  now: number;
}

export interface ApprovalConsumptionInput {
  approvalId: string;
  authorizationTicketId: string;
  sourceApplyOperationId: string;
  expectedReservedByOperationId: string;
  sourceDigest: string;
  previewDigest: string;
  operationDigest: string;
  affectedPathsDigest: string;
  now: number;
}

export interface ApprovalReservationReleaseInput {
  approvalId: string;
  authorizationTicketId: string;
  sourceApplyOperationId: string;
  releaseReason: string;
  now: number;
}

export interface ApprovalInvalidationInput {
  approvalId: string;
  authorizationTicketId?: string;
  sourceApplyOperationId?: string;
  invalidationReason: string;
  currentSourceDigest?: string;
  currentPreviewDigest?: string;
  now: number;
}
