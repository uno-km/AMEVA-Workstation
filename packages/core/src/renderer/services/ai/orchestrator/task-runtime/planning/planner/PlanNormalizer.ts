/**
 * @file orchestrator/task-runtime/planning/planner/PlanNormalizer.ts
 * @system AMEVA OS Desktop Workstation
 * @role 파싱된 데이터를 TaskPlan 구조에 맞게 정규화 (의미 부여는 하지 않음)
 */

import { TaskPlan, PlanStatus } from '../domain/PlanningTypes';
import { TaskDefinition } from '../../domain/types';
import { PlanningPolicy } from '../domain/PlanningPolicy';

export class PlanNormalizer {
  /**
   * raw JSON object 를 받아 Type Safe 한 TaskPlan 으로 정규화합니다.
   * id 누락 방어, 빈 배열 처리 등
   */
  public normalize(parsedData: any, missionId: string, goalId: string): TaskPlan {
    const rawTasks = Array.isArray(parsedData) ? parsedData : (parsedData.tasks || []);
    
    const tasks: TaskDefinition[] = rawTasks.map((rt: any, index: number) => {
      // 1. ID 강제 할당 (없으면 생성하되, 가급적 유지)
      const id = typeof rt.id === 'string' && rt.id.trim() !== '' ? rt.id.trim() : `task-${crypto.randomUUID()}`;
      
      // 2. Dependencies 정규화
      let dependencies: string[] = [];
      if (Array.isArray(rt.dependencies)) {
        dependencies = [...new Set(rt.dependencies.map((d: any) => String(d).trim()))];
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
          ? Math.min(rt.budgetTurns, PlanningPolicy.budgets.maxTaskReasoningBudget)
          : PlanningPolicy.budgets.defaultTaskReasoningBudget,
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
