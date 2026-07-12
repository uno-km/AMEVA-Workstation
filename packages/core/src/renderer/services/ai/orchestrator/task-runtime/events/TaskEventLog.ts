/**
 * @file orchestrator/task-runtime/events/TaskEventLog.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task의 상태 변화 및 주요 이벤트를 기록하는 인메모리 Event Log
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskRuntimeStore: 모든 Task 상태 전이 기록
 * - Phase 테스트: 이벤트 수 검증
 *
 * [FINAL REMEDIATION 수정 — STAGE I (EventLog 상한)]
 * - maxEvents 상한 추가: 기본 5,000개
 * - 상한 초과 시 중요 이벤트(COMPLETED, FAILED, CANCELLED, VERIFYING) 보존 후 오래된 이벤트 제거
 * - getMemoryStats() 추가: 메모리 사용량 모니터링
 * - compactForMission() 추가: Mission 종료 후 압축
 * - dispose() 추가: 전체 정리
 */

import type { TaskEvent } from '../domain/types';

/**
 * [상한 상수 — 3단계 상수화 원칙]
 * Event Log 메모리 상한. Mission당 최대 보관 이벤트 수.
 * 장시간 Mission에서 메모리 무제한 증가를 방지.
 */
const MAX_EVENTS_PER_LOG = 5000;

/**
 * [압축 임계값]
 * 상한의 80%에 도달하면 압축을 실행합니다.
 */
const COMPACTION_THRESHOLD = Math.floor(MAX_EVENTS_PER_LOG * 0.8);

/**
 * [보존 대상 이벤트 타입]
 * 압축 시 반드시 보존해야 하는 중요 이벤트 타입 목록.
 */
const PRESERVED_EVENT_TYPES = new Set([
  'TASK_STATUS_CHANGED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'TASK_CANCELLED',
  'TASK_VERIFYING',
  'TASK_RECOVERY_STARTED',
  'TASK_METADATA_UPDATED',
  'TASK_VERIFICATION_STARTED',
  'TRANSITION_REJECTED'
]);

export class TaskEventLog {
  /*
   * [이벤트 저장소]
   * 내부 배열로 관리. appendEvent 호출마다 freeze된 복사본을 추가.
   * 상한(MAX_EVENTS_PER_LOG)을 초과하면 오래된 비중요 이벤트를 제거.
   */
  private events: TaskEvent[] = [];
  private totalEventsAppended = 0; // 압축 전 포함 전체 누적 수

  /**
   * 이벤트를 로그에 기록합니다.
   * @param event 생성된 TaskEvent
   */
  public appendEvent(event: TaskEvent): void {
    // 깊은 복사 + Object.freeze로 외부 변조 방지
    const frozenEvent = Object.freeze(structuredClone(event));
    this.events.push(frozenEvent);
    this.totalEventsAppended++;

    /*
     * [상한 초과 시 압축 실행]
     * COMPACTION_THRESHOLD(4000개)에 도달하면 압축을 수행.
     * 압축 비용을 분산하기 위해 1,000개마다 실행.
     */
    if (this.events.length >= COMPACTION_THRESHOLD && this.events.length % 1000 === 0) {
      this.compact();
    }
  }

  /**
   * 특정 Task ID와 관련된 이벤트 히스토리를 반환합니다.
   */
  public getEventsForTask(taskId: string): ReadonlyArray<TaskEvent> {
    return Object.freeze(this.events.filter(e => e.taskId === taskId));
  }

  /**
   * 전체 이벤트를 반환합니다.
   */
  public getAllEvents(): ReadonlyArray<TaskEvent> {
    return Object.freeze([...this.events]);
  }

  /**
   * (테스트용) 이벤트를 초기화합니다.
   */
  public clear(): void {
    this.events = [];
    this.totalEventsAppended = 0;
  }

  /**
   * [신규 - STAGE I] 메모리 사용 통계를 반환합니다.
   * MissionExecutionRuntime이 모니터링 목적으로 주기적으로 호출할 수 있습니다.
   */
  public getMemoryStats(): {
    currentCount: number;
    totalAppended: number;
    compactionThreshold: number;
    maxEvents: number;
    utilizationPercent: number;
  } {
    return {
      currentCount: this.events.length,
      totalAppended: this.totalEventsAppended,
      compactionThreshold: COMPACTION_THRESHOLD,
      maxEvents: MAX_EVENTS_PER_LOG,
      utilizationPercent: Math.round((this.events.length / MAX_EVENTS_PER_LOG) * 100)
    };
  }

  /**
   * [신규 - STAGE I] Mission 종료 후 메모리를 압축합니다.
   * 비중요 이벤트를 제거하고 중요 이벤트만 보존합니다.
   *
   * @param missionId 대상 Mission ID. 없으면 전체 압축.
   */
  public compactForMission(missionId?: string): number {
    const before = this.events.length;
    if (missionId) {
      // 특정 Mission의 비중요 이벤트만 제거
      this.events = this.events.filter(e =>
        e.sessionId !== missionId || PRESERVED_EVENT_TYPES.has(e.type)
      );
    } else {
      this.compact();
    }
    return before - this.events.length;
  }

  /**
   * [신규 - STAGE I] 전체 자원을 정리합니다.
   * RuntimeDisposalCoordinator에서 Mission 종료 시 호출합니다.
   */
  public dispose(): void {
    this.events = [];
    this.totalEventsAppended = 0;
  }

  /**
   * 내부 압축 실행.
   * 오래된 이벤트 중 비중요 이벤트를 제거하여 MAX_EVENTS_PER_LOG의 60% 수준으로 줄입니다.
   */
  private compact(): void {
    const targetSize = Math.floor(MAX_EVENTS_PER_LOG * 0.6);
    if (this.events.length <= targetSize) return;

    // 최신 이벤트 우선 보존: 앞에서부터 비중요 이벤트 제거
    const important = this.events.filter(e => PRESERVED_EVENT_TYPES.has(e.type));
    const unimportant = this.events.filter(e => !PRESERVED_EVENT_TYPES.has(e.type));

    const remainingSlots = Math.max(0, targetSize - important.length);
    // 최신 비중요 이벤트만 보존 (앞부분 제거)
    const keptUnimportant = unimportant.slice(-remainingSlots);

    // 시간순 재정렬
    this.events = [...important, ...keptUnimportant].sort((a, b) =>
      (a.timestamp || 0) - (b.timestamp || 0)
    );

    console.debug(
      `[TaskEventLog] Compacted: ${this.events.length} events remaining (${important.length} important + ${keptUnimportant.length} recent)`
    );
  }
}
