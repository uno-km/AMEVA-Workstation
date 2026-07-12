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
  | 'READY'
  | 'RUNNING'
  | 'PAUSING'
  | 'PAUSED'
  | 'WAITING_USER'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

/**
 * Mission의 메타데이터 및 상태를 표현하는 엔티티
 */
export interface MissionExecutionState {
  missionId: string;
  status: MissionStatus;
  activePlanId?: string;
  activePlanVersion?: number;
  
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
