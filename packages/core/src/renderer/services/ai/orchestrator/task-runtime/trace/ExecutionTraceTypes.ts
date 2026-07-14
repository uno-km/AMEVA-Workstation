/**
 * @file orchestrator/task-runtime/trace/ExecutionTraceTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 Execution Trace의 도메인 타입 정의 (TraceEvent, Span, DecisionSummary, ToolExecutionTrace 등)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ExecutionTraceStore: TraceEvent 저장 및 조회
 * - ExecutionTraceManager: Trace 이벤트 생성 및 발송
 * - ExecutionTraceViewModel: UI 렌더링용 변환
 *
 * [Phase 4 — Execution Trace, Tool Observability & User Control 계약]
 * 1. Fake Completion 차단, Mission별 Artifact 격리, Atomic Commit 등 Phase 1~3 계약 유지
 * 2. 원시 Chain-of-Thought(CoT)나 모델의 숨겨진 사고 토큰을 Trace에 저장하거나 UI에 노출 금지
 * 3. Secret 및 민감정보 Redaction 적용
 * 4. Mission 단위 TraceId, Task/Tool Call 단위 SpanId, 단조 증가 SequenceNumber 보장
 */

/**
 * Trace 이벤트 최소 유형 (TraceEventType)
 */
export type TraceEventType =
  | 'mission_started'
  | 'mission_resumed'
  | 'mission_completed'
  | 'mission_failed'
  | 'plan_started'
  | 'plan_created'
  | 'plan_validated'
  | 'plan_rejected'
  | 'task_ready'
  | 'task_started'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_failed'
  | 'task_waiting_user'
  | 'decision_summary_created'
  | 'next_action_selected'
  | 'tool_selection_started'
  | 'tool_selected'
  | 'tool_approval_requested'
  | 'tool_approval_granted'
  | 'tool_approval_rejected'
  | 'tool_execution_started'
  | 'tool_execution_progress'
  | 'tool_execution_completed'
  | 'tool_execution_failed'
  | 'tool_execution_timed_out'
  | 'tool_observation_created'
  | 'artifact_declared'
  | 'artifact_written'
  | 'artifact_validated'
  | 'artifact_committing'
  | 'artifact_committed'
  | 'artifact_rejected'
  | 'artifact_rolled_back'
  | 'verification_stage_started'
  | 'verification_stage_completed'
  | 'verification_defect_found'
  | 'semantic_critic_called'
  | 'semantic_response_invalid'
  | 'verification_passed'
  | 'verification_failed'
  | 'repair_requested'
  | 'repair_scope_selected'
  | 'repair_started'
  | 'repair_completed'
  | 'repair_rejected'
  | 'retry_scheduled'
  | 'retry_stopped_no_progress'
  | 'retry_budget_exhausted'
  | 'checkpoint_created'
  | 'runtime_restored'
  | 'runtime_restore_failed'
  | 'routing_decision_created'
  | 'model_escalated';

/**
 * Trace 가시성 수준
 * USER: 최종 사용자에게 표시
 * OPERATOR: 운영자/심화 사용자에게 표시
 * DEBUG: 디버깅 모드에서 표시
 * INTERNAL: 내부 로직 전용 (원시 CoT나 민감정보는 INTERNAL이라도 저장 금지)
 */
export type TraceVisibility = 'USER' | 'OPERATOR' | 'DEBUG' | 'INTERNAL';

/**
 * Tool 실행 위험도
 */
export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Tool 승인 상태
 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

/**
 * Watchdog 및 Health 상태 분류
 */
export type TraceHealthType = 'PROCESS_HEALTH' | 'INFERENCE_HEALTH' | 'TOOL_HEALTH' | 'MISSION_PROGRESS';
export type TraceHealthState =
  | 'PROCESS_ALIVE'
  | 'MODEL_LOADING'
  | 'PREFILLING'
  | 'DECODING'
  | 'TOOL_RUNNING'
  | 'TOOL_WAITING_APPROVAL'
  | 'STALLED'
  | 'TIMED_OUT'
  | 'PROCESS_DEAD';

/**
 * Tool 선택 전 사용자에게 보여줄 수 있는 Decision Summary
 */
export interface DecisionSummary {
  objective: string;
  knownFacts: string[];
  missingInformation: string[];
  selectedAction: string;
  selectedTool: string;
  selectionReason: string;
  alternativesConsidered: string[];
  rejectionReasons: Record<string, string>;
  expectedOutcome: string;
  riskLevel: ToolRiskLevel;
  approvalRequired: boolean;
  confidence?: number;
  nextStepIfFailed: string;
}

/**
 * Tool 실행 Trace (ToolExecutionTrace)
 */
export interface ToolExecutionTrace {
  toolCallId: string;
  toolName: string;
  toolCategory: string;
  selectionReason: string;
  normalizedArguments: Record<string, any>;
  redactedArgumentKeys: string[];
  riskLevel: ToolRiskLevel;
  approvalRequired: boolean;
  approvalPolicyId?: string;
  approvalStatus?: ApprovalStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  exitCode?: number;
  resultStatus:
    | 'SELECTED'
    | 'APPROVAL_CHECK'
    | 'APPROVED'
    | 'REJECTED'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'TIMED_OUT'
    | 'CANCELLED';
  resultSummary?: string;
  stdoutSummary?: string;
  stderrSummary?: string;
  affectedPaths: string[];
  createdArtifactIds: string[];
  updatedArtifactIds: string[];
  retryable?: boolean;
  errorCode?: string;
}

/**
 * Command 실행 계획 및 결과
 */
export interface CommandPlan {
  executable: string;
  arguments: string[];
  workingDirectory: string;
  environmentKeys: string[];
  timeoutMs: number;
  networkRequired: boolean;
  expectedExitCodes: number[];
  purpose: string;
  riskLevel: ToolRiskLevel;
  approvalRequired: boolean;
}

export interface CommandResult {
  exitCode: number;
  signal?: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  stdoutPreview: string;
  stderrPreview: string;
  outputTruncated: boolean;
  timedOut: boolean;
  cancelled: boolean;
  affectedPaths: string[];
  artifactReferences: string[];
}

/**
 * Artifact 변경 Trace (ArtifactChange)
 */
export interface ArtifactChange {
  artifactId: string;
  kind: string;
  previousRevision?: number;
  newRevision?: number;
  previousHash?: string;
  newHash?: string;
  stagedPath?: string;
  finalPath?: string;
  changedRanges?: Array<{ startLine: number; endLine: number; type: 'added' | 'modified' | 'deleted' }>;
  status: 'DECLARED' | 'STAGED' | 'VALIDATED' | 'COMMITTING' | 'COMMITTED' | 'REJECTED' | 'ROLLED_BACK';
  commitStatus: 'NONE' | 'PENDING' | 'COMMITTED' | 'FAILED';
  rollbackStatus?: 'NONE' | 'ROLLED_BACK' | 'FAILED';
  validationSummary?: string;
}

/**
 * 검증 Trace (VerificationTrace)
 */
export interface VerificationTrace {
  verificationId: string;
  stage: 'DETERMINISTIC' | 'CONTRACT' | 'SEMANTIC';
  verifierName: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  verdict: 'PASS' | 'FAIL' | 'NEEDS_RETRY' | 'SKIPPED';
  score?: number;
  defectCount: number;
  defects: Array<{ signature: string; description: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; location?: string }>;
  semanticCriticCalled: boolean;
  budgetBefore: { retries: number; repairs: number; criticCalls: number };
  budgetAfter: { retries: number; repairs: number; criticCalls: number };
  retryScope?: string[];
  nextAction?: string;
}

/**
 * 재시도/복구 Trace (RetryTrace)
 */
export interface RetryTrace {
  retryNumber: number;
  previousAttemptId?: string;
  newAttemptId: string;
  defectSignatures: string[];
  retryScope: string[];
  strategyId: string;
  progressDelta: number;
  budgetRemaining: { retries: number; repairs: number; criticCalls: number };
  retryReason: string;
  stopReason?: string;
  nextAction: string;
}

/**
 * 사용자 승인 요청 DTO
 */
export interface ApprovalRequest {
  approvalId: string;
  traceId: string;
  missionId: string;
  taskId: string;
  toolCallId: string;
  toolName: string;
  reason: string;
  riskLevel: ToolRiskLevel;
  normalizedArguments: Record<string, any>;
  affectedResources: string[];
  requestedAt: number;
  expiresAt: number;
  status: ApprovalStatus;
  idempotencyKey?: string;
}

/**
 * 최상위 구조화 Execution Trace Event 엔티티
 */
export interface TraceEvent {
  eventId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  missionId: string;
  taskId?: string;
  attemptId?: string;
  timestamp: number;
  eventType: TraceEventType;
  phase?: string;
  status?: string;
  title?: string;
  summary?: string;
  reasonCode?: string;
  durationMs?: number;
  sequenceNumber: number;
  visibility: TraceVisibility;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
  schemaVersion: string; // "4.0.0"

  // 구조화된 서브 객체들
  decision?: DecisionSummary;
  toolExecution?: ToolExecutionTrace;
  commandPlan?: CommandPlan;
  commandResult?: CommandResult;
  artifactChanges?: ReadonlyArray<ArtifactChange>;
  verification?: VerificationTrace;
  retry?: RetryTrace;
  approval?: ApprovalRequest;
  observation?: Record<string, any>;
  nextAction?: { actionType: string; description: string; targetId?: string };
  error?: { errorCode: string; message: string; stack?: string; defectSignature?: string };
  health?: { type: TraceHealthType; state: TraceHealthState; message?: string };
  routingDecision?: any;
  escalation?: any;
}
