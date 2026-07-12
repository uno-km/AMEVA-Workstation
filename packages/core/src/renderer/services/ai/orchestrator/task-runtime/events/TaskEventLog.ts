/**
 * @file orchestrator/task-runtime/events/TaskEventLog.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task의 상태 변화 및 주요 이벤트를 기록하는 인메모리 Event Log
 */

import { TaskEvent } from '../domain/types';

export class TaskEventLog {
  private events: TaskEvent[] = [];

  /**
   * 이벤트를 로그에 기록합니다.
   * @param event 생성된 TaskEvent
   */
  public appendEvent(event: TaskEvent): void {
    // 깊은 복사나 Object.freeze로 원본 객체 변조 방지 (인메모리이므로 freeze가 유용)
    const frozenEvent = Object.freeze(structuredClone(event));
    this.events.push(frozenEvent);
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
  }
}
