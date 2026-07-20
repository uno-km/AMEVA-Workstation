/**
 * @file orchestrator/task-runtime/planning/planner/TaskPlanner.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { GoalSpec, TaskPlan } from '../domain/PlanningTypes';
import { StrictPlanParser } from './StrictPlanParser';
import { PlanNormalizer } from './PlanNormalizer';

import type { ILLMEngineAdapter } from '../../../types';

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
- outputMode: string (MUST be one of: 'NO_PERSISTED_OUTPUT', 'FILE_OUTPUT_REQUIRED', 'ARTIFACT_OUTPUT_REQUIRED', 'EITHER_FILE_OR_ARTIFACT')
- expectedFileOutputs: string[]
- expectedArtifactOutputs: string[]
- acceptanceCriteria: string[]
- capabilityRequirements: string[]
- requirementIds: string[]
- budgetTurns: number

[CRITICAL RULE FOR OUTPUT MODE]
- If the task creates/modifies files: set outputMode = "FILE_OUTPUT_REQUIRED" AND include the explicit file paths in expectedFileOutputs (e.g. ["report.md"]).
- If the task creates a structured report/plan: set outputMode = "ARTIFACT_OUTPUT_REQUIRED" AND include artifact types in expectedArtifactOutputs.
- If the task is purely for analysis/explanation (no file needed): set outputMode = "NO_PERSISTED_OUTPUT" (expectedFileOutputs and expectedArtifactOutputs can be empty).

[CRITICAL RULE FOR DOCUMENTS/REPORTS]
If the user requests to write a report, document, or generate text content (e.g., "보고서 작성해", "작성해줘"), YOU MUST append a final task at the very end.
The objective of this final task MUST be to output a short completion message and the file path tag, EXACTLY in this format:
"보고서 작성이 완료되었습니다. 이걸 본문에 넣을까요? [FILE_PATH: 생성된_파일_경로.md]"
DO NOT generate the full document content in the chat to save tokens. The system will automatically read the file and append it.

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
