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
  repairInstructions?: string;
  
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
