/**
 * @file orchestrator/task-runtime/domain/ExecutionTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role 실행(Execution) 런타임에 필요한 최상위 도메인 타입 (Mission, Attempt, Lease)
 */

/**
 * Mission의 전체 실행 상태 생명주기
 */
export type MissionStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'PLAN_APPROVED'
  | 'READY'
  | 'RUNNING'
  | 'PAUSING'
  | 'PAUSED'
  | 'WAITING_VERIFICATION'
  | 'VERIFYING'
  | 'RECOVERING'
  | 'WAITING_USER'
  | 'BLOCKED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'READY_FOR_COMPLETION_REVIEW'
  | 'FINALIZING'
  | 'SUCCESS'
  | 'SUCCESS_WITH_WARNINGS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'COMPLETED'
  | 'PARTIAL';

/**
 * Mission의 메타데이터 및 상태를 표현하는 엔티티
 */
export interface MissionExecutionState {
  missionId: string;
  status: MissionStatus;
  activePlanId?: string;
  activePlanVersion?: number;
  stateVersion: number;
  
  // Mission 레벨 예산 (Budget)
  budget: {
    maxReasoningTurns: number;
    consumedReasoningTurns: number;
    reservedReasoningTurns: number; // Task에 할당되었으나 미소비(미확정)된 턴
    maxDurationMs: number;
    consumedDurationMs: number;
    maxToolCalls: number;
    consumedToolCalls: number;
    maxRecoveries: number;
    consumedRecoveries: number;
  };

  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  cancellationReason?: string;
}

/**
 * Task 실행 소유권을 보장하는 Lease (락)
 */
export interface TaskLease {
  leaseId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  executionId: string;
  ownerId: string;       // e.g., 'TaskDispatcher', 'DeepTaskExecutor-Worker1'
  acquiredAt: number;
  expiresAt: number;
  renewedAt: number;
  stateVersion: number;
  planVersion: number;
}

/**
 * 백그라운드로 기동된 실행 컨텍스트(Promise)를 관리하기 위한 핸들
 */
export interface ExecutionHandle {
  executionId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  promise: Promise<void>;
  abortController: AbortController;
  startedAt: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  leaseId?: string;
  budgetReservationId?: string;
}

/**
 * Scheduler가 감지하는 Deadlock의 세부분류
 */
export type DeadlockClassification =
  | 'WAITING_VERIFICATION'
  | 'WAITING_DEPENDENCY_RECOVERY'
  | 'WAITING_CAPABILITY'
  | 'WAITING_BUDGET'
  | 'WAITING_USER'
  | 'RETRY_DELAY'
  | 'LEASE_EXPIRED'
  | 'PLAN_STATE_INVALID'
  | 'TRUE_DEADLOCK'
  | 'INTERNAL_ERROR';

/**
 * Dependency 실패 원인 구조화
 */
export type DependencyFailureReason =
  | 'DEPENDENCY_NOT_COMPLETED'
  | 'DEPENDENCY_RESULT_MISSING'
  | 'DEPENDENCY_VERIFICATION_NOT_PASS'
  | 'DEPENDENCY_ATTEMPT_MISMATCH'
  | 'DEPENDENCY_PLAN_VERSION_MISMATCH'
  | 'DEPENDENCY_RESULT_INVALIDATED'
  | 'DEPENDENCY_TASK_FAILED'
  | 'DEPENDENCY_TASK_CANCELLED'
  | 'DEPENDENCY_TASK_SKIPPED';
