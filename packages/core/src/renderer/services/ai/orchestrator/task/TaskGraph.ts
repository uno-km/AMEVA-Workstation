/**
 * @file orchestrator/task/TaskGraph.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/TaskGraph.ts
 * @role DAG (Directed Acyclic Graph) 기반 태스크 의존성 스케줄러 및 루프 가드
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskQueue.ts: Ready 상태 노드를 방출하기 위해 getReadyTasks() 호출.
 * - AgentOrchestrator.ts: 태스크 로드 시 Cycle 탐지(hasCycle) 및 상태 변화 전파 시 사용.
 */

import type { Task, TaskStatus } from './types';

/**
 * TaskGraph
 * 위상 정렬 및 DFS 탐색 기법을 사용해 태스크 간의 순서적 의존성을 검증하고,
 * 교착(Deadlock)을 유발하는 순환 관계를 차단하는 방향 그래프 클래스.
 */
export class TaskGraph {
  private readonly tasks: Task[];
  private readonly taskMap = new Map<string, Task>();

  /**
   * 생성자
   *
   * @param tasks - 플래너가 생성한 초기 태스크 배열
   */
  constructor(tasks: Task[]) {
    this.tasks = tasks;
    for (const t of tasks) {
      this.taskMap.set(t.id, t);
    }
  }

  /**
   * 태스크 그래프 내부의 순환 참조(Cycle)를 DFS 알고리즘으로 스캔합니다.
   *
   * @returns 순환 존재 여부 (true = 순환 참조 존재, 실행 불가)
   */
  public hasCycle(): boolean {
    const visited = new Map<string, 'VISITING' | 'VISITED'>();

    const dfs = (taskId: string): boolean => {
      const state = visited.get(taskId);
      if (state === 'VISITING') {
        // 이미 탐색 중인 노드를 다시 만남 = 순환(Cycle) 발견
        return true;
      }
      if (state === 'VISITED') {
        return false;
      }

      visited.set(taskId, 'VISITING');
      const task = this.taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (dfs(depId)) return true;
        }
      }
      visited.set(taskId, 'VISITED');
      return false;
    };

    for (const t of this.tasks) {
      if (dfs(t.id)) return true;
    }
    return false;
  }

  /**
   * 선행 의존성이 모두 완수(COMPLETED or SKIPPED)되었고,
   * 현재 대기(PENDING) 상태인 실행 가능한 READY 태스크 목록을 필터링합니다.
   *
   * @returns READY 상태로 전이할 수 있는 태스크 노드 배열
   */
  public getReadyTasks(): Task[] {
    const readyList: Task[] = [];

    for (const t of this.tasks) {
      // 이미 PENDING 단계를 넘어선 노드는 스킵
      if (t.status !== 'PENDING') continue;

      let allDepsMet = true;
      for (const depId of t.dependencies) {
        const depNode = this.taskMap.get(depId);
        if (!depNode) {
          // 의존 노드가 선언되지 않은 비정상 상태면 만족하지 않은 것으로 간주
          allDepsMet = false;
          break;
        }
        // 선행 노드가 완료(COMPLETED)되었거나 강제 스킵(SKIPPED)되지 않았다면 락
        if (depNode.status !== 'COMPLETED' && depNode.status !== 'SKIPPED') {
          allDepsMet = false;
          break;
        }
      }

      if (allDepsMet) {
        readyList.push(t);
      }
    }

    return readyList;
  }

  /**
   * 특정 태스크의 상태를 안전하게 강제 갱신하고 의존관계를 리프레시합니다.
   *
   * @param taskId - 대상 태스크 식별자
   * @param status - 변경할 신규 상태값
   */
  public updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.taskMap.get(taskId);
    if (task) {
      const prevStatus = task.status;
      task.status = status;
      if (status === 'COMPLETED' || status === 'SKIPPED') {
        task.completedAt = Date.now();
      }
      console.info(`[TaskGraph] 태스크 상태 전환: ${taskId} (${prevStatus} -> ${status})`);
      
      // 상태 전환에 따라 READY 후보로 올라갈 노드들의 상태 동기화 진행
      if (status === 'COMPLETED' || status === 'SKIPPED') {
        const nextReady = this.getReadyTasks();
        for (const r of nextReady) {
          r.status = 'READY';
        }
      }
    }
  }

  /**
   * 특정 태스크 객체를 맵에서 쿼리합니다.
   */
  public getTask(taskId: string): Task | null {
    return this.taskMap.get(taskId) || null;
  }

  /**
   * 그래프에 포함된 모든 태스크 배열을 반환합니다.
   */
  public getTasks(): Task[] {
    return this.tasks;
  }
}
