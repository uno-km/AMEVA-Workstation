/**
 * @file orchestrator/task-runtime/completion/evaluators/RequiredTaskEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 모든 필수 Task가 검증된 성공(COMPLETED) 상태인지 평가
 */

import type { MissionCompletionReviewInput, TaskDefinition } from '../../domain/types';

export class RequiredTaskEvaluator {
  /**
   * 필수 Task의 성공 여부를 검사하고 성공 비율(0~100)을 반환합니다.
   * @param input 완료 리뷰 스냅샷 데이터
   * @returns { success: boolean, completionRate: number, failedTaskIds: string[] }
   */
  private isRequired(def: TaskDefinition): boolean {
    if (typeof def.required === 'boolean') {
      return def.required;
    }
    // Legacy fallback
    if (def.requirementIds && def.requirementIds.length > 0) return true;
    if (def.expectedOutputs && def.expectedOutputs.length > 0) return true;
    
    if (def.priority === 1) {
      console.warn(`[RequiredTaskEvaluator] Task ${def.id} has undefined 'required' field. Falling back to priority === 1 as required=true.`);
      return true;
    }
    return false;
  }

  public evaluate(input: MissionCompletionReviewInput): {
    success: boolean;
    completionRate: number;
    failedTaskIds: string[];
    waitingUserTaskIds: string[];
    blockedTaskIds: string[];
  } {
    const requiredTasks = input.allTaskDefinitions.filter(t => this.isRequired(t));
    
    if (requiredTasks.length === 0) {
      return { success: true, completionRate: 100, failedTaskIds: [], waitingUserTaskIds: [], blockedTaskIds: [] };
    }

    const failedTaskIds = input.failedRequiredTasks.map(t => t.definition.id);
    const waitingUserTaskIds = input.waitingUserTasks
      .filter(t => this.isRequired(t.definition))
      .map(t => t.definition.id);
    const blockedTaskIds = input.blockedTasks
      .filter(t => this.isRequired(t.definition))
      .map(t => t.definition.id);


    // 실제로는 input.allTaskRuntimeStates와 definition을 순회하여 평가
    let completedCount = 0;

    for (const def of requiredTasks) {
      const state = input.allTaskRuntimeStates.find((_, idx) => input.allTaskDefinitions[idx].id === def.id);
      if (!state) continue;

      if (
        state.status === 'COMPLETED' &&
        state.taskResult &&
        state.verification &&
        state.verification.verdict === 'PASS'
      ) {
        completedCount++;
      } else {
        // FAILED, SKIPPED, CANCELLED 등이거나 아직 진행중이면 실패 처리
        if (state.status !== 'WAITING_USER' && state.status !== 'BLOCKED') {
          if (!failedTaskIds.includes(def.id)) {
            failedTaskIds.push(def.id);
          }
        }
      }
    }

    const completionRate = Math.round((completedCount / requiredTasks.length) * 100);
    const success = failedTaskIds.length === 0 && waitingUserTaskIds.length === 0 && blockedTaskIds.length === 0 && completedCount === requiredTasks.length;

    return {
      success,
      completionRate,
      failedTaskIds,
      waitingUserTaskIds,
      blockedTaskIds
    };
  }
}
