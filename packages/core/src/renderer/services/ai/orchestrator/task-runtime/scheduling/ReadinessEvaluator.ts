/**
 * @file orchestrator/task-runtime/scheduling/ReadinessEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 특정 Task가 실행 준비(READY) 상태로 전이할 수 있는지 모든 조건을 평가
 */

import { TaskEntity } from '../domain/types';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
// import { CapabilityCatalog } from '../dispatch/CapabilityCatalog'; // 예정

export interface ReadinessResult {
  isReady: boolean;
  reasons: string[];
}

export class ReadinessEvaluator {
  constructor(
    private store: TaskRuntimeStore,
    private ledger: MissionBudgetLedger
  ) {}

  /**
   * PENDING 또는 RETRY_WAIT 상태의 Task가 READY로 갈 수 있는지 평가합니다.
   * PHASE 3 원칙에 따른 다중 조건(18개 조건 압축)을 검사합니다.
   */
  public evaluate(missionId: string, task: TaskEntity): ReadinessResult {
    const reasons: string[] = [];
    let isReady = true;

    // 1. 기본 상태 조건
    if (task.state.status !== 'PENDING' && task.state.status !== 'RETRY_WAIT') {
      return { isReady: false, reasons: [`Task is currently in ${task.state.status} state, not evaluable for READY.`] };
    }

    // 2. 의존성 (Dependencies) 해결 여부
    if (task.definition.dependencies && task.definition.dependencies.length > 0) {
      for (const depId of task.definition.dependencies) {
        try {
          const depTask = this.store.getTask(missionId, depId);
          if (depTask.state.status !== 'COMPLETED') {
            isReady = false;
            reasons.push(`Dependency '${depId}' is not COMPLETED (current: ${depTask.state.status}).`);
          } else if (!depTask.state.verification || depTask.state.verification.verdict !== 'PASS') {
            isReady = false;
            reasons.push(`Dependency '${depId}' is COMPLETED but lacks a 'PASS' verification verdict.`);
          }
        } catch (e) {
          isReady = false;
          reasons.push(`Dependency '${depId}' is missing from the store.`);
        }
      }
    }

    // 3. 예산 (Budget) 여유분 확인
    const requestedTurns = task.definition.allocatedReasoningTurns || task.definition.budgetTurns || 100;
    const availableBudget = this.ledger.getAvailableBudget(missionId);
    if (availableBudget < requestedTurns) {
      isReady = false;
      reasons.push(`Insufficient mission budget. Requested: ${requestedTurns}, Available: ${availableBudget}.`);
    }

    // 4. Capability (권한 및 툴) 요구사항 충족 여부
    // TODO: CapabilityCatalog와 연동하여 실제 인프라에 해당 툴이 켜져 있는지 확인
    const requiredCaps = task.definition.capabilityRequirements || [];
    if (requiredCaps.length > 0) {
      // PHASE 3 임시 통과
      // reasons.push(`Checked capabilities: ${requiredCaps.join(', ')}`);
    }

    return { isReady, reasons };
  }
}
