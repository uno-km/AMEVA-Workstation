/**
 * @file orchestrator/task-runtime/verification/runtime/VerificationInputBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role TaskEntity와 Store 데이터를 조합하여 검증기(Verifier)들이 사용할 공통 Input 모델을 생성
 */

import { TaskEntity, TaskAttempt } from '../../domain/types';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';

export interface VerificationInput {
  missionId: string;
  planId?: string;
  planVersion?: number;
  taskId: string;
  attemptId: string;
  
  taskDefinition: TaskEntity['definition'];
  taskState: TaskEntity['state'];
  targetAttempt: TaskAttempt;
  
  // 의존성 결과 스냅샷 (선행 Task의 Result들)
  dependencyResults: Map<string, any>;
  
  createdAt: number;
}

export class VerificationInputBuilder {
  constructor(private store: TaskRuntimeStore) {}

  /**
   * 지정된 태스크와 해당 시도(Attempt)에 대한 검증 입력 객체를 생성합니다.
   * 
   * @param missionId 미션 ID
   * @param taskId 대상 태스크 ID
   * @param attemptId 대상 시도 ID (기본적으로 activeAttemptId 사용)
   */
  public build(missionId: string, taskId: string, attemptId?: string): VerificationInput {
    const task = this.store.getTask(missionId, taskId);
    const targetAttemptId = attemptId || task.state.activeAttemptId;

    if (!targetAttemptId) {
      throw new Error(`VerificationInputBuilder: Task ${taskId} has no active attempt to verify.`);
    }

    const attempt = task.state.attempts[targetAttemptId];
    if (!attempt) {
      throw new Error(`VerificationInputBuilder: Attempt ${targetAttemptId} not found in task ${taskId}.`);
    }

    // 선행 의존성 결과 수집
    const dependencyResults = new Map<string, any>();
    if (task.definition.dependencies) {
      for (const depId of task.definition.dependencies) {
        try {
          const depTask = this.store.getTask(missionId, depId);
          if (depTask.state.taskResult) {
            dependencyResults.set(depId, depTask.state.taskResult);
          }
        } catch (e) {
          // 선행 태스크가 없는 경우는 런타임 오류로 간주하나, 유연성을 위해 기록하지 않을 수도 있음.
          console.warn(`[VerificationInputBuilder] Dependency ${depId} not found or has no result.`);
        }
      }
    }

    return {
      missionId,
      planId: task.definition.planId,
      planVersion: undefined, // Plan 런타임과 연동 시 추가
      taskId,
      attemptId: targetAttemptId,
      taskDefinition: task.definition,
      taskState: task.state,
      targetAttempt: attempt,
      dependencyResults,
      createdAt: Date.now()
    };
  }
}
