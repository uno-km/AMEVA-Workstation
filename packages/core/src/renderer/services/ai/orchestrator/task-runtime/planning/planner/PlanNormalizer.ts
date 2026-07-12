/**
 * @file orchestrator/task-runtime/planning/planner/PlanNormalizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 파싱된 데이터를 TaskPlan 구조에 맞게 정규화 (의미 부여는 하지 않음)
 */

import type { TaskPlan } from '../domain/PlanningTypes';
import { TaskDefinition } from '../../domain/types';
import { PlanningPolicy } from '../domain/PlanningPolicy';
import { TaskGraph } from '../graph/TaskGraph';

/**
 * 플래너가 생성한 비정형/유연한 데이터를 TaskDefinition 배열로 정규화합니다.
 */
export class PlanNormalizer {
  
  /**
   * 플래너 결과를 AMEVA TaskRuntime 표준 엔티티로 변환합니다.
   * 누락된 필드 자동 생성 및 제약 조건(Budget 등)을 강제합니다.
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
          : PlanningPolicy.budgets.task.defaultReasoningTurns,
        expectedOutputs: normalizeStrArray(rt.expectedOutputs),
        acceptanceCriteria: normalizeStrArray(rt.acceptanceCriteria),
        capabilityRequirements: normalizeStrArray(rt.capabilityRequirements),
        requirementIds: normalizeStrArray(rt.requirementIds),
        plannerMetadata: typeof rt.plannerMetadata === 'object' ? rt.plannerMetadata : {},
      };
    });

    const plan: TaskPlan = {
      planId: `plan-${crypto.randomUUID()}`,
      missionId,
      goalId,
      version: 1,
      status: 'DRAFT',
      plannerSource: 'SYSTEM', // TODO: LLM 통합 시 LLM으로 변경
      tasks,
      createdAt: Date.now(),
      schemaVersion: '1.0'
    };

    return plan;
  }
}
