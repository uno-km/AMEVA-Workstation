/**
 * @file orchestrator/task-runtime/completion/domain/MissionCompletionTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role Mission의 최종 완료 판정 결과, 스냅샷, 리포트 생성을 위한 도메인 타입
 */

export type MissionOutcome =
  | 'SUCCESS'
  | 'SUCCESS_WITH_WARNINGS'
  | 'PARTIAL_SUCCESS'
  | 'WAITING_USER'
  | 'BLOCKED'
  | 'FAILED'
  | 'CANCELLED';

export type CompletionConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNDETERMINED';

export interface CompletionConfidence {
  overallConfidence: number; // 0 ~ 100
  componentScores: Record<string, number>;
  penalties: Record<string, number>;
  confidenceBand: CompletionConfidenceBand;
  rationale: string;
}

export interface GoalCoverageSummary {
  goalId: string;
  requirementResults: RequirementResult[];
  deliverableResults: DeliverableResult[];
  taskCompletionRate: number; // 0 ~ 100
  requiredTaskCompletionRate: number; // 0 ~ 100
}

export interface RequirementResult {
  requirementId: string;
  required: boolean;
  sourceText: string;
  producerTaskIds: string[];
  verifiedResultIds: string[];
  deliverableIds: string[];
  finalArtifactReferences: string[];
  status: 'SATISFIED' | 'PARTIALLY_SATISFIED' | 'UNSATISFIED' | 'UNVERIFIABLE' | 'BLOCKED' | 'NEEDS_USER';
  evidenceReferences: string[];
  warnings: string[];
  unresolvedIssues: string[];
}

export interface DeliverableResult {
  deliverableId: string;
  required: boolean;
  producerTaskId: string;
  resultId: string;
  artifactReference: string;
  format?: string;
  schema?: any;
  exists: boolean;
  accessible: boolean;
  nonEmpty: boolean;
  verified: boolean;
  latestRevision: boolean;
  integrity: boolean;
  warnings: string[];
}

export interface FinalArtifactReference {
  artifactId: string;
  referencePath: string;
  type: string; // e.g., 'TEXT', 'FILE', 'JSON'
  taskId: string;
  resultId: string;
  createdAt: number;
}

export interface RecoverySummary {
  totalAttempts: number;
  totalRepairs: number;
  totalRetries: number;
  totalRecoveries: number;
  successRate: number;
}

export interface MissionCompletionDecision {
  decisionId: string;
  reviewId: string;
  missionId: string;
  goalId?: string;
  planId?: string;
  planVersion: number;
  snapshotVersion: number;
  outcome: MissionOutcome;
  completionConfidence: CompletionConfidence;
  goalCoverage: GoalCoverageSummary;
  taskCompletionRate: number;
  requiredTaskCompletionRate: number;
  requirementResults: RequirementResult[];
  deliverableResults: DeliverableResult[];
  finalArtifactReferences: FinalArtifactReference[];
  warnings: string[];
  unresolvedIssues: string[];
  failedRequiredTaskIds: string[];
  failedOptionalTaskIds: string[];
  skippedTaskIds: string[];
  waitingUserTaskIds: string[];
  recoverySummary: RecoverySummary;
  budgetSummary: any; // Record<string, any> or specific budget interface
  reasonCodes: string[];
  createdAt: number;
  decisionVersion: number;
  idempotencyKey: string;
}

export interface MissionCompletionSnapshot {
  missionId: string;
  goalId?: string;
  planId?: string;
  planVersion: number;
  outcome: MissionOutcome;
  completionDecisionId: string;
  taskStateSummary: Record<string, any>;
  resultReferences: string[];
  verificationReferences: string[];
  artifactReferences: string[];
  budgetSummary: Record<string, any>;
  recoverySummary: RecoverySummary;
  unresolvedIssues: string[];
  createdAt: number;
  finalizedAt?: number;
  schemaVersion: number;
  integrityDigest: string;
}
