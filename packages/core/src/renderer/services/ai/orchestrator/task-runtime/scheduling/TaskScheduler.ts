/**
 * @file orchestrator/task-runtime/scheduling/TaskScheduler.ts
 * @system AMEVA OS Desktop Workstation
 * @role Pending 상태의 Task를 평가하여 Ready 상태로 승격시키고, 데드락을 감지하는 메인 스케줄러 루프
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskGraph } from '../planning/graph/TaskGraph';
import { ReadinessEvaluator } from './ReadinessEvaluator';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';

export class TaskScheduler {
  private evaluator: ReadinessEvaluator;

  constructor(
    private store: TaskRuntimeStore,
    private ledger: MissionBudgetLedger
  ) {
    this.evaluator = new ReadinessEvaluator(store, ledger);
  }

  /**
   * 스케줄링 패스를 1회 실행합니다.
   * 1. 위상 정렬 레이어 파악
   * 2. PENDING/RETRY_WAIT Task 평가
   * 3. 조건 통과 시 READY 상태로 일괄 전이 및 예산 예약
   * 4. Deadlock 여부 반환
   * 
   * @returns newlyReadyCount: 이번 패스에서 READY로 전이된 태스크 수, isDeadlocked: 데드락 감지 여부
   */
  public runSchedulingPass(missionId: string): { newlyReadyCount: number, isDeadlocked: boolean } {
    const allTasks = this.store.getAllTasks(missionId);
    
    // 그래프 생성 (의존성 레이어 파악)
    const graph = new TaskGraph(allTasks.map(t => t.definition));
    let layers: string[][] = [];
    try {
      layers = graph.getExecutionLayers();
    } catch (e) {
      // Cycle이 있으면 플래닝 단계에서 이미 걸러져야 함.
      throw new Error(`Graph cycle detected during scheduling pass: ${e}`);
    }

    let newlyReadyCount = 0;
    let pendingOrRetryCount = 0;
    let activeOrCompleteCount = 0;

    for (const layer of layers) {
      for (const taskId of layer) {
        const task = this.store.getTask(missionId, taskId);
        const { status } = task.state;

        if (status === 'PENDING' || status === 'RETRY_WAIT') {
          pendingOrRetryCount++;
          const result = this.evaluator.evaluate(missionId, task);

          if (result.isReady) {
            // 예산 예약
            const requestedTurns = task.definition.allocatedReasoningTurns || task.definition.budgetTurns || 100;
            try {
              this.ledger.reserveTaskBudget(missionId, taskId, requestedTurns);
              
              // 상태 전이 (READY)
              this.store.dispatchTransition(
                {
                  commandId: `cmd-ready-${crypto.randomUUID()}`,
                  missionId,
                  taskId,
                  expectedCurrentStatus: status,
                  expectedStateVersion: task.state.stateVersion,
                  reason: 'Readiness conditions met',
                  actor: 'TaskScheduler',
                  timestamp: Date.now()
                },
                'READY'
              );
              newlyReadyCount++;
            } catch (budgetError) {
              console.warn(`[TaskScheduler] Task ${taskId} is ready but failed budget reservation: ${budgetError}`);
              // 예산 부족이면 다음 태스크(작은 태스크)가 가능할지도 모르니 루프 계속.
            }
          }
        } else if (
          status === 'READY' ||
          status === 'RUNNING' ||
          status === 'VERIFYING' ||
          status === 'COMPLETED'
        ) {
          activeOrCompleteCount++;
        }
      }
    }

    // 데드락 판정: 새로 준비된 태스크는 0개인데, 남은 대기 태스크는 있고, 실행 중이거나 이미 끝난(선행 완료로 이어질) 태스크도 0개인 경우.
    // 보다 엄밀히는: 진행중(READY, RUNNING, VERIFYING)인 게 하나도 없는데 PENDING만 남아있고 newlyReadyCount가 0일 때.
    const isDeadlocked = newlyReadyCount === 0 && pendingOrRetryCount > 0 && !allTasks.some(t => 
      t.state.status === 'READY' || t.state.status === 'RUNNING' || t.state.status === 'VERIFYING'
    );

    return { newlyReadyCount, isDeadlocked };
  }
}
