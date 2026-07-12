/**
 * @file orchestrator/task/TaskCompletionManager.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskCompletionManager.ts
 * @role 전체 미션 진행 상황 및 완수도 통계를 모니터링하고 최종 미션 성공 결과를 판정하는 판정기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 매 루프 회전 시 및 루프 종결 시점에 isMissionComplete() 및 evaluateMissionResult()를 호출.
 */

import type { TaskQueue } from './TaskQueue';

/**
 * TaskCompletionManager
 * 개별 태스크의 상태들을 모아 전체 미션 진행도(%)를 도출하고,
 * 부분 우회(SKIPPED) 등을 포함한 Mission 완수 등급을 엄격히 판독하는 통합 매니저.
 */
export class TaskCompletionManager {
  private readonly queue: TaskQueue;

  /**
   * 생성자
   *
   * @param queue - 모니터링 대상 TaskQueue
   */
  constructor(queue: TaskQueue) {
    this.queue = queue;
  }

  /**
   * 전체 태스크 대비 완수(COMPLETED) 및 스킵(SKIPPED)된 태스크의 정량적 진행 백분율을 연산합니다.
   *
   * @returns 진행도 수치 (0 ~ 100)
   */
  public getCompletionRate(): number {
    const tasks = this.queue.getGraph().getTasks();
    if (tasks.length === 0) return 0;

    const finished = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'SKIPPED').length;
    return Math.round((finished / tasks.length) * 100);
  }

  /**
   * 모든 태스크가 더 이상 대기(PENDING), 준비(READY), 실행(RUNNING) 상태가 아니어서 미션이 물리적 종결 상태인지 판정합니다.
   */
  public isMissionComplete(): boolean {
    const tasks = this.queue.getGraph().getTasks();
    if (tasks.length === 0) return true;

    // 대기 중이거나 진행 중인 활성 태스크가 하나라도 있다면 아직 미완료
    const hasActive = tasks.some(t => 
      t.status === 'PENDING' || 
      t.status === 'READY' || 
      t.status === 'RUNNING'
    );
    return !hasActive;
  }

  /**
   * 각 태스크 상태별 수치 집계 통계를 반환합니다.
   */
  public getSummaryStats() {
    const tasks = this.queue.getGraph().getTasks();
    const stats = {
      total: tasks.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      userAssist: 0,
      pending: 0,
      ready: 0,
      running: 0
    };

    for (const t of tasks) {
      if (t.status === 'COMPLETED') stats.completed++;
      else if (t.status === 'FAILED') stats.failed++;
      else if (t.status === 'SKIPPED') stats.skipped++;
      else if (t.status === 'USER_ASSIST') stats.userAssist++;
      else if (t.status === 'PENDING') stats.pending++;
      else if (t.status === 'READY') stats.ready++;
      else if (t.status === 'RUNNING') stats.running++;
    }

    return stats;
  }

  /**
   * 최종 완수 등급을 엄격히 판정합니다.
   * - 'SUCCESS': 모든 태스크가 실패/스킵 없이 완벽히 COMPLETED 된 상태.
   * - 'PARTIALLY_COMPLETE': 일부 미진한 태스크가 SKIPPED 처리 되었으나 핵심 태스크가 종결된 상태.
   * - 'FAILED': USER_ASSIST 상태에 락되었거나 FAILED 노드가 남아 소진된 상태.
   */
  public evaluateMissionResult(): 'SUCCESS' | 'PARTIALLY_COMPLETE' | 'FAILED' {
    const stats = this.getSummaryStats();
    
    if (stats.userAssist > 0 || stats.failed > 0) {
      return 'FAILED';
    }
    if (stats.skipped > 0) {
      return 'PARTIALLY_COMPLETE';
    }
    if (stats.completed === stats.total && stats.total > 0) {
      return 'SUCCESS';
    }
    return 'FAILED';
  }
}
