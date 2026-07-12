/**
 * @file orchestrator/task-runtime/budget/MissionBudgetLedger.ts
 * @system AMEVA OS Desktop Workstation
 * @role Mission 전역 예산(Budget) 관리소
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { BudgetExceededError } from '../domain/errors';

export class MissionBudgetLedger {
  constructor(private store: TaskRuntimeStore) {}

  /**
   * 태스크 실행을 위해 지정된 예산을 예약합니다.
   * 여유 예산이 부족하면 예외를 던집니다.
   */
  public reserveTaskBudget(missionId: string, taskId: string, requestedTurns: number): void {
    const missionState = this.store.getMissionState(missionId);
    const { budget } = missionState;

    const availableTurns = budget.maxReasoningTurns - (budget.consumedReasoningTurns + budget.reservedReasoningTurns);
    if (availableTurns < requestedTurns) {
      throw new BudgetExceededError(
        `Mission ${missionId} budget exceeded. Requested: ${requestedTurns}, Available: ${availableTurns}`
      );
    }

    this.store.updateMissionState(missionId, {
      budget: {
        ...budget,
        reservedReasoningTurns: budget.reservedReasoningTurns + requestedTurns
      }
    });
  }

  /**
   * 태스크 실행이 종료된 후, 실제 소비한 예산을 정산하고 남은 예약 예산을 반환합니다.
   */
  public commitTaskBudget(missionId: string, taskId: string, initiallyRequestedTurns: number, actuallyConsumedTurns: number): void {
    const missionState = this.store.getMissionState(missionId);
    const { budget } = missionState;

    // 만약 버그나 예외 상황으로 예약된 턴보다 소비된 턴이 많더라도, 초과한 만큼 전체 소비에 누적합니다.
    const newReserved = Math.max(0, budget.reservedReasoningTurns - initiallyRequestedTurns);
    const newConsumed = budget.consumedReasoningTurns + actuallyConsumedTurns;

    this.store.updateMissionState(missionId, {
      budget: {
        ...budget,
        reservedReasoningTurns: newReserved,
        consumedReasoningTurns: newConsumed
      }
    });
  }

  /**
   * 특정 미션의 남은 가용 예산을 반환합니다.
   */
  public getAvailableBudget(missionId: string): number {
    const missionState = this.store.getMissionState(missionId);
    const { budget } = missionState;
    return budget.maxReasoningTurns - (budget.consumedReasoningTurns + budget.reservedReasoningTurns);
  }
}
