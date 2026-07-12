/**
 * @file orchestrator/task-runtime/planning/planner/TaskPlanner.ts
 * @system AMEVA OS Desktop Workstation
 */

import { GoalSpec, TaskPlan } from '../domain/PlanningTypes';
import { StrictPlanParser } from './StrictPlanParser';
import { PlanNormalizer } from './PlanNormalizer';

export class TaskPlanner {
  private parser = new StrictPlanParser();
  private normalizer = new PlanNormalizer();

  /**
   * GoalSpec을 입력받아 초기 TaskPlan(DRAFT)를 생성합니다.
   * PHASE 2에서는 LLM 모킹 결과를 즉시 파싱/정규화하여 리턴합니다.
   */
  public async createPlan(spec: GoalSpec): Promise<TaskPlan> {
    // 1. 프롬프트 구성 (LLM에 전달할 정보)
    // const prompt = this.buildPrompt(spec);
    
    // 2. LLM 호출 (모킹)
    const mockLlmOutput = `
      [
        {
          "id": "task_1",
          "title": "Analyze Request",
          "objective": "Understand the core user request",
          "dependencies": [],
          "expectedOutputs": ["Analysis Report"],
          "acceptanceCriteria": ["Report is generated"],
          "capabilityRequirements": ["document.read"],
          "requirementIds": ["req-mock"],
          "budgetTurns": 1000
        },
        {
          "id": "task_2",
          "title": "Execute Plan",
          "objective": "Execute the required steps",
          "dependencies": ["task_1"],
          "expectedOutputs": ["Final Result"],
          "acceptanceCriteria": ["Result matches request"],
          "capabilityRequirements": ["code.execute"],
          "requirementIds": ["req-mock"],
          "budgetTurns": 1000
        }
      ]
    `;

    // 3. 엄격한 파싱
    const parseResult = this.parser.parse(mockLlmOutput);
    if (!parseResult.success) {
      // 파싱 실패 시, 복구 로직으로 가야하지만 초기 생성이므로 바로 DRAFT 생성 
      throw new Error(`Planner output parsing failed: ${parseResult.parseErrors.join(', ')}`);
    }

    // 4. 정규화
    const draftPlan = this.normalizer.normalize(parseResult.parsedData, spec.missionId, spec.goalId);
    draftPlan.plannerSource = 'LLM'; // (mocking)

    return draftPlan;
  }
}
