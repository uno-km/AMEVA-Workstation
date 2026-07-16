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
  | 'APPLY_AUTHORIZED'
  | 'PRE_EXECUTE_REVALIDATING'
  | 'SNAPSHOTTING'
  | 'PRE_APPLY_ABORT'
  | 'APPLYING'
  | 'APPLY_WRITTEN_PENDING_VERIFICATION'
  | 'VERIFYING'
  | 'VERIFIED_PENDING_CONSUME'
  | 'VERIFY_FAILED'
  | 'CONSUMING_APPROVAL'
  | 'CONSUME_FAILED'
  | 'APPLIED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED'
  | 'QUARANTINED'
  | 'CONFLICT'
  | 'FAILED'
  | 'INTERRUPTED'
  | 'REJECTED'
  | 'EXPIRED';

export interface ApplyJournalEntry {
  executionId: string;
  sequence: number;           
  targetPath: string;             // Raw provided path
  normalizedPath: string;         // Absolute resolved path
  operation: 'CREATE' | 'MODIFY' | 'DELETE';
  existedBefore: boolean;         // Did the file exist prior to snapshot?
  fileTypeBefore: 'FILE' | 'SYMLINK' | 'DIR' | 'NONE';
  snapshotPath: string;           // Backup location (e.g., tmpdir)
  replaceTempPath: string;        // Staging location (same volume)
  beforeDigest: string | null;
  intendedAfterDigest: string;
  appliedAt: number | null;
  restoredAt: number | null;
  restoreStatus: 'PENDING' | 'RESTORED' | 'FAILED' | 'NOT_NEEDED';
}

export interface WorkspaceExecutionLease {
  workspaceRoot: string;
  executionId: string;
  leaseOwner: string;
  acquiredAt: number;
  expiresAt: number;
}

export const WorkspaceBlockFlag = {
  QUARANTINED: 'QUARANTINED',
  QUARANTINE_CONSUME_PENDING: 'QUARANTINE_CONSUME_PENDING'
} as const;
export type WorkspaceBlockFlag = typeof WorkspaceBlockFlag[keyof typeof WorkspaceBlockFlag];

export interface SourceApplyExecutionRecord {
  executionId: string;
  authorizationTicketId: string;
  workspaceRoot: string;
  status: SourceApplyOperationStatus;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

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

// --- Phase 6.4.3 Artifact Query & Retention ---

export type ArtifactQueryView = 'REDACTED' | 'INTERNAL';

export interface ArtifactQueryRequest {
  executionId?: string;
  approvalId?: string;
  authorizationTicketId?: string;
  missionId?: string;
  workspaceRoot?: string;
  artifactRevision?: number;
  viewType: ArtifactQueryView;
}

export type ArtifactQueryErrorCode = 
  | 'QUERY_NOT_FOUND'
  | 'QUERY_ACCESS_DENIED'
  | 'QUERY_INVALID_VIEW'
  | 'QUERY_INVALID_KEY'
  | 'QUERY_STATE_NOT_AVAILABLE';

export interface ArtifactQueryResponse {
  success: boolean;
  errorCode?: ArtifactQueryErrorCode;
  viewType: ArtifactQueryView;
  data?: {
    executionStatus?: SourceApplyOperationStatus;
    artifactMetadata?: any;
    traceReport?: any;
    snapshotInfo?: any;
    failureReason?: string;
    quarantineDetails?: any;
    rollbackSummary?: any;
    retentionInfo?: any;
  };
}

export const RetentionPolicy = {
  IMMEDIATE: 'IMMEDIATE',
  SEVEN_DAYS: 'SEVEN_DAYS',
  NINETY_DAYS: 'NINETY_DAYS',
  INDEFINITE: 'INDEFINITE',
  PERMANENT: 'PERMANENT'
} as const;
export type RetentionPolicy = typeof RetentionPolicy[keyof typeof RetentionPolicy];

export interface RetentionEvaluationResult {
  shouldCleanupSnapshot: boolean;
  shouldArchive: boolean;
  shouldPreserveIndefinitely: boolean;
  requiresManualIntervention: boolean;
  reason: string;
  nextReviewAt?: number;
}

export interface BenchmarkMetrics {
  durationMs: number;
  memoryUsage?: number;
  parallelCount?: number;
  success: boolean;
  errorCategory?: string;
  scenarioName?: string;
  artifactCount?: number;
  fileCount?: number;
  fixtureSizeBytes?: number;
}

export interface FinalReleaseGateReport {
  missionId: string;
  executionStatus: string;
  isCleanExecution: boolean;
  containsQuarantine: boolean;
  reconciliationTriggered: boolean;
  benchmarkPassed: boolean;
  retentionValidated: boolean;
  queryValidated: boolean;
  regressionPassed: boolean;
  tscPassed: boolean;
  gitClean: boolean;
  summaryMarkdown: string;
  canonicalJson: any;
  traces: any[];
}
