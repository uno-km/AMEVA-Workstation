/**
 * @file orchestrator/task-runtime/domain/types.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task Domain Model 및 타입 계약의 단일 진실 공급원
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskStateMachine.ts: 상태 전이 검증 시 사용
 * - TaskEventLog.ts: 상태 전이 이벤트 생성 및 기록 시 사용
 * - TaskRuntimeStore.ts: 코어 런타임 상태 보관에 사용
 */

/**
 * Task의 현재 상태 (11단계 엄격 분리)
 */
export type TaskStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'VERIFYING'
  | 'RETRY_WAIT'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'WAITING_USER';

/**
 * 검증 결과 판정 등급
 */
export type VerificationVerdict =
  | 'PASS'
  | 'RETRY'
  | 'NEEDS_REPAIR'
  | 'BLOCKED'
  | 'NEEDS_USER'
  | 'FAIL';

/**
 * TaskResult의 Output 타입 확장 가능 설계
 */
export interface TaskOutput {
  type: 'text' | 'structured_data' | 'file' | 'analysis' | 'decision' | 'tool_output' | 'reference';
  content: any;
}

/**
 * 증거(Evidence) 타입
 */
export interface TaskEvidence {
  source: 'tool_result' | 'artifact' | 'observation' | 'user_input' | 'deterministic_check';
  data: any;
  timestamp: number;
}

/**
 * TaskExecution Result
 */
export interface TaskResult {
  attemptId: string;
  createdAt: number;
  status: TaskStatus;
  summary: string;
  outputs: TaskOutput[];
  evidence: TaskEvidence[];
  unresolvedIssues?: string[];
  metrics?: Record<string, number>;
}

/**
 * Verification Result
 */
export interface TaskVerificationResult {
  verificationId: string;
  taskId: string;
  attemptId: string;
  verdict: VerificationVerdict;
  score?: number;
  passedCriteria: string[];
  failedCriteria: string[];
  warnings?: string[];
  repairInstructions?: string;
  verifierType: 'deterministic' | 'semantic' | 'user';
  createdAt: number;
}

/**
 * 실패 및 에러 정보 객체
 */
export interface TaskFailure {
  errorType: string;
  message: string;
  stack?: string;
  timestamp: number;
}

/**
 * Task Attempt (개별 실행 시도 인스턴스)
 */
export interface TaskAttempt {
  attemptId: string;
  taskId: string;
  sequence: number; // 0, 1, 2...
  status: TaskStatus;
  executionId?: string;
  startedAt?: number;
  finishedAt?: number;
  reasoningTurns: number; // Legacy
  toolCallCount: number; // Legacy
  recoveryCount: number; // Legacy
  consumedReasoningTurns?: number;
  consumedDurationMs?: number;
  consumedToolCalls?: number;
  consumedRecoveries?: number;
  failure?: TaskFailure;
  resultReference?: TaskResult;
}

/**
 * 1. TaskDefinition
 * - Task가 무엇을 해야 하는지 표현하는 정적인 데이터
 */
export interface TaskDefinition {
  id: string; // taskId
  missionId?: string; // 소속 미션 ID (PHASE 2)
  planId?: string; // 소속 계획 ID (PHASE 2)
  title: string;
  objective: string; // 설명 및 목표
  dependencies: string[]; // 선행 taskId 목록
  priority?: number;
  budgetTurns?: number; // Legacy (최대 1000)
  
  requestedReasoningTurns?: number;
  allocatedReasoningTurns?: number;
  maxDurationMs?: number;
  maxToolCalls?: number;

  // PHASE 2 Planning Extended Fields
  expectedOutputs?: string[]; // 기대 산출물 목록
  acceptanceCriteria?: string[]; // 완료 검수 기준 목록
  capabilityRequirements?: string[]; // 필요한 능력(툴) 목록 (e.g. 'web.search')
  requirementIds?: string[]; // 연결된 원본 사용자 요구사항 ID 목록
  plannerMetadata?: Record<string, any>; // 플래너가 남긴 추가 메타데이터
}

/**
 * 2. TaskRuntimeState
 * - 실행 중 지속적으로 변하는 상태 및 결과 데이터
 */
export interface TaskRuntimeState {
  status: TaskStatus;
  activeAttemptId?: string;
  attempts: Record<string, TaskAttempt>; // 모든 시도 기록
  stateVersion: number; // 동시성 제어 (Optimistic Concurrency)
  retries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  blockReason?: string; // BLOCKED 상태일 때 원인
  lastFailure?: TaskFailure;
  taskResult?: TaskResult; // COMPLETED 시 최종 결과
  verification?: TaskVerificationResult; // COMPLETED 전이 시 PASS 객체 필수
}

/**
 * 전체 Task 엔티티 (정적 정의 + 동적 상태)
 */
export interface TaskEntity {
  definition: TaskDefinition;
  state: TaskRuntimeState;
}

/**
 * 이벤트 로그 기록용 데이터
 */
export interface TaskEvent {
  eventId: string;
  sessionId: string;
  taskId: string;
  attemptId?: string;
  type:
    | 'TASK_REGISTERED'
    | 'TASK_READY'
    | 'TASK_STARTED'
    | 'TASK_RESULT_SUBMITTED'
    | 'TASK_VERIFICATION_STARTED'
    | 'TASK_VERIFICATION_PASSED'
    | 'TASK_VERIFICATION_FAILED'
    | 'TASK_RETRY_REQUESTED'
    | 'TASK_BLOCKED'
    | 'TASK_FAILED'
    | 'TASK_WAITING_USER'
    | 'TASK_SKIPPED'
    | 'TASK_CANCELLED'
    | 'TASK_STATE_TRANSITION_REJECTED'
    | 'LEGACY_TASK_IMPORTED'
    | 'LEGACY_STATUS_MIGRATION_WARNING';
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  reason: string;
  actor: string; // e.g., 'orchestrator', 'user', 'supervisor', 'verifier'
  timestamp: number;
  stateVersion: number;
  metadata?: Record<string, any>;
}

/**
 * 상태 전이를 위한 Command 규약
 */
export interface TransitionCommand {
  commandId: string;
  missionId: string;
  taskId: string;
  attemptId?: string;
  expectedCurrentStatus: TaskStatus; // 기대하는 현재 상태 (불일치 시 거부)
  expectedStateVersion: number; // 기대하는 stateVersion (낙관적 락)
  idempotencyKey?: string; // 멱등성 보장 키
  reason: string;
  actor: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
