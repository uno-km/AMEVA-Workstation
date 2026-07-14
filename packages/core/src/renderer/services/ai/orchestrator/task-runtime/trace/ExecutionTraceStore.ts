/**
 * @file orchestrator/task-runtime/trace/ExecutionTraceStore.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 Execution Trace의 인메모리 및 영속화 전용 Store
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ExecutionTraceManager: TraceEvent 기록 및 관리
 * - RuntimeRestoreCoordinator: 앱 재시작 시 Mission Trace 복원 및 Open Span 정리
 * - ExecutionTraceViewModel: UI 표시를 위한 이벤트 조회
 *
 * [Trace Store 원칙 - Phase 4]
 * 1. Mission별 Trace 격리 (missionId 기준 독립 저장소)
 * 2. Append-only 이벤트 및 eventId 중복 방지 (Idempotency)
 * 3. SequenceNumber 단조 증가 보장 (Runtime 복원 후에도 연속성 유지)
 * 4. Mission 종료 후 Compaction 지원 (중요 이벤트 보존, 반복 Progress/Stream 요약)
 * 5. Debug Raw Log와 User-visible Trace 분리
 * 6. Trace 저장 실패가 Task 실행을 무조건 실패시키지 않음 (경고/에러 캡처 후 정상 계속)
 */

import type { TraceEvent, TraceEventType } from './ExecutionTraceTypes';
import { SecretRedactor } from './SecretRedactor';
import type { IRuntimePersistenceAdapter } from '../persistence/RuntimePersistenceAdapter';
import { ToolApprovalPolicy } from '../policy/ToolApprovalPolicy';

/**
 * [도메인 종속 지역 상수]
 * Trace 메모리 상한 및 압축 기준값
 */
const MAX_TRACE_EVENTS_PER_MISSION = 10_000;
const COMPACTION_PRESERVED_TYPES: ReadonlySet<TraceEventType> = new Set([
  'mission_started',
  'mission_resumed',
  'mission_completed',
  'mission_failed',
  'plan_created',
  'plan_validated',
  'task_ready',
  'task_started',
  'task_status_changed',
  'task_completed',
  'task_failed',
  'task_waiting_user',
  'decision_summary_created',
  'tool_selected',
  'tool_approval_requested',
  'tool_approval_granted',
  'tool_approval_rejected',
  'tool_execution_completed',
  'tool_execution_failed',
  'tool_execution_timed_out',
  'artifact_committed',
  'artifact_rolled_back',
  'verification_stage_started',
  'verification_stage_completed',
  'verification_passed',
  'verification_failed',
  'repair_started',
  'repair_completed',
  'retry_scheduled',
  'retry_stopped_no_progress',
  'retry_budget_exhausted',
  'runtime_restored',
  'runtime_restore_failed'
]);

export class ExecutionTraceStore {
  /** Mission별 TraceEvent 배열 */
  private traces: Map<string, TraceEvent[]> = new Map();
  /** eventId 중복 차단용 Set */
  private eventIds: Set<string> = new Set();
  /** Mission별 다음 sequenceNumber 추적 */
  private nextSeqByMission: Map<string, number> = new Map();
  /** Span별 마지막 상태 (Open Span 감지용: spanId -> eventType) */
  private spanState: Map<string, { eventId: string; eventType: TraceEventType; missionId: string; taskId?: string; toolName?: string; timestamp: number }> = new Map();
  /** Progress 이벤트 Throttle용 Span별 마지막 기록 시간 */
  private lastProgressTimeBySpan: Map<string, number> = new Map();
  /** 반복 상태 Deduplication용 Span별 마지막 이벤트 정보 */
  private lastEventBySpan: Map<string, { type: string; status?: string; summary?: string }> = new Map();
  /** Batch Append 처리 중 알림 지연을 위한 플래그 */
  private isBatching: boolean = false;

  private persistence?: IRuntimePersistenceAdapter;

  constructor(persistence?: IRuntimePersistenceAdapter) {
    this.persistence = persistence;
  }

  /**
   * 영속화 어댑터를 설정한다.
   */
  public setPersistence(persistence?: IRuntimePersistenceAdapter): void {
    this.persistence = persistence;
  }

  /**
   * UI 및 구독자에게 Trace 변경 사항을 동기화한다.
   */
  private notifySubscribers(missionId: string): void {
    const list = this.getMissionTrace(missionId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ameva:execution-trace-updated', {
          detail: { missionId, events: list }
        })
      );
    }
    try {
      if (typeof window !== 'undefined' || process?.env?.NODE_ENV !== 'production') {
        const storeMod = require('../../../../stores/useAIState');
        if (storeMod?.useAIState?.getState) {
          storeMod.useAIState.getState().setExecutionTraceEvents(list as TraceEvent[]);
        }
      }
    } catch (e) {
      // UI 환경이 아니거나 모듈 로드 불가 시 침묵
    }
  }

  /**
   * 다음 Sequence Number를 획득한다. 단조 증가를 보장한다.
   */
  public nextSequenceNumber(missionId: string): number {
    const current = this.nextSeqByMission.get(missionId) ?? 0;
    const next = current + 1;
    this.nextSeqByMission.set(missionId, next);
    return next;
  }

  /**
   * Sequence Number를 설정한다 (복원 시 사용).
   */
  public setSequenceNumber(missionId: string, seq: number): void {
    const current = this.nextSeqByMission.get(missionId) ?? 0;
    if (seq > current) {
      this.nextSeqByMission.set(missionId, seq);
    }
  }

  /**
   * 단일 TraceEvent를 추가한다.
   * eventId 중복 시 무시된다.
   */
  public appendEvent(event: TraceEvent): void {
    if (!event || !event.eventId || !event.missionId) return;

    // Token 단위 Trace Event 생성 금지 (Backpressure 및 노이즈 차단)
    if (event.eventType.startsWith('token_') || event.eventType.includes('raw_cot_token') || event.metadata?.isTokenLevel) {
      return;
    }

    // 중복 eventId 차단
    if (this.eventIds.has(event.eventId)) {
      console.warn(`[ExecutionTraceStore] Duplicate eventId ignored: ${event.eventId}`);
      return;
    }

    // Progress Event Throttle (동일 Span에서 200ms 이내 반복 발송 금지)
    if (event.eventType === 'tool_execution_progress' && event.spanId) {
      const lastTime = this.lastProgressTimeBySpan.get(event.spanId) ?? 0;
      if (Date.now() - lastTime < 200) {
        return;
      }
      this.lastProgressTimeBySpan.set(event.spanId, Date.now());
    }

    // 반복 상태 Event Deduplication (task_status_changed, tool_execution_progress 등)
    if (event.spanId && (event.eventType === 'task_status_changed' || event.eventType === 'tool_execution_progress')) {
      const prev = this.lastEventBySpan.get(event.spanId);
      if (prev && prev.type === event.eventType && prev.status === event.status && prev.summary === event.summary) {
        return;
      }
      this.lastEventBySpan.set(event.spanId, { type: event.eventType, status: event.status, summary: event.summary });
    }

    try {
      // Redaction 적용 후 저장
      const redacted = SecretRedactor.redactEvent(event);
      const frozen = Object.freeze(redacted);

      let list = this.traces.get(frozen.missionId);
      if (!list) {
        list = [];
        this.traces.set(frozen.missionId, list);
      }

      list.push(frozen);
      this.eventIds.add(frozen.eventId);
      this.setSequenceNumber(frozen.missionId, frozen.sequenceNumber);

      // Span 상태 갱신 (Tool/Task Open Span 추적)
      if (frozen.spanId) {
        this.spanState.set(frozen.spanId, {
          eventId: frozen.eventId,
          eventType: frozen.eventType,
          missionId: frozen.missionId,
          taskId: frozen.taskId,
          toolName: frozen.toolExecution?.toolName,
          timestamp: frozen.timestamp
        });
      }

      // 상한 도달 시 자동 압축
      if (list.length >= MAX_TRACE_EVENTS_PER_MISSION) {
        this.compactTrace(frozen.missionId);
      }

      // UI/구독자 실시간 알림 (Batch 중첩 시 지연 처리)
      if (!this.isBatching) {
        this.notifySubscribers(frozen.missionId);
      }

      // 비동기 영속화 시도 (실패해도 예외를 전파하여 Task를 중단시키지 않음)
      this.persistAsync(frozen.missionId).catch(() => {});
    } catch (err) {
      console.error('[ExecutionTraceStore] appendEvent 실패 (Task 실행은 계속됨):', err);
    }
  }

  /**
   * 여러 TraceEvent를 일괄 추가한다.
   */
  public appendBatch(events: TraceEvent[]): void {
    if (!Array.isArray(events) || events.length === 0) return;
    this.isBatching = true;
    const missions = new Set<string>();
    try {
      for (const ev of events) {
        if (ev && ev.missionId) missions.add(ev.missionId);
        this.appendEvent(ev);
      }
    } finally {
      this.isBatching = false;
      for (const mId of missions) {
        this.notifySubscribers(mId);
      }
    }
  }

  /**
   * 특정 Mission의 전체 Trace를 반환한다.
   */
  public getMissionTrace(missionId: string): ReadonlyArray<TraceEvent> {
    return Object.freeze([...(this.traces.get(missionId) ?? [])]);
  }

  /**
   * 특정 Task의 Trace를 반환한다.
   */
  public getTaskTrace(taskId: string): ReadonlyArray<TraceEvent> {
    const result: TraceEvent[] = [];
    for (const list of this.traces.values()) {
      for (const ev of list) {
        if (ev.taskId === taskId) {
          result.push(ev);
        }
      }
    }
    return Object.freeze(result);
  }

  /**
   * 특정 Span ID에 해당하는 최신 이벤트를 반환한다.
   */
  public getSpan(spanId: string): TraceEvent | undefined {
    for (const list of this.traces.values()) {
      // 뒤에서부터 검색하여 가장 최근 span 이벤트 반환
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].spanId === spanId) {
          return list[i];
        }
      }
    }
    return undefined;
  }

  /**
   * 특정 Span ID에 대해 이미 Terminal Event(완료/실패/타임아웃/취소)가 기록되었는지 확인한다.
   */
  public isTerminalEventRecorded(spanId: string): boolean {
    for (const list of this.traces.values()) {
      for (const ev of list) {
        if (ev.spanId === spanId) {
          if (
            ev.eventType === 'tool_execution_completed' ||
            ev.eventType === 'tool_execution_failed' ||
            ev.eventType === 'tool_execution_timed_out' ||
            (ev.eventType === 'tool_execution_cancelled' as any) ||
            ev.status === 'CANCELLED' ||
            ev.status === 'TIMED_OUT' ||
            ev.status === 'SUCCEEDED' ||
            ev.status === 'FAILED'
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 지정한 Sequence Number 이후의 이벤트를 반환한다.
   */
  public getEventsAfter(sequenceNumber: number, missionId?: string): ReadonlyArray<TraceEvent> {
    const result: TraceEvent[] = [];
    if (missionId) {
      const list = this.traces.get(missionId) ?? [];
      for (const ev of list) {
        if (ev.sequenceNumber > sequenceNumber) result.push(ev);
      }
    } else {
      for (const list of this.traces.values()) {
        for (const ev of list) {
          if (ev.sequenceNumber > sequenceNumber) result.push(ev);
        }
      }
    }
    return Object.freeze(result.sort((a, b) => a.sequenceNumber - b.sequenceNumber));
  }

  /**
   * Mission Trace를 압축한다 (중요 이벤트 보존 + 반복 Progress 요약).
   */
  public compactTrace(missionId: string): number {
    const list = this.traces.get(missionId);
    if (!list || list.length <= 100) return 0;

    const beforeCount = list.length;
    const important = list.filter(e => COMPACTION_PRESERVED_TYPES.has(e.eventType));
    const unimportant = list.filter(e => !COMPACTION_PRESERVED_TYPES.has(e.eventType));

    // 최근 50개의 비중요 이벤트(Progress 등)는 유지
    const recentUnimportant = unimportant.slice(-50);

    const compacted = [...important, ...recentUnimportant].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    this.traces.set(missionId, compacted);

    const removed = beforeCount - compacted.length;
    console.debug(`[ExecutionTraceStore] Compacted mission ${missionId}: removed ${removed} events.`);
    return removed;
  }

  /**
   * Mission Trace를 JSON 또는 Markdown 형식으로 Export한다.
   * Export 시 Secret Redaction이 적용되어 있음을 재검증한다.
   */
  public exportTrace(missionId: string, format: 'json' | 'markdown' = 'json'): string {
    const list = this.getMissionTrace(missionId);
    const sanitizedList = list.map(e => SecretRedactor.redactEvent(e));

    if (format === 'json') {
      return JSON.stringify(
        {
          missionId,
          exportedAt: Date.now(),
          schemaVersion: '4.0.0',
          totalEvents: sanitizedList.length,
          events: sanitizedList
        },
        null,
        2
      );
    }

    // Markdown Summary 형식
    let md = `# Execution Trace Summary (Mission: ${missionId})\n\n`;
    md += `- **Exported At**: ${new Date().toISOString()}\n`;
    md += `- **Schema Version**: 4.0.0\n`;
    md += `- **Total Events**: ${sanitizedList.length}\n\n`;

    md += `## 1. Mission Summary\n`;
    const missionEvents = sanitizedList.filter(e => e.eventType.startsWith('mission_') && e.visibility !== 'INTERNAL');
    if (missionEvents.length === 0) md += `*(No mission status events)*\n\n`;
    for (const ev of missionEvents) {
      md += `- [Seq ${ev.sequenceNumber}] **${ev.eventType}** (${new Date(ev.timestamp).toISOString()}): ${ev.summary ?? ev.title ?? ''}\n`;
    }
    md += `\n## 2. Task Timeline\n`;
    const taskEvents = sanitizedList.filter(e => e.eventType.startsWith('task_') && e.visibility !== 'INTERNAL');
    if (taskEvents.length === 0) md += `*(No task timeline events)*\n\n`;
    for (const ev of taskEvents) {
      md += `- [Seq ${ev.sequenceNumber}] **Task ${ev.taskId || 'unknown'} (${ev.eventType})**: ${ev.summary ?? ev.title ?? ''}\n`;
    }
    md += `\n## 3. Decision Summary\n`;
    const decEvents = sanitizedList.filter(e => e.decision && e.visibility !== 'INTERNAL');
    if (decEvents.length === 0) md += `*(No decision summaries)*\n\n`;
    for (const ev of decEvents) {
      const d = ev.decision!;
      md += `### [Seq ${ev.sequenceNumber}] Selected: \`${d.selectedTool}\` (${d.riskLevel})\n`;
      md += `- **Objective**: ${d.objective}\n`;
      md += `- **Selection Reason**: ${d.selectionReason}\n`;
      md += `- **Expected Outcome**: ${d.expectedOutcome}\n\n`;
    }
    md += `## 4. Tool Calls\n`;
    const toolEvents = sanitizedList.filter(e => e.toolExecution && e.visibility !== 'INTERNAL');
    if (toolEvents.length === 0) md += `*(No tool calls)*\n\n`;
    for (const ev of toolEvents) {
      const t = ev.toolExecution!;
      md += `### [Seq ${ev.sequenceNumber}] \`${t.toolName}\` - ${t.resultStatus}\n`;
      md += `- **CallId**: \`${t.toolCallId}\`\n`;
      md += `- **Risk**: ${t.riskLevel}\n`;
      if (t.durationMs !== undefined) md += `- **Duration**: ${t.durationMs}ms\n`;
      if (t.exitCode !== undefined) md += `- **ExitCode**: ${t.exitCode}\n`;
      if (t.resultSummary) md += `- **Summary**: ${t.resultSummary}\n`;
      md += `\n`;
    }
    md += `## 5. Approval History\n`;
    const apprEvents = sanitizedList.filter(e => e.approval && e.visibility !== 'INTERNAL');
    if (apprEvents.length === 0) md += `*(No approval history)*\n\n`;
    for (const ev of apprEvents) {
      const a = ev.approval!;
      md += `- [Seq ${ev.sequenceNumber}] **\`${a.toolName}\` (${a.riskLevel})**: Status = **${a.status}** (Reason: ${a.reason})\n`;
    }
    md += `\n## 6. Observations\n`;
    const obsEvents = sanitizedList.filter(e => e.observation && e.visibility !== 'INTERNAL');
    if (obsEvents.length === 0) md += `*(No tool observations)*\n\n`;
    for (const ev of obsEvents) {
      const o = ev.observation!;
      md += `- [Seq ${ev.sequenceNumber}] **\`${o.toolName || 'unknown'}\` (${o.status})**: ${o.summary || ''}\n`;
    }
    md += `\n## 7. Artifact Revisions\n`;
    const artEvents = sanitizedList.filter(e => e.artifactChanges && e.visibility !== 'INTERNAL');
    if (artEvents.length === 0) md += `*(No artifact revisions)*\n\n`;
    for (const ev of artEvents) {
      for (const c of ev.artifactChanges || []) {
        md += `- [Seq ${ev.sequenceNumber}] **Artifact \`${c.artifactId}\` (${c.status})**: Rev ${c.previousRevision ?? 0} -> ${c.newRevision ?? 1}\n`;
      }
    }
    md += `\n## 8. Verification Results\n`;
    const verEvents = sanitizedList.filter(e => e.verification && e.visibility !== 'INTERNAL');
    if (verEvents.length === 0) md += `*(No verification results)*\n\n`;
    for (const ev of verEvents) {
      const v = ev.verification!;
      md += `- [Seq ${ev.sequenceNumber}] **Stage \`${v.stage}\`**: Verdict = **${v.verdict}** (Defects: ${v.defectCount})\n`;
    }
    md += `\n## 9. Retry History\n`;
    const retryEvents = sanitizedList.filter(e => e.retry && e.visibility !== 'INTERNAL');
    if (retryEvents.length === 0) md += `*(No retry history)*\n\n`;
    for (const ev of retryEvents) {
      const r = ev.retry!;
      md += `- [Seq ${ev.sequenceNumber}] **Retry #${r.retryNumber} (${r.retryReason})**: Strategy = \`${r.strategyId}\` (Next: ${r.nextAction})\n`;
    }
    md += `\n## 10. Final Outcome\n`;
    const finalEvents = sanitizedList.filter(e => (e.eventType === 'mission_completed' || e.eventType === 'mission_failed') && e.visibility !== 'INTERNAL');
    if (finalEvents.length > 0) {
      const f = finalEvents[finalEvents.length - 1];
      md += `- **Outcome**: **${f.eventType === 'mission_completed' ? 'SUCCEEDED' : 'FAILED'}** (${f.summary ?? f.title ?? ''})\n`;
    } else {
      md += `- **Outcome**: In Progress / Not Completed Yet\n`;
    }

    return md;
  }

  /**
   * Trace 상태를 영속화 저장소에 비동기로 저장한다.
   */
  private async persistAsync(missionId: string): Promise<void> {
    if (!this.persistence) return;
    try {
      const list = this.traces.get(missionId) ?? [];
      const seq = this.nextSeqByMission.get(missionId) ?? 0;
      await this.persistence.saveCheckpointData(missionId, '__trace_store__', {
        missionId,
        sequenceNumber: seq,
        events: list
      });
    } catch (err) {
      console.warn(`[ExecutionTraceStore] 영속화 저장 실패 (${missionId}):`, err);
    }
  }

  /**
   * 영속화 저장소로부터 Mission Trace를 복원한다.
   * 열려 있는 Tool Span(RUNNING/STARTED 상태로 종료 이벤트가 없는 Span)은 INTERRUPTED로 정리하여
   * 터미널 이벤트 없이 열린 Span이 남지 않게 한다.
   */
  /**
   * 영속화 저장소 또는 인메모리 이벤트로부터 Mission Trace를 복원한다.
   * 열려 있는 Tool Span(RUNNING/STARTED 상태로 종료 이벤트가 없는 Span)은 INTERRUPTED로 정리하여
   * 터미널 이벤트 없이 열린 Span이 남지 않게 한다.
   */
  public async restore(missionId: string, preloadedEvents?: TraceEvent[]): Promise<{ success: boolean; interruptedSpans: string[] }> {
    const interruptedSpans: string[] = [];

    try {
      let events: TraceEvent[] | undefined = preloadedEvents;

      if (!events && this.persistence) {
        const data: any = await this.persistence.loadCheckpointData(missionId, '__trace_store__');
        if (data && Array.isArray(data.events)) {
          events = data.events;
          if (typeof data.sequenceNumber === 'number') {
            this.nextSeqByMission.set(missionId, data.sequenceNumber);
          }
        }
      }

      if (!events && this.traces.has(missionId)) {
        events = [...(this.traces.get(missionId) ?? [])];
      }

      if (!events || !Array.isArray(events)) {
        return { success: false, interruptedSpans: [] };
      }

      this.traces.set(missionId, events);
      this.spanState.clear();
      for (const ev of events) {
        this.eventIds.add(ev.eventId);
        if (ev.spanId) {
          this.spanState.set(ev.spanId, {
            eventId: ev.eventId,
            eventType: ev.eventType,
            missionId: ev.missionId,
            taskId: ev.taskId,
            toolName: ev.toolExecution?.toolName,
            timestamp: ev.timestamp
          });
        }
      }

      const seq = this.nextSeqByMission.get(missionId) ?? events.reduce((max, e) => Math.max(max, e.sequenceNumber || 0), 0);
      this.nextSeqByMission.set(missionId, seq);

      /*
       * [Open Span 복원 정리]
       * RUNNING/STARTED 상태로 끝난 Tool Call/Task Span을 찾아서 INTERRUPTED 이벤트 기록
       */
      const now = Date.now();
      for (const [spanId, state] of this.spanState.entries()) {
        if (state.eventType === 'tool_execution_started' || state.eventType === 'tool_execution_progress') {
          interruptedSpans.push(spanId);
          const seqNum = this.nextSequenceNumber(missionId);
          const interruptedEvent: TraceEvent = {
            eventId: `${missionId}_${seqNum}_interrupted`,
            traceId: missionId,
            spanId,
            parentSpanId: state.taskId ? `span-t-${state.taskId}` : `span-m-${missionId}`,
            missionId,
            taskId: state.taskId,
            timestamp: now,
            eventType: 'tool_execution_failed',
            status: 'INTERRUPTED',
            title: `Tool '${state.toolName ?? 'unknown'}' interrupted by runtime restart`,
            summary: '실행 중이던 도구가 애플리케이션 재시작으로 인해 중단(INTERRUPTED)되었습니다.',
            sequenceNumber: seqNum,
            visibility: 'OPERATOR',
            severity: 'MEDIUM',
            schemaVersion: '4.0.0',
            toolExecution: {
              toolCallId: spanId,
              toolName: state.toolName ?? 'unknown',
              toolCategory: 'unknown',
              selectionReason: 'Restored after runtime restart',
              normalizedArguments: {},
              redactedArgumentKeys: [],
              riskLevel: 'MEDIUM',
              approvalRequired: false,
              startedAt: state.timestamp,
              completedAt: now,
              durationMs: now - state.timestamp,
              resultStatus: 'CANCELLED',
              resultSummary: 'Interrupted during runtime restart',
              affectedPaths: [],
              createdArtifactIds: [],
              updatedArtifactIds: [],
              retryable: true,
              errorCode: 'RUNTIME_INTERRUPTED'
            }
          };
          this.traces.get(missionId)?.push(interruptedEvent);
          this.eventIds.add(interruptedEvent.eventId);
          this.spanState.set(spanId, {
            eventId: interruptedEvent.eventId,
            eventType: 'tool_execution_failed',
            missionId,
            taskId: state.taskId,
            toolName: state.toolName,
            timestamp: now
          });
        }
      }

      // 승인 상태 및 실행 키 복원
      const restoredApprovals: any[] = [];
      const restoredExecutedKeys: string[] = [];
      for (const ev of events) {
        if (ev.approval) {
          restoredApprovals.push(ev.approval);
          if (ev.approval.idempotencyKey && ev.approval.status !== 'PENDING') {
            restoredExecutedKeys.push(ev.approval.idempotencyKey);
          }
        }
        if (ev.toolExecution && (ev.toolExecution.resultStatus === 'SUCCEEDED' || ev.toolExecution.completedAt)) {
          const idempKey = `idemp-appr-${ev.traceId || missionId}-${ev.toolExecution.toolCallId}`;
          restoredExecutedKeys.push(idempKey);
        }
      }
      ToolApprovalPolicy.restoreApprovals(restoredApprovals, restoredExecutedKeys);

      // 복원 완료 이벤트 기록
      const restoreSeq = this.nextSequenceNumber(missionId);
      const restoreEv: TraceEvent = {
        eventId: `${missionId}_${restoreSeq}_restore`,
        traceId: missionId,
        spanId: `span-m-${missionId}`,
        missionId,
        timestamp: Date.now(),
        eventType: 'runtime_restored',
        status: 'RESTORED',
        title: 'Execution Trace Restored',
        summary: `Mission '${missionId}' trace state successfully restored from checkpoint.`,
        sequenceNumber: restoreSeq,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0'
      };
      this.traces.get(missionId)?.push(restoreEv);
      this.eventIds.add(restoreEv.eventId);

      return { success: true, interruptedSpans };
    } catch (err) {
      console.error(`[ExecutionTraceStore] Trace 복원 실패 (${missionId}):`, err);
      return { success: false, interruptedSpans: [] };
    }
  }

  /**
   * Redaction이 적용된 Mission Trace Export를 수행한다.
   * INTERNAL 이벤트와 Raw Chain-of-Thought는 포함하지 않는다.
   */
  public exportTrace(missionId: string): any {
    const rawEvents = this.traces.get(missionId) ?? [];
    
    // 1. SecretRedactor 재적용 및 INTERNAL/CoT 제거
    const events: TraceEvent[] = [];
    for (const ev of rawEvents) {
      if (ev.visibility === 'INTERNAL' || ev.eventType.startsWith('token_') || ev.eventType.includes('raw_cot')) {
        continue;
      }
      events.push(SecretRedactor.redactEvent(ev));
    }

    const taskTimeline: any[] = [];
    const decisionSummaries: any[] = [];
    const toolCalls: any[] = [];
    const approvalHistory: any[] = [];
    const observations: any[] = [];
    const artifactRevisions: any[] = [];
    const verificationResults: any[] = [];
    const retryHistory: any[] = [];
    let missionSummary: any = undefined;
    let finalOutcome: any = undefined;

    for (const ev of events) {
      if (ev.eventType === 'mission_started') {
        missionSummary = { missionId: ev.missionId, title: ev.title, summary: ev.summary, timestamp: ev.timestamp };
      } else if (ev.eventType === 'mission_completed' || ev.eventType === 'mission_failed' || ev.eventType === 'mission_cancelled') {
        finalOutcome = { status: ev.status, summary: ev.summary, timestamp: ev.timestamp };
      } else if (ev.eventType === 'task_started' || ev.eventType === 'task_completed' || ev.eventType === 'task_failed') {
        taskTimeline.push({ taskId: ev.taskId, status: ev.status, title: ev.title, summary: ev.summary, timestamp: ev.timestamp });
      } else if (ev.eventType === 'decision_summary_created' && ev.decision) {
        decisionSummaries.push(ev.decision);
      } else if (ev.eventType?.startsWith('tool_execution_') && ev.toolExecution) {
        toolCalls.push(ev.toolExecution);
      } else if (ev.eventType === 'tool_approval_requested' || ev.eventType === 'tool_approval_granted' || ev.eventType === 'tool_approval_rejected') {
        if (ev.approval) approvalHistory.push(ev.approval);
      } else if (ev.eventType === 'tool_observation_created' && (ev as any).observation) {
        observations.push((ev as any).observation);
      } else if (ev.eventType === 'artifact_change' && ev.artifactChange) {
        artifactRevisions.push(ev.artifactChange);
      } else if (ev.eventType === 'verification_finished' && ev.verification) {
        verificationResults.push(ev.verification);
      } else if (ev.eventType === 'retry_scheduled' && ev.retry) {
        retryHistory.push(ev.retry);
      }
    }

    // JSON Export 규격
    return {
      schemaVersion: '4.0.0',
      missionSummary,
      taskTimeline,
      decisionSummary: decisionSummaries,
      decisionSummaries,
      toolLifecycle: toolCalls,
      toolCalls,
      approvalHistory,
      observations,
      artifactRevisions,
      verificationResults,
      retryHistory,
      finalOutcome
    };
  }

  /**
   * Mission Trace Compaction (불필요 중간 이벤트 정리)
   */
  public compactTrace(missionId: string): number {
    const list = this.traces.get(missionId);
    if (!list || list.length === 0) return 0;

    const originalLength = list.length;
    const PRESERVED_TYPES = new Set<string>([
      'mission_started', 'mission_completed', 'mission_failed', 'mission_cancelled',
      'task_started', 'task_completed', 'task_failed', 'task_verifying',
      'decision_summary_created', 'decision_summary_fallback_used',
      'tool_selected', 'tool_approval_requested', 'tool_approval_granted', 'tool_approval_rejected',
      'tool_execution_started', 'tool_execution_completed', 'tool_execution_failed', 'tool_execution_timed_out',
      'tool_observation_created',
      'artifact_change', 'verification_finished', 'retry_scheduled', 'runtime_restored'
    ]);

    const compacted = list.filter(ev => PRESERVED_TYPES.has(ev.eventType) || ev.visibility !== 'INTERNAL');
    this.traces.set(missionId, compacted);
    return originalLength - compacted.length;
  }

  /**
   * (테스트용) 전체 메모리 초기화
   */
  public clear(): void {
    this.traces.clear();
    this.eventIds.clear();
    this.nextSeqByMission.clear();
    this.spanState.clear();
    this.lastProgressTimeBySpan.clear();
    this.lastEventBySpan.clear();
  }
}
