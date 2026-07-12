/**
 * @file orchestrator/task-runtime/planning/activation/PlanActivationService.ts
 * @system AMEVA OS Desktop Workstation
 * @role 승인된(APPROVED) Plan을 런타임(TaskRuntimeStore)에 원자적으로 활성화하는 서비스
 */

import { TaskPlan } from '../domain/PlanningTypes';
import { PlanActivationError } from '../domain/PlanningErrors';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { TaskEntity, TaskRuntimeState } from '../../domain/types';

export class PlanActivationService {
  constructor(private store: TaskRuntimeStore) {}

  /**
   * APPROVED 상태의 Plan만 받아 Store에 원자적으로 등록합니다.
   * 이미 존재하는 ID 충돌 시 전체 등록이 거부됩니다.
   */
  public activate(plan: TaskPlan): void {
    if (plan.status !== 'APPROVED') {
      throw new PlanActivationError(`Cannot activate plan in status: ${plan.status}. Must be APPROVED.`);
    }

    if (!plan.tasks || plan.tasks.length === 0) {
      throw new PlanActivationError('Plan has no tasks to activate.');
    }

    // 1. TaskEntity 변환
    const entities: TaskEntity[] = plan.tasks.map(definition => {
      const state: TaskRuntimeState = {
        status: 'PENDING',
        attempts: {},
        stateVersion: 1,
        retries: 0,
        createdAt: Date.now()
      };
      
      // PHASE 2 에서는 definition에 planId와 missionId를 명시적으로 주입한다.
      definition.missionId = plan.missionId;
      definition.planId = plan.planId;

      return { definition, state };
    });

    // 2. 원자적 일괄 등록 시도
    try {
      this.store.registerTasksAtomic(entities, plan.missionId);
      
      // 3. 성공 후 플랜 상태 업데이트
      plan.status = 'ACTIVE';
      plan.activatedAt = Date.now();
      
    } catch (e: any) {
      throw new PlanActivationError(`Failed to atomically activate plan: ${e.message}`);
    }
  }
}
