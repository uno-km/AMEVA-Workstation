/**
 * @file orchestrator/task-runtime/trace/ExecutionTraceViewModel.ts
 * @system AMEVA OS Desktop Workstation
 * @role UI 렌더링을 위한 Trace Event ViewModel 변환기 (Raw CoT 미노출, 가시성 필터링)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ReasoningTraceViewer: 메시지/이벤트 타임라인 표시
 * - AgentTaskChecklist & AgentThoughtBubble: 진행 및 도구 상태 표시
 *
 * [ViewModel 변환 원칙 - Phase 4]
 * 1. 원시 TraceEvent를 UI Component가 직접 해석하지 않도록 보호 계층 역할 수행
 * 2. INTERNAL 가시성 이벤트나 원시 CoT 전문은 절대 렌더링 데이터로 변환하지 않음
 * 3. ArtifactCard에서 COMMITTED되지 않은 파일을 완료 파일로 오인하지 않도록 명확히 구분
 * 4. 대량 이벤트에서도 UI 스레드가 블로킹되지 않도록 최적화된 필터링 및 변환 제공
 */

import type {
  TraceEvent,
  TraceVisibility,
  ToolExecutionTrace,
  ArtifactChange,
  VerificationTrace,
  RetryTrace,
  ApprovalRequest
} from './ExecutionTraceTypes';
import { SecretRedactor } from './SecretRedactor';

export interface TimelineCard {
  id: string;
  type: 'MISSION' | 'TASK' | 'TOOL' | 'ARTIFACT' | 'VERIFICATION' | 'RETRY' | 'APPROVAL' | 'DECISION';
  timestamp: number;
  sequenceNumber: number;
  title: string;
  summary: string;
  status?: string;
  severity?: string;
  data: any;
}

export class ExecutionTraceViewModel {
  /**
   * TraceEvent 배열을 가시성 기준에 따라 필터링한다.
   * INTERNAL 이벤트 및 숨겨진 메타데이터는 제외된다.
   */
  public static filterByVisibility(
    events: ReadonlyArray<TraceEvent>,
    minVisibility: TraceVisibility = 'USER'
  ): TraceEvent[] {
    const visibilityRank: Record<TraceVisibility, number> = {
      USER: 1,
      OPERATOR: 2,
      DEBUG: 3,
      INTERNAL: 4
    };

    const targetRank = visibilityRank[minVisibility] ?? 1;

    return events
      .filter(ev => {
        // INTERNAL 이벤트는 DEBUG 모드라도 UI에 원시 CoT를 노출하지 않도록 기본 숨김 처리
        if (ev.visibility === 'INTERNAL') return false;
        const evRank = visibilityRank[ev.visibility] ?? 4;
        return evRank <= targetRank;
      })
      .map(ev => SecretRedactor.redactEvent(ev));
  }

  /**
   * TraceEvent 배열을 타임라인 카드 목록으로 변환한다.
   */
  public static toTimelineEvents(
    events: ReadonlyArray<TraceEvent>,
    minVisibility: TraceVisibility = 'USER'
  ): TimelineCard[] {
    const filtered = ExecutionTraceViewModel.filterByVisibility(events, minVisibility);
    const cards: TimelineCard[] = [];

    for (const ev of filtered) {
      let cardType: TimelineCard['type'] = 'TASK';
      if (ev.eventType.startsWith('mission_')) cardType = 'MISSION';
      else if (ev.eventType.startsWith('tool_approval_')) cardType = 'APPROVAL';
      else if (ev.eventType.startsWith('tool_')) cardType = 'TOOL';
      else if (ev.eventType.startsWith('artifact_')) cardType = 'ARTIFACT';
      else if (ev.eventType.startsWith('verification_')) cardType = 'VERIFICATION';
      else if (ev.eventType.startsWith('retry_') || ev.eventType.startsWith('repair_')) cardType = 'RETRY';
      else if (ev.eventType === 'decision_summary_created') cardType = 'DECIDED' as any;

      cards.push({
        id: ev.eventId,
        type: cardType,
        timestamp: ev.timestamp,
        sequenceNumber: ev.sequenceNumber,
        title: ev.title ?? ev.eventType,
        summary: ev.summary ?? '',
        status: ev.status,
        severity: ev.severity,
        data: ev.toolExecution ?? ev.artifactChanges ?? ev.verification ?? ev.retry ?? ev.approval ?? ev.decision ?? {}
      });
    }

    return cards.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  /**
   * Tool Execution Card 목록을 추출한다.
   */
  public static getToolExecutionCards(events: ReadonlyArray<TraceEvent>): ToolExecutionTrace[] {
    const cards: ToolExecutionTrace[] = [];
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    for (const ev of filtered) {
      if (ev.toolExecution) {
        cards.push(ev.toolExecution);
      }
    }
    return cards;
  }

  /**
   * Artifact 변경 카드 목록을 추출한다.
   * [중요 계약] COMMITTED되지 않은 Artifact는 'isFinalCommitted: false' 속성을 추가하여
   * UI가 완료 파일로 표시하지 않도록 명확한 플래그를 제공한다.
   */
  public static getArtifactCards(events: ReadonlyArray<TraceEvent>): Array<ArtifactChange & { isFinalCommitted: boolean }> {
    const cards: Array<ArtifactChange & { isFinalCommitted: boolean }> = [];
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    for (const ev of filtered) {
      if (ev.artifactChanges && Array.isArray(ev.artifactChanges)) {
        for (const change of ev.artifactChanges) {
          cards.push({
            ...change,
            isFinalCommitted: change.status === 'COMMITTED' && change.commitStatus === 'COMMITTED'
          });
        }
      }
    }
    return cards;
  }

  /**
   * 검증 결과 목록을 추출한다.
   */
  public static getVerificationCards(events: ReadonlyArray<TraceEvent>): VerificationTrace[] {
    const cards: VerificationTrace[] = [];
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    for (const ev of filtered) {
      if (ev.verification) {
        cards.push(ev.verification);
      }
    }
    return cards;
  }

  /**
   * 재시도 및 복구 이력 카드 목록을 추출한다.
   */
  public static getRetryCards(events: ReadonlyArray<TraceEvent>): RetryTrace[] {
    const cards: RetryTrace[] = [];
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    for (const ev of filtered) {
      if (ev.retry) {
        cards.push(ev.retry);
      }
    }
    return cards;
  }

  /**
   * 승인 대기 또는 완료된 승인 요청 목록을 추출한다.
   */
  public static getApprovalRequests(events: ReadonlyArray<TraceEvent>): ApprovalRequest[] {
    const cards: ApprovalRequest[] = [];
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    for (const ev of filtered) {
      if (ev.approval) {
        cards.push(ev.approval);
      }
    }
    return cards;
  }

  /**
   * 최종 Mission 결과 카드(Summary)를 구성한다.
   */
  public static getFinalOutcome(events: ReadonlyArray<TraceEvent>): {
    status: string;
    summary: string;
    totalTasks: number;
    completedTools: number;
    committedArtifacts: number;
    finalVerdict?: string;
  } {
    const filtered = ExecutionTraceViewModel.filterByVisibility(events);
    let status = 'RUNNING';
    let summary = 'Execution in progress...';
    let completedTools = 0;
    let committedArtifacts = 0;
    let finalVerdict: string | undefined = undefined;

    for (const ev of filtered) {
      if (ev.eventType === 'mission_completed') {
        status = 'COMPLETED';
        summary = ev.summary ?? 'Mission successfully completed.';
      } else if (ev.eventType === 'mission_failed') {
        status = 'FAILED';
        summary = ev.summary ?? 'Mission failed.';
      }

      if (ev.eventType === 'tool_execution_completed') {
        completedTools++;
      }
      if (ev.eventType === 'artifact_committed') {
        if (ev.artifactChanges) {
          committedArtifacts += ev.artifactChanges.filter(a => a.status === 'COMMITTED').length;
        } else {
          committedArtifacts++;
        }
      }
      if (ev.verification) {
        finalVerdict = ev.verification.verdict;
      }
    }

    return {
      status,
      summary,
      totalTasks: new Set(filtered.map(e => e.taskId).filter(Boolean)).size,
      completedTools,
      committedArtifacts,
      finalVerdict
    };
  }
}
