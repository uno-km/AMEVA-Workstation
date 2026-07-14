/**
 * @file orchestrator/task-runtime/verification/domain/RecoveryTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 실패 후 생성되는 복구(Recovery) 요청 및 정책 관련 타입
 */

export type RecoveryRequestStatus = 
  | 'PENDING'
  | 'DIAGNOSING'
  | 'REPAIRING'
  | 'RETRYING'
  | 'WAITING_USER'
  | 'RESOLVED'
  | 'FAILED'
  | 'CANCELLED';

export type RecoveryAction = 
  | 'RESYNC_STATE'
  | 'RESTORE_RESULT'
  | 'REVERIFY_RESULT'
  | 'REPAIR_RESULT'
  | 'RETRY_SAME_STRATEGY'
  | 'RETRY_DIFFERENT_STRATEGY'
  | 'RESTORE_CHECKPOINT'
  | 'WAIT_FOR_CAPABILITY'
  | 'WAIT_FOR_USER'
  | 'SKIP_OPTIONAL_TASK'
  | 'FAIL_REQUIRED_TASK';

/**
 * Progress Delta 기반 NO_PROGRESS 계산용 지표
 */
export interface ProgressDelta {
  previousArtifactHash?: string;
  currentArtifactHash?: string;
  artifactHashChanged: boolean;
  previousContractCoverage?: number;
  currentContractCoverage?: number;
  contractCoverageDelta: number;
  previousSemanticScore?: number;
  currentSemanticScore?: number;
  semanticScoreDelta: number;
  resolvedDefectCount: number;
  newDefectCount: number;
  repeatedDefectCount: number;
  repeatedRequiredDefectCount: number;
}

/**
 * 정식 RepairRequest (부분 수정 요청)
 */
export interface RepairRequest {
  repairRequestId: string;
  missionId: string;
  taskId: string;
  artifactId?: string;
  sourceRevision?: number;
  sourceContentHash?: string;
  defectSignatures: string[];
  retryScope: string;
  targetSection?: string;
  targetPath?: string;
  repairInstructions: string;
  allowedRanges?: string[];
  protectedRanges?: string[];
  doNotModify?: string[];
  attemptId?: string;
  strategyId?: string;
  idempotencyKey: string;
  createdAt: number;
}

/**
 * Recovery Request 본체
 */
export interface TaskRecoveryRequest {
  recoveryRequestId: string;
  missionId: string;
  planId?: string;
  planVersion?: number;
  taskId: string;
  sourceAttemptId?: string;
  
  failureReason: string; // DependencyFailureReason 등 포함
  failedCriteria?: string[];
  defectSignatures?: string[];
  retryScope?: string;
  targetSection?: string;
  targetPath?: string;
  repairInstructions?: string;
  protectedRanges?: string[];
  doNotModify?: string[];
  
  // Phase 3.1 Progress Tracking
  contentHash?: string;
  semanticScore?: number;
  contractCoverage?: number;
  progressDelta?: ProgressDelta;
  
  status: RecoveryRequestStatus;
  
  retryCount: number;
  recoveryCount: number;
  
  // 상태 로깅
  createdAt: number;
  resolvedAt?: number;
  cancellationReason?: string;
}

/**
 * Recovery Coordinator가 결정한 구체적 액션 정보
 */
export interface RecoveryDecision {
  decisionId: string;
  recoveryRequestId: string;
  missionId: string;
  taskId: string;
  sourceAttemptId?: string;
  
  action: RecoveryAction;
  reason: string;
  repairScope?: string[];
  nextExecutionStrategy?: string;
  requiredCapabilities?: string[];
  
  retryBudgetCost: number;
  recoveryBudgetCost: number;
  
  checkpointReference?: string;
  userPrompt?: string;
  
  createdAt: number;
}
