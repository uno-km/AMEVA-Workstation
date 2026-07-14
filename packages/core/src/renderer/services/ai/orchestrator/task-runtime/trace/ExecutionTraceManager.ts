/**
 * @file orchestrator/task-runtime/trace/ExecutionTraceManager.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 Execution Trace 생성 및 발송을 총괄하는 고수준 매니저
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionExecutionRuntime: Mission 시작/완료/중단 이벤트 발송
 * - TaskDispatcher & DeepTaskExecutor: Task 시작/완료/도구 실행/관찰 이벤트 발송
 * - ArtifactTransactionManager: Artifact 변경 및 트랜잭션 커밋/롤백 이벤트 발송
 * - TaskVerifierCoordinator & RecoveryCoordinator: 검증/재시도 이벤트 발송
 *
 * [핵심 책임]
 * 1. Span 계층 (Mission Span -> Task Span -> Tool/Verification Span) 자동 연결
 * 2. Decision Summary 및 Tool Call Life Cycle 이벤트 생성
 * 3. Secret Redaction 강제 및 Raw CoT 필터링
 */

import type {
  TraceEvent,
  TraceEventType,
  TraceVisibility,
  ToolRiskLevel,
  DecisionSummary,
  ToolExecutionTrace,
  CommandPlan,
  CommandResult,
  ArtifactChange,
  VerificationTrace,
  RetryTrace,
  ApprovalRequest
} from './ExecutionTraceTypes';
import { ExecutionTraceStore } from './ExecutionTraceStore';
import { ToolApprovalPolicy } from '../policy/ToolApprovalPolicy';

export class ExecutionTraceManager {
  private store: ExecutionTraceStore;

  constructor(store?: ExecutionTraceStore) {
    this.store = store ?? new ExecutionTraceStore();
  }

  public getStore(): ExecutionTraceStore {
    return this.store;
  }

  /**
   * Mission 시작 이벤트 기록
   */
  public recordMissionStarted(missionId: string, goalSpec: string): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `span-m-${missionId}`;
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_mstart`,
      traceId: missionId,
      spanId,
      missionId,
      timestamp: Date.now(),
      eventType: 'mission_started',
      status: 'RUNNING',
      title: 'Mission Started',
      summary: `Mission '${missionId}' started for goal: ${goalSpec.slice(0, 120)}`,
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      metadata: { goalSpec }
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Task 시작 이벤트 기록
   */
  public recordTaskStarted(missionId: string, taskId: string, attemptId: string, title?: string): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `span-t-${taskId}-${attemptId}`;
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_tstart`,
      traceId: missionId,
      spanId,
      parentSpanId: `span-m-${missionId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType: 'task_started',
      status: 'RUNNING',
      title: title ?? `Task ${taskId} Started`,
      summary: `Task '${taskId}' execution started (Attempt ${attemptId}).`,
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0'
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Decision Summary 생성 이벤트 기록 (Tool 선택 이유, 목표, 대안 등)
   */
  public recordDecisionSummary(
    missionId: string,
    taskId: string,
    attemptId: string,
    decision: DecisionSummary
  ): TraceEvent {
    let validDecision = decision;
    const isValid = decision &&
      typeof decision.objective === 'string' &&
      Array.isArray(decision.knownFacts) &&
      Array.isArray(decision.missingInformation) &&
      typeof decision.selectedAction === 'string' &&
      typeof decision.selectedTool === 'string' &&
      typeof decision.selectionReason === 'string' &&
      typeof decision.expectedOutcome === 'string' &&
      typeof decision.riskLevel === 'string' &&
      typeof decision.approvalRequired === 'boolean' &&
      typeof decision.nextStepIfFailed === 'string';

    if (!isValid) {
      validDecision = {
        objective: decision?.objective || 'Execute current task objective',
        knownFacts: Array.isArray(decision?.knownFacts) ? decision.knownFacts : [],
        missingInformation: Array.isArray(decision?.missingInformation) ? decision.missingInformation : [],
        selectedAction: decision?.selectedAction || (decision?.selectedTool ? `Execute ${decision.selectedTool}` : 'Execute tool action'),
        selectedTool: decision?.selectedTool || 'unknown_tool',
        selectionReason: decision?.selectionReason || 'Safe fallback decision summary due to schema validation failure.',
        alternativesConsidered: Array.isArray(decision?.alternativesConsidered) ? decision.alternativesConsidered : [],
        rejectionReasons: typeof decision?.rejectionReasons === 'object' && decision.rejectionReasons !== null ? decision.rejectionReasons : {},
        expectedOutcome: decision?.expectedOutcome || 'Advance task state safely.',
        riskLevel: decision?.riskLevel || 'HIGH',
        approvalRequired: decision?.approvalRequired ?? true,
        nextStepIfFailed: decision?.nextStepIfFailed || 'Review failure observation and retry or escalate.'
      };

      const fallbackNoticeSeq = this.store.nextSequenceNumber(missionId);
      this.store.appendEvent({
        eventId: `${missionId}_${fallbackNoticeSeq}_dec_fallback`,
        traceId: missionId,
        spanId: `span-t-${taskId}-${attemptId}`,
        parentSpanId: `span-m-${missionId}`,
        missionId,
        taskId,
        attemptId,
        timestamp: Date.now(),
        eventType: 'decision_summary_fallback_used',
        status: 'WARNING',
        title: 'DecisionSummary Schema Validation Failed - Fallback Used',
        summary: 'DecisionSummary failed validation. Safe fallback summary applied; raw LLM response suppressed.',
        sequenceNumber: fallbackNoticeSeq,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0'
      });
    }

    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `span-t-${taskId}-${attemptId}`;
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_dec`,
      traceId: missionId,
      spanId,
      parentSpanId: `span-m-${missionId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType: 'decision_summary_created',
      status: 'DECIDED',
      title: `Tool Selection Decision: ${validDecision.selectedTool}`,
      summary: validDecision.selectionReason,
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      decision: validDecision
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Tool 선택 이벤트 기록 (SELECTED -> APPROVAL_CHECK)
   */
  public recordToolSelected(
    missionId: string,
    taskId: string,
    attemptId: string,
    toolCallId: string,
    toolName: string,
    toolCategory: string,
    selectionReason: string,
    args: Record<string, any>,
    definition?: any
  ): { traceEvent: TraceEvent; toolTrace: ToolExecutionTrace } {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = toolCallId;
    const parentSpanId = `span-t-${taskId}-${attemptId}`;

    const { riskLevel, approvalRequired } = ToolApprovalPolicy.evaluateRisk(toolName, args, definition);

    const toolTrace: ToolExecutionTrace = {
      toolCallId,
      toolName,
      toolCategory,
      selectionReason,
      normalizedArguments: args,
      redactedArgumentKeys: [],
      riskLevel,
      approvalRequired,
      startedAt: Date.now(),
      resultStatus: 'SELECTED',
      affectedPaths: [],
      createdArtifactIds: [],
      updatedArtifactIds: []
    };

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_tselect_${toolCallId}`,
      traceId: missionId,
      spanId,
      parentSpanId,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType: 'tool_selected',
      status: 'SELECTED',
      title: `Tool Selected: ${toolName}`,
      summary: selectionReason || `Selected tool '${toolName}' (${riskLevel} risk).`,
      sequenceNumber: seq,
      visibility: 'USER',
      severity: riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'HIGH' : 'LOW',
      schemaVersion: '4.0.0',
      toolExecution: toolTrace
    };

    this.store.appendEvent(ev);
    return { traceEvent: ev, toolTrace };
  }

  /**
   * 승인 요청 이벤트 기록
   */
  public recordApprovalRequested(
    missionId: string,
    taskId: string,
    attemptId: string,
    toolCallId: string,
    toolName: string,
    riskLevel: ToolRiskLevel,
    args: Record<string, any>,
    affectedResources: string[],
    reason: string
  ): ApprovalRequest {
    const req = ToolApprovalPolicy.createApprovalRequest(
      missionId,
      missionId,
      taskId,
      toolCallId,
      toolName,
      riskLevel,
      args,
      affectedResources,
      reason
    );

    const seq = this.store.nextSequenceNumber(missionId);
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_appr_req_${toolCallId}`,
      traceId: missionId,
      spanId: toolCallId,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType: 'tool_approval_requested',
      status: 'PENDING',
      title: `Approval Requested: ${toolName} (${riskLevel})`,
      summary: reason,
      sequenceNumber: seq,
      visibility: 'USER',
      severity: riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
      schemaVersion: '4.0.0',
      approval: req
    };
    this.store.appendEvent(ev);
    return req;
  }

  /**
   * Tool 실행 시작 이벤트 기록
   */
  public recordToolExecutionStarted(
    missionId: string,
    taskId: string,
    attemptId: string,
    toolTrace: ToolExecutionTrace
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    toolTrace.resultStatus = 'RUNNING';
    toolTrace.startedAt = Date.now();

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_trun_${toolTrace.toolCallId}`,
      traceId: missionId,
      spanId: toolTrace.toolCallId,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: toolTrace.startedAt,
      eventType: 'tool_execution_started',
      status: 'RUNNING',
      title: `Tool Running: ${toolTrace.toolName}`,
      summary: `Executing tool '${toolTrace.toolName}'...`,
      sequenceNumber: seq,
      visibility: 'OPERATOR',
      schemaVersion: '4.0.0',
      toolExecution: toolTrace
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Tool 실행 완료 (터미널 이벤트 - 성공/실패/타임아웃) 기록
   */
  public recordToolExecutionTerminal(
    missionId: string,
    taskId: string,
    attemptId: string,
    toolTrace: ToolExecutionTrace,
    status: 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED',
    summary: string,
    opts?: { exitCode?: number; stdoutSummary?: string; stderrSummary?: string; errorCode?: string; affectedPaths?: string[] }
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const now = Date.now();
    toolTrace.resultStatus = status;
    toolTrace.completedAt = now;
    toolTrace.durationMs = now - toolTrace.startedAt;
    toolTrace.resultSummary = summary;
    if (opts?.exitCode !== undefined) toolTrace.exitCode = opts.exitCode;
    if (opts?.stdoutSummary !== undefined) toolTrace.stdoutSummary = opts.stdoutSummary;
    if (opts?.stderrSummary !== undefined) toolTrace.stderrSummary = opts.stderrSummary;
    if (opts?.errorCode !== undefined) toolTrace.errorCode = opts.errorCode;
    if (opts?.affectedPaths) toolTrace.affectedPaths = opts.affectedPaths;

    let eventType: TraceEventType = 'tool_execution_completed';
    if (status === 'FAILED') eventType = 'tool_execution_failed';
    if (status === 'TIMED_OUT') eventType = 'tool_execution_timed_out';

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_term_${toolTrace.toolCallId}`,
      traceId: missionId,
      spanId: toolTrace.toolCallId,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: now,
      eventType,
      status,
      title: `Tool ${status}: ${toolTrace.toolName}`,
      summary,
      durationMs: toolTrace.durationMs,
      sequenceNumber: seq,
      visibility: 'USER',
      severity: status === 'FAILED' || status === 'TIMED_OUT' ? 'HIGH' : 'LOW',
      schemaVersion: '4.0.0',
      toolExecution: toolTrace
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Command 실행 계획/결과 이벤트 기록
   */
  public recordCommandExecution(
    missionId: string,
    taskId: string,
    attemptId: string,
    plan: CommandPlan,
    result: CommandResult
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `cmd-${crypto.randomUUID()}`;
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_cmd_${spanId}`,
      traceId: missionId,
      spanId,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: result.completedAt,
      eventType: result.exitCode === 0 ? 'tool_execution_completed' : 'tool_execution_failed',
      status: result.exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
      title: `Command: ${plan.executable}`,
      summary: `Command exited with code ${result.exitCode} (${result.durationMs}ms)`,
      durationMs: result.durationMs,
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      commandPlan: plan,
      commandResult: result
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Artifact 변경 이벤트 기록
   */
  public recordArtifactChange(
    missionId: string,
    taskId: string,
    attemptId: string,
    change: ArtifactChange
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `span-t-${taskId}-${attemptId}`;
    let eventType: TraceEventType = 'artifact_declared';
    if (change.status === 'STAGED' || change.status === 'VALIDATED') eventType = 'artifact_written';
    if (change.status === 'COMMITTED') eventType = 'artifact_committed';
    if (change.status === 'ROLLED_BACK') eventType = 'artifact_rolled_back';

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_art_${change.artifactId}`,
      traceId: missionId,
      spanId,
      parentSpanId: `span-m-${missionId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType,
      status: change.status,
      title: `Artifact ${change.status}: ${change.artifactId}`,
      summary: `Artifact ${change.artifactId} status transitioned to ${change.status} (Commit: ${change.commitStatus})`,
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      artifactChanges: [change]
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Tool Observation 생성 이벤트 기록
   */
  public recordToolObservation(
    missionId: string,
    taskId: string,
    attemptId: string,
    observation: any
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_obs_${observation.toolCallId || seq}`,
      traceId: missionId,
      spanId: observation.toolCallId || `obs-${seq}`,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: observation.createdAt || Date.now(),
      eventType: 'tool_observation_created' as any,
      status: observation.status === 'SUCCESS' ? 'OBSERVED' : 'FAILED',
      title: `Tool Observation: ${observation.toolName || 'unknown'}`,
      summary: observation.summary || 'Observation created',
      sequenceNumber: seq,
      visibility: 'USER',
      schemaVersion: '4.0.0',
      observation
    } as any;
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * Verification 단계/결과 이벤트 기록
   */
  public recordVerificationTrace(
    missionId: string,
    taskId: string,
    attemptId: string,
    trace: VerificationTrace
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `verif-${trace.verificationId}`;
    const parentSpanId = `span-t-${taskId}-${attemptId}`;

    let eventType: TraceEventType = 'verification_stage_completed';
    if (trace.verdict === 'PASS') eventType = 'verification_passed';
    if (trace.verdict === 'FAIL' || trace.verdict === 'NEEDS_RETRY') eventType = 'verification_failed';

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_verif_${trace.verificationId}`,
      traceId: missionId,
      spanId,
      parentSpanId,
      missionId,
      taskId,
      attemptId,
      timestamp: trace.completedAt,
      eventType,
      status: trace.verdict,
      title: `Verification (${trace.stage}): ${trace.verdict}`,
      summary: `Stage ${trace.stage} verified by ${trace.verifierName}: ${trace.verdict} (${trace.defectCount} defects)`,
      durationMs: trace.durationMs,
      sequenceNumber: seq,
      visibility: 'USER',
      severity: trace.verdict === 'FAIL' ? 'HIGH' : 'LOW',
      schemaVersion: '4.0.0',
      verification: trace
    };
    this.store.appendEvent(ev);
    return ev;
  }

  /**
   * 재시도 및 NO_PROGRESS 이벤트 기록
   */
  public recordRetryTrace(
    missionId: string,
    taskId: string,
    attemptId: string,
    retry: RetryTrace
  ): TraceEvent {
    const seq = this.store.nextSequenceNumber(missionId);
    const spanId = `retry-${retry.newAttemptId}`;
    let eventType: TraceEventType = 'retry_scheduled';
    if (retry.stopReason === 'NO_PROGRESS') eventType = 'retry_stopped_no_progress';
    if (retry.stopReason === 'BUDGET_EXHAUSTED') eventType = 'retry_budget_exhausted';

    const ev: TraceEvent = {
      eventId: `${missionId}_${seq}_retry_${retry.retryNumber}`,
      traceId: missionId,
      spanId,
      parentSpanId: `span-t-${taskId}-${attemptId}`,
      missionId,
      taskId,
      attemptId,
      timestamp: Date.now(),
      eventType,
      status: retry.stopReason ?? 'RETRYING',
      title: `Task Retry (#${retry.retryNumber}): ${retry.stopReason ?? 'Scheduled'}`,
      summary: retry.retryReason,
      sequenceNumber: seq,
      visibility: 'USER',
      severity: retry.stopReason ? 'HIGH' : 'MEDIUM',
      schemaVersion: '4.0.0',
      retry
    };
    this.store.appendEvent(ev);
    return ev;
  }
}
