/**
 * @file orchestrator/task-runtime/planning/planner/PlanNormalizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 파싱된 데이터를 TaskPlan 구조에 맞게 정규화 (의미 부여는 하지 않음)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskPlanner.ts: 파싱 후 정규화 단계
 * - PlanningPipeline.test.ts: 통합 테스트
 *
 * [변경 이력]
 * - HIDDEN PHASE 6: normalize() 인스턴스 메서드 복원. TaskPlan 반환.
 *   이전 PHASE 작업에서 static normalizeTasks()로 이름/시그니처 변경으로 테스트 3건 회귀.
 *   static 메서드는 내부 호환용으로 유지, 원래 인스턴스 메서드 복원.
 */

import type { TaskPlan, PlanStatus } from '../domain/PlanningTypes';
import type { TaskDefinition } from '../../domain/types';
import { PlanningPolicy } from '../domain/PlanningPolicy';

/**
 * 플래너가 생성한 비정형/유연한 데이터를 TaskDefinition 배열 및 TaskPlan으로 정규화합니다.
 */
export class PlanNormalizer {

  /**
   * [인스턴스 메서드 - 기존 공개 API 유지]
   * rawTasks 배열과 missionId, goalId를 받아 완성된 TaskPlan 객체를 반환합니다.
   * 이 메서드는 기존 PlanningPipeline 테스트 및 TaskPlanner에서 호출합니다.
   *
   * @param rawTasks 플래너가 반환한 불완전한 Task 배열
   * @param missionId 미션 ID
   * @param goalId 목표 ID
   * @returns 정규화된 TaskPlan (status: 'DRAFT')
   */
  public normalize(rawTasks: any[], missionId: string, goalId: string): TaskPlan {
    const tasks = PlanNormalizer.normalizeTasks(rawTasks, missionId);

    return {
      planId: `plan-${crypto.randomUUID()}`,
      missionId,
      goalId,
      version: 1,
      status: 'DRAFT' as PlanStatus,
      plannerSource: 'SYSTEM',
      tasks,
      createdAt: Date.now(),
      schemaVersion: '1.0'
    };
  }

  /**
   * [Static 헬퍼 - 내부 및 외부 호환용]
   * rawTasks 배열을 TaskDefinition 배열로만 변환합니다.
   * normalize()가 내부적으로 이를 호출합니다.
   *
   * @param rawTasks 플래너가 반환한 불완전한 Task 배열
   * @param missionId 미션 ID
   * @returns 정규화된 TaskDefinition 배열
   */
  public static normalizeTasks(rawTasks: any[], missionId: string): TaskDefinition[] {
    if (!Array.isArray(rawTasks)) return [];

    return rawTasks.map((rt, index) => {
      // 1. ID 강제 할당 (없으면 생성하되, 가급적 유지)
      const id = typeof rt.id === 'string' && rt.id.trim() !== '' ? rt.id.trim() : `task-${crypto.randomUUID()}`;

      // 2. Dependencies 정규화
      let dependencies: string[] = [];
      if (Array.isArray(rt.dependencies)) {
        dependencies = [...new Set<string>(rt.dependencies.map((d: any) => String(d).trim()))];
      }

      // 3. String 배열 정규화 (expectedOutputs, acceptanceCriteria, etc.)
      const normalizeStrArray = (arr: any) => Array.isArray(arr) ? arr.map(String) : [];

      return {
        id,
        missionId,
        title: rt.title || `Task ${index + 1}`,
        objective: rt.objective || '',
        dependencies,
        priority: typeof rt.priority === 'number' ? Math.max(1, Math.min(10, rt.priority)) : 5,
        budgetTurns: typeof rt.budgetTurns === 'number'
          ? Math.min(rt.budgetTurns, PlanningPolicy.budgets.task.maxReasoningTurnsPerTask)
          : PlanningPolicy.budgets.defaultTaskReasoningBudget,
        expectedFileOutputs: normalizeStrArray(rt.expectedFileOutputs),
        expectedArtifactOutputs: normalizeStrArray(rt.expectedArtifactOutputs),
        outputMode: (rt.outputMode as any) || 'NO_PERSISTED_OUTPUT',
        acceptanceCriteria: normalizeStrArray(rt.acceptanceCriteria),
        capabilityRequirements: normalizeStrArray(rt.capabilityRequirements),
        requirementIds: normalizeStrArray(rt.requirementIds),
        plannerMetadata: typeof rt.plannerMetadata === 'object' && rt.plannerMetadata !== null ? rt.plannerMetadata : {},
      };
    });
  }
}
