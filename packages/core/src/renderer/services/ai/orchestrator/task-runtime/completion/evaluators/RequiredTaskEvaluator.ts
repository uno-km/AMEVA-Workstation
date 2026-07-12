/**
 * @file orchestrator/task-runtime/completion/evaluators/RequiredTaskEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 모든 필수 Task가 검증된 성공(COMPLETED) 상태인지 평가
 */

import type { MissionCompletionReviewInput } from '../../domain/types';

export class RequiredTaskEvaluator {
  /**
   * 필수 Task의 성공 여부를 검사하고 성공 비율(0~100)을 반환합니다.
   * @param input 완료 리뷰 스냅샷 데이터
   * @returns { success: boolean, completionRate: number, failedTaskIds: string[] }
   */
  public evaluate(input: MissionCompletionReviewInput): {
    success: boolean;
    completionRate: number;
    failedTaskIds: string[];
    waitingUserTaskIds: string[];
    blockedTaskIds: string[];
  } {
    const requiredTasks = input.allTaskDefinitions.filter(t => t.priority <= 5); // 도메인 정책 기준(임시: <= 5)
    
    if (requiredTasks.length === 0) {
      return { success: true, completionRate: 100, failedTaskIds: [], waitingUserTaskIds: [], blockedTaskIds: [] };
    }

    const failedTaskIds = input.failedRequiredTasks.map(t => t.definition.id);
    const waitingUserTaskIds = input.waitingUserTasks
      .filter(t => t.definition.priority <= 5)
      .map(t => t.definition.id);
    const blockedTaskIds = input.blockedTasks
      .filter(t => t.definition.priority <= 5)
      .map(t => t.definition.id);

    // 성공한 필수 태스크 = successfulTaskResults 안에 있는 것 중 requiredTasks
    // PASS 판정을 받은 검증 객체가 존재하는지까지 엄밀히 봐야 함.
    const completedRequiredTaskIds = input.successfulTaskResults
      .map(r => r.taskId) // 주의: 기존에 taskId가 TaskResult에 없어서 뺐었는데, input에서는 definition을 이용해야 할 수도 있다.
      // *참고*: TaskResult 대신 taskStore에서 뽑아온 상태를 바탕으로 검사하는 편이 안전함.
      .filter(id => !!id);

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
