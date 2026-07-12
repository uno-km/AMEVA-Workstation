/**
 * @file orchestrator/task-runtime/scheduling/TaskScheduler.ts
 * @system AMEVA OS Desktop Workstation
 * @role Pending 상태의 Task를 평가하여 Ready 상태로 승격시키고, 데드락을 감지하는 메인 스케줄러 루프
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskGraph } from '../planning/graph/TaskGraph';
import { ReadinessEvaluator } from './ReadinessEvaluator';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import type { DeadlockClassification } from '../domain/ExecutionTypes';
import { RecoveryRequestStore } from '../verification/recovery/RecoveryRequestStore';
import type { TaskRecoveryRequest } from '../verification/domain/RecoveryTypes';

export class TaskScheduler {
  private evaluator: ReadinessEvaluator;

  private store: TaskRuntimeStore;
  private ledger: MissionBudgetLedger;
  private recoveryStore?: RecoveryRequestStore;
  constructor(
    store: TaskRuntimeStore,
    ledger: MissionBudgetLedger,
    recoveryStore?: RecoveryRequestStore
  ) {
    this.store = store;
    this.ledger = ledger;
    this.recoveryStore = recoveryStore;
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
  public runSchedulingPass(missionId: string): { newlyReadyCount: number, deadlockType: DeadlockClassification | null } {
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
    
    // 블록된 사유들의 빈도나 우선순위를 추적하기 위한 Set
    const blockReasons = new Set<DeadlockClassification>();

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
              blockReasons.add('WAITING_BUDGET');
            }
          } else {
            if (result.blockType) {
              blockReasons.add(result.blockType);
              
              // Phase 4 (Critical C): Dependency Recovery 발생 시 명시적으로 RecoveryRequest 생성
              if (result.blockType === 'WAITING_DEPENDENCY_RECOVERY' && this.recoveryStore && result.dependencyFailure) {
                // 이미 발급된 Request가 있는지 확인
                const activeReqs = this.recoveryStore.getActiveRequestsForTask(taskId);
                if (activeReqs.length === 0) {
                  const req: TaskRecoveryRequest = {
                    recoveryRequestId: `dep-rec-${crypto.randomUUID()}`,
                    missionId,
                    taskId,
                    planId: task.definition.planId,
                    failureReason: `Dependency failed: ${result.dependencyFailure.reason} from ${result.dependencyFailure.sourceTaskId}`,
                    status: 'PENDING',
                    retryCount: task.state.retries,
                    recoveryCount: 0,
                    createdAt: Date.now()
                  };
                  this.recoveryStore.addRequest(req);
                  
                  // 상태를 BLOCKED (또는 WAITING_DEPENDENCY)로 강제 전이하여 무한 평가 방지
                  this.store.dispatchTransition(
                    {
                      commandId: `cmd-block-${crypto.randomUUID()}`,
                      missionId,
                      taskId,
                      expectedCurrentStatus: status,
                      expectedStateVersion: task.state.stateVersion,
                      reason: req.failureReason,
                      actor: 'TaskScheduler',
                      timestamp: Date.now()
                    },
                    'BLOCKED',
                    { blockReason: req.failureReason }
                  );
                  // 이번 턴의 카운트 계산 보정을 위해 
                  pendingOrRetryCount--;
                }
              }
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

    // 데드락 및 대기 상태 판정 로직
    let deadlockType: DeadlockClassification | null = null;

    // 만약 새롭게 READY가 된 태스크가 하나도 없고, 진행 중인(또는 끝난) 태스크가 없다면 대기 상태다.
    // 하지만 VERIFYING이 있다면 이는 Deadlock이 아니라 검증 대기 상태다.
    const isActuallyBlocked = newlyReadyCount === 0 && pendingOrRetryCount > 0 && 
      !allTasks.some(t => t.state.status === 'READY' || t.state.status === 'RUNNING');

    if (isActuallyBlocked) {
      // 1. VERIFYING이 하나라도 있다면, 이는 데드락이 아니라 검증이 끝나길 기다리는 중임
      if (allTasks.some(t => t.state.status === 'VERIFYING')) {
        deadlockType = 'WAITING_VERIFICATION';
      } 
      // 2. 블록 사유들을 기반으로 판별
      else if (blockReasons.has('WAITING_DEPENDENCY_RECOVERY')) {
        deadlockType = 'WAITING_DEPENDENCY_RECOVERY';
      } else if (blockReasons.has('WAITING_CAPABILITY')) {
        deadlockType = 'WAITING_CAPABILITY';
      } else if (blockReasons.has('WAITING_BUDGET')) {
        deadlockType = 'WAITING_BUDGET';
      } else if (blockReasons.has('WAITING_USER')) {
        deadlockType = 'WAITING_USER';
      } else {
        // 남은 진행 태스크도 없고, VERIFYING도 없고, 명확한 대기 사유도 없으면 진정한 데드락
        deadlockType = 'TRUE_DEADLOCK';
      }
    }

    return { newlyReadyCount, deadlockType };
  }
}
