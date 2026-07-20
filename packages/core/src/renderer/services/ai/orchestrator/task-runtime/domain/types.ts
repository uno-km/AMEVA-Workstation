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
  artifactId?: string;
  path?: string;
  status?: string;
  size?: number;
}

/**
 * 증거(Evidence) 타입
 */
export type MutatingOperationType = 'CREATE' | 'APPEND' | 'PATCH' | 'DELETE' | 'MOVE' | 'READ' | 'UNKNOWN';

export interface ToolResultEvidenceData {
  toolCallId: string;
  toolName: string;
  status: string;
  description: string;
  args?: Record<string, any>;
  taskId?: string;
  missionId?: string;
  operationType?: MutatingOperationType;
  expectedOutputPath?: string;
}

export interface TaskEvidence {
  source: 'tool_result' | 'artifact' | 'observation' | 'user_input' | 'deterministic_check';
  data: any; // ToolResultEvidenceData when source is 'tool_result'
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

export type TaskOutputMode =
  | 'NO_PERSISTED_OUTPUT'
  | 'FILE_OUTPUT_REQUIRED'
  | 'ARTIFACT_OUTPUT_REQUIRED'
  | 'EITHER_FILE_OR_ARTIFACT';

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
  required?: boolean; // Mission 완료를 위한 필수 Task 여부 (PHASE 5.5 추가)
  budgetTurns?: number; // Legacy (최대 1000)
  
  requestedReasoningTurns?: number;
  allocatedReasoningTurns?: number;
  maxDurationMs?: number;
  maxToolCalls?: number;

  // PHASE 2 Planning Extended Fields
  outputMode: TaskOutputMode;
  expectedFileOutputs?: string[];
  expectedArtifactOutputs?: string[];
  acceptanceCriteria?: string[]; // 완료 검수 기준 목록
  capabilityRequirements?: string[]; // 필요한 능력(툴) 목록 (e.g. 'web.search')
  requirementIds?: string[]; // 연결된 원본 사용자 요구사항 ID 목록
  plannerMetadata?: Record<string, any>; // 플래너가 남긴 추가 메타데이터
}

export interface RoutingAffinityState {
  routingDecisionId: string;
  selectedModelId: string;
  selectedRole: string;
  selectedPromptProfile?: string;
  affinityStatus: 'ACTIVE' | 'INVALIDATED';
  invalidationReason?: string;
  previousModelIds: string[];
  failedCombinationDigests: string[];
  privacyLocalRerouteCount: number;
  contextDigest?: string;
  selectedAt: number;
  adapterInstanceId?: string;
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
  /**
   * [Phase 3 — Budget & Limits]
   */
  maxExecutionRetries: number;
  executionRetryCount: number;
  maxSemanticCriticCalls: number;
  semanticCriticCallCount: number;
  routingBudget?: {
    routingDecisionCount: number;
    modelEscalationCount: number;
    modelSwitchCount: number;
    totalModelCallCount: number;
    estimatedTokensUsed: number;
    routingStartedAt: number;
  };
  maxRepairAttempts: number;
  repairAttemptCount: number;
  maxSameDefectRepeats: number;
  sameDefectRepeatCount: number;
  maxTotalVerificationTimeMs: number;
  verificationStartedAt?: number;

  /**
   * [Phase 3 — Progress Tracking]
   */
  previousFailures?: unknown[]; // To store previous defect signatures or hash
  
  /**
   * [Phase 5 — Model Router]
   */
  routingAffinity?: RoutingAffinityState;
  
  metadata?: {
    [key: string]: unknown;
  };

  /**
   * [STAGE E — Recovery 폐루프]
   * RETRY_WAIT 상태에서 재시도가 허용되는 Unix Timestamp(ms).
   * MissionExecutionRuntime의 tick()이 이 값을 확인하여 PENDING으로 전이함.
   * RecoveryCoordinator가 RETRY_WAIT 전이 시 이 값을 설정해야 함.
   */
  retryAfter?: number;
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
    | 'TASK_VERIFICATION_TIMEOUT'
    | 'TASK_REPAIR_REQUESTED'
    | 'TASK_REPAIR_STARTED'
    | 'TASK_REPAIR_COMPLETED'
    | 'TASK_REPAIR_FAILED'
    | 'TASK_RETRY_REQUESTED'
    | 'TASK_RETRY_SCHEDULED'
    | 'TASK_RECOVERY_REQUESTED'
    | 'TASK_RECOVERY_STARTED'
    | 'TASK_RECOVERY_LEVEL_CHANGED'
    | 'TASK_RECOVERY_COMPLETED'
    | 'TASK_RECOVERY_FAILED'
    | 'DEPENDENCY_RECOVERY_REQUESTED'
    | 'STATE_RESYNC_STARTED'
    | 'STATE_RESYNC_COMPLETED'
    | 'CHECKPOINT_RESUME_REQUESTED'
    | 'CHECKPOINT_RESUME_FAILED'
    | 'TASK_BLOCKED'
    | 'TASK_FAILED'
    | 'TASK_WAITING_USER'
    | 'USER_ASSIST_REQUESTED'
    | 'USER_ASSIST_RESPONSE_RECEIVED'
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

/**
 * PHASE 5 Handover Contract
 * Mission 후보 상태 및 종합 결과 전달 DTO
 */
export type CompletionCandidateStatus =
  | 'READY_FOR_COMPLETION_REVIEW'
  | 'PARTIAL_COMPLETION_CANDIDATE'
  | 'MISSION_FAILURE_CANDIDATE'
  | 'WAITING_USER'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface MissionCompletionReviewInput {
  missionId: string;
  goalId?: string;
  goalSpec?: string;
  activePlanId?: string;
  planVersion: number;
  missionExecutionState: any; // MissionExecutionState import 회피(순환참조 등 방지 시 any 또는 Pick)
  allTaskDefinitions: TaskDefinition[];
  allTaskRuntimeStates: TaskRuntimeState[];
  successfulTaskResults: TaskResult[];
  taskVerificationResults: TaskVerificationResult[];
  failedRequiredTasks: TaskEntity[];
  failedOptionalTasks: TaskEntity[];
  skippedOptionalTasks: TaskEntity[];
  blockedTasks: TaskEntity[];
  waitingUserTasks: TaskEntity[];
  requirementCoverageResults?: any[];
  deliverableCoverageResults?: any[];
  evidenceSummary?: any[];
  finalArtifactReferences?: string[];
  totalReasoningTurns: number;
  totalToolCalls: number;
  totalAttempts: number;
  totalRepairs: number;
  totalRetries: number;
  totalRecoveries: number;
  recoveryHistorySummary?: any[];
  warnings: string[];
  unresolvedIssues: string[];
  toolRuntimeStatus: 'FULLY_CONNECTED' | 'PARTIALLY_CONNECTED' | 'DISABLED_SAFELY' | 'MOCK_ONLY' | 'BROKEN';
  completionCandidateStatus: CompletionCandidateStatus;
  createdAt: number;
}

export * from '../trace/ExecutionTraceTypes';
