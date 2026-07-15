/**
 * @file orchestrator/task-runtime/artifact/repository/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Artifact Repository Domain Types
 */

export type ArtifactStatus = 
  | 'REGISTERING'
  | 'AVAILABLE'
  | 'QUARANTINED'
  | 'STALE'
  | 'CORRUPTED'
  | 'SUPERSEDED'
  | 'ARCHIVED'
  | 'DELETED';

export type ArtifactApplyStatus =
  | 'NOT_APPLIED'
  | 'APPLYING'
  | 'APPLIED'
  | 'FAILED'
  | 'ROLLED_BACK';

export interface ArtifactProvenance {
  producerType: 'CODE_WORKBENCH' | 'DOCUMENT_WORKBENCH' | 'RULE_ENGINE' | 'USER_UPLOAD' | 'IMPORTED_ARTIFACT';
  producerId: string;
  modelId?: string;
  modelRole?: string;
  workbenchType?: string;
  workbenchSessionId?: string;
  sourceRevision?: string;
  sourceDigest?: string;
  outputRevision?: string;
  generatorName?: string;
  generatorVersion?: string;
  generatorCapability?: string;
  generationExecutionProvenance?: string;
  extractorName?: string;
  extractorVersion?: string;
  extractorCapability?: string;
  extractionExecutionProvenance?: string;
  verificationPolicyVersion?: string;
  createdByTaskId?: string;
  createdAt: number;
}

export interface VerificationSummary {
  passed: boolean;
  checks: { name: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; reason?: string }[];
}

export interface RepositoryArtifact {
  repositoryArtifactId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  workbenchSessionId: string;
  sourceArtifactId: string;
  artifactKind: string;
  artifactFormat: string;
  logicalPath: string;
  storageReference: string;
  revision: number;
  parentRevision?: number;
  contentHash: string;
  sizeBytes: number;
  mimeType: string;
  status: ArtifactStatus;
  provenance: ArtifactProvenance;
  verificationSummary?: VerificationSummary;
  sourceApplyStatus: ArtifactApplyStatus;
  createdAt: number;
  updatedAt: number;
  committedAt: number;
}

export interface ArtifactRetentionMetadata {
  repositoryArtifactId: string;
  missionId: string;
  isAppliedRevision: boolean;
  isRollbackTarget: boolean;
  isLegalHold: boolean;
  expiresAt?: number;
}
