/**
 * @file orchestrator/task-runtime/apply/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Source Apply Domain Types
 */

export type ApplyMode = 
  | 'PATCH'
  | 'ADD_FILE'
  | 'REPLACE_FILE'
  | 'DELETE_FILE'
  | 'MULTI_FILE_TRANSACTION';

export type ConflictType =
  | 'BASE_REVISION_MISMATCH'
  | 'SOURCE_DIGEST_MISMATCH'
  | 'FILE_HASH_MISMATCH'
  | 'TARGET_FILE_MISSING'
  | 'TARGET_FILE_ALREADY_EXISTS'
  | 'PROTECTED_PATH_CONFLICT'
  | 'RANGE_CONFLICT'
  | 'CONCURRENT_APPLY_CONFLICT'
  | 'ARTIFACT_STALE'
  | 'ARTIFACT_CORRUPTED';

export type SourceApplyOperationStatus =
  | 'DECLARED'
  | 'PREVIEWING'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'REVALIDATING'
  | 'SNAPSHOTTING'
  | 'APPLYING'
  | 'VERIFYING'
  | 'COMMITTING'
  | 'APPLIED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'CONFLICT'
  | 'FAILED'
  | 'INTERRUPTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface SourceApplyRequest {
  sourceApplyRequestId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  sessionCapabilityToken?: string;
  repositoryArtifactId: string;
  artifactRevision: number;
  sourceWorkspaceReference: string;
  expectedBaseRevision?: string;
  expectedSourceDigest: string;
  expectedArtifactDigest: string;
  affectedPaths: string[];
  protectedPaths: string[];
  applyMode: ApplyMode;
  conflictPolicy: 'FAIL' | 'OVERWRITE_IF_APPROVED';
  requiredChecks: string[];
  approvalId?: string;
  operationDigest: string;
  idempotencyKey: string;
  requestedAt: number;
}

export type SourceApplyPreviewStatus =
  | 'CREATING'
  | 'READY'
  | 'STALE'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'CORRUPTED';

export interface SourceApplyPreview {
  previewId: string;
  sourceApplyRequestId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  repositoryArtifactId: string;
  artifactRevision: number;
  sourceWorkspaceId: string;
  baseRevision?: string;
  currentSourceRevision?: string;
  sourceDigest: string;
  artifactDigest: string;
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  renamedCandidates: string[];
  changedSymbols: string[];
  changedRanges: { file: string; startLine: number; endLine: number }[];
  affectedPaths: string[];
  protectedPathViolations: string[];
  conflicts: ConflictType[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredChecks: string[];
  rollbackPlanDigest?: string;
  previewDigest: string;
  policyVersion: number;
  status: SourceApplyPreviewStatus;
  createdAt: number;
  expiresAt: number;
  invalidatedAt?: number;
  invalidationReason?: string;
  schemaVersion: number;
}

export interface SourceApplyOperation {
  operationId: string;
  requestId: string;
  missionId: string;
  status: SourceApplyOperationStatus;
  startedAt: number;
  updatedAt: number;
  error?: string;
  appliedFileHashes?: Record<string, string>;
  finalSourceDigest?: string;
  verificationResultId?: string;
  rollbackSnapshotId?: string;
}

export interface RollbackSnapshotReference {
  rollbackSnapshotId: string;
  operationId: string;
  sourceWorkspaceReference: string;
  sourceRevision?: string;
  sourceDigest: string;
  affectedFiles: string[];
  fileHashes: Record<string, string>;
  storageReference: string;
  createdAt: number;
  verified: boolean;
  expiresAt: number;
}

export interface ApplyVerificationResult {
  verificationId: string;
  operationId: string;
  appliedRevision?: string;
  appliedSourceDigest: string;
  fileResults: { file: string; passed: boolean; error?: string }[];
  checkResults: { check: string; passed: boolean; error?: string }[];
  artifactMatch: boolean;
  protectedPathsIntact: boolean;
  unexpectedChanges: string[];
  passed: boolean;
  failureReason?: string;
  verifiedAt: number;
}
