/**
 * @file orchestrator/task/TaskQueue.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskQueue.ts
 * @role 태스크 상태 전이 관리 및 우선순위 스케줄링 큐 엔진
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: 최상위 실행 루프에서 dispatchNext()를 호출해 순차 실행.
 * - TaskExecutor.ts, TaskVerifier.ts: 실행 종료 및 검증 판정 시 setCompleted/setFailed 등을 호출.
 */

import type { TaskGraph } from './TaskGraph';
import type { Task, TaskResult, TaskStatus } from './types';

/**
 * TaskQueue
 * 의존성과 우선순위를 고려하여 태스크 노드를 방출하고,
 * 엄격한 상태 전이(State Machine) 룰셋을 관장하는 핵심 큐 스케줄러.
 */
export class TaskQueue {
  private readonly graph: TaskGraph;

  /**
   * 생성자
   *
   * @param graph - 관리대상인 TaskGraph 인스턴스
   */
  constructor(graph: TaskGraph) {
    this.graph = graph;
    this.initializeQueue();
  }

  /**
   * 최초 기동 시 의존성이 없는 PENDING 노드들을 READY로 이관합니다.
   */
  private initializeQueue(): void {
    const readyTasks = this.graph.getReadyTasks();
    for (const t of readyTasks) {
      this.graph.updateTaskStatus(t.id, 'READY');
    }
  }

  /**
   * 태스크 상태를 업데이트합니다.
   */
  public updateTaskStatus(taskId: string, status: any): void {
    this.graph.updateTaskStatus(taskId, status);
  }

  /**
   * 실행 가능한 READY 상태의 노드 중 우선순위(priority)가 가장 높은 태스크를 방출합니다.
   * 방출 시 상태는 자동으로 RUNNING으로 전환됩니다.
   *
   * @returns 방출된 실행 대상 Task (READY가 없다면 null)
   */
  public dispatchNext(): Task | null {
    const allTasks = this.graph.getTasks();
    const readyTasks = allTasks.filter(t => t.status === 'READY');

    if (readyTasks.length === 0) {
      return null;
    }

    // 우선순위(Priority) 내림차순 정렬 (높을수록 먼저 소비)
    readyTasks.sort((a, b) => b.priority - a.priority);

    const target = readyTasks[0];
    this.graph.updateTaskStatus(target.id, 'RUNNING');
    return target;
  }

  /**
   * 완료되지 않았거나 진행 중인 태스크가 잔존하는지 여부를 검사합니다.
   *
   * @returns 실행해야 할 태스크 존재 여부
   */
  public hasMoreTasks(): boolean {
    const allTasks = this.graph.getTasks();
    return allTasks.some(t => 
      t.status === 'PENDING' || 
      t.status === 'READY' || 
      t.status === 'RUNNING' ||
      t.status === 'FAILED'
    );
  }

  /**
   * 태스크 완수 처리 및 결과 정보 매핑
   */
  public setCompleted(taskId: string, result: TaskResult): void {
    const task = this.graph.getTask(taskId);
    if (task) {
      task.result = result;
      this.graph.updateTaskStatus(taskId, 'COMPLETED');
    }
  }

  /**
   * 태스크 실패 처리
   */
  public setFailed(taskId: string): void {
    this.graph.updateTaskStatus(taskId, 'FAILED');
  }

  /**
   * 태스크 강제 스킵 우회 처리
   */
  public setSkipped(taskId: string): void {
    const task = this.graph.getTask(taskId);
    if (task) {
      task.result = {
        status: 'SKIPPED',
        summary: '최대 재시도 횟수 초과로 인한 스킵 처리',
        evidence: 'System skip rule applied.',
        executionTime: 0
      };
      this.graph.updateTaskStatus(taskId, 'SKIPPED');
    }
  }

  /**
   * 복구 불능 상태에 의한 수동 교정 대기락 처리
   */
  public setUserAssist(taskId: string): void {
    this.graph.updateTaskStatus(taskId, 'USER_ASSIST');
  }

  /**
   * 내부 그래프 인스턴스를 반환합니다.
   */
  public getGraph(): TaskGraph {
    return this.graph;
  }
}
