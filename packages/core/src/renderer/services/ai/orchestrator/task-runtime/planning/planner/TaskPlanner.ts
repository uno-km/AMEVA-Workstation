/**
 * @file orchestrator/task-runtime/planning/planner/TaskPlanner.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { GoalSpec, TaskPlan } from '../domain/PlanningTypes';
import { StrictPlanParser } from './StrictPlanParser';
import { PlanNormalizer } from './PlanNormalizer';

import type { ILLMEngineAdapter } from '../../types';

export class TaskPlanner {
  private parser = new StrictPlanParser();
  private normalizer = new PlanNormalizer();
  private adapter: ILLMEngineAdapter;

  constructor(adapter: ILLMEngineAdapter) {
    this.adapter = adapter;
  }

  public async createPlan(spec: GoalSpec): Promise<TaskPlan> {
    const prompt = `
You are a Task Planner. Create a JSON array of tasks based on the following GoalSpec.
Each task must have:
- id: string
- title: string
- objective: string
- dependencies: string[] (array of task ids)
- expectedOutputs: string[]
- acceptanceCriteria: string[]
- capabilityRequirements: string[]
- requirementIds: string[]
- budgetTurns: number

Goal Objective: ${spec.objective}
Deliverables: ${spec.deliverables.join(', ')}

Output ONLY valid JSON array.
`;

    let llmOutput = '';
    try {
      llmOutput = await this.adapter.generateStream([
        { role: 'system', content: 'You are an expert system.' },
        { role: 'user', content: prompt }
      ], () => {});
    } catch (e) {
      throw new Error(`LLM call failed in TaskPlanner: ${e}`);
    }

    // JSON 추출
    const jsonMatch = llmOutput.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not find JSON array in LLM output.');
    }

    const parseResult = this.parser.parse(jsonMatch[0]);
    if (!parseResult.success) {
      throw new Error(`Planner output parsing failed: ${parseResult.parseErrors.join(', ')}`);
    }

    const draftPlan = this.normalizer.normalize(parseResult.parsedData, spec.missionId, spec.goalId);
    draftPlan.plannerSource = 'LLM';

    return draftPlan;
  }
}
