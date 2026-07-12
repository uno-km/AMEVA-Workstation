/**
 * @file orchestrator/task-runtime/planning/goal/GoalInterpreter.ts
 * @system AMEVA OS Desktop Workstation
 * @role User Request -> 구조화된 GoalSpec 으로의 변환 파이프라인
 */

import type { GoalSpec } from '../domain/PlanningTypes';
import { RequirementExtractor } from './RequirementExtractor';
import { GoalInterpretationError } from '../domain/PlanningErrors';

import type { ILLMEngineAdapter } from '../../../types';

export class GoalInterpreter {
  private extractor = new RequirementExtractor();
  private adapter: ILLMEngineAdapter;

  constructor(adapter: ILLMEngineAdapter) {
    this.adapter = adapter;
  }

  public async interpret(missionId: string, rawRequest: string): Promise<GoalSpec> {
    if (!rawRequest || rawRequest.trim().length === 0) {
      throw new GoalInterpretationError('User request cannot be empty.');
    }

    const requirements = this.extractor.extract(rawRequest);

    // LLM 프롬프트 구성
    const prompt = `
You are a Goal Interpreter. Extract structured information from the following user request.
Output ONLY a JSON object that matches the GoalSpec format:
{
  "objective": "short summary",
  "userIntent": "underlying intent",
  "deliverables": ["Output 1", "Output 2"],
  "constraints": [],
  "acceptanceCriteria": ["criteria 1"],
  "assumptions": [],
  "missingInformation": [],
  "clarificationPolicy": "ASSUME"
}

User Request: "${rawRequest}"
`;

    try {
      const response = await this.adapter.generateStream([
        { role: 'system', content: 'You are an expert system.' },
        { role: 'user', content: prompt }
      ], () => {});

      // JSON 추출 시도
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          goalId: `goal-${crypto.randomUUID()}`,
          missionId,
          objective: parsed.objective || rawRequest.substring(0, 50),
          userIntent: parsed.userIntent || 'Achieve user objective',
          deliverables: parsed.deliverables && parsed.deliverables.length > 0 ? parsed.deliverables : ['Execution Result'],
          constraints: parsed.constraints || [],
          acceptanceCriteria: parsed.acceptanceCriteria || ['Task finishes successfully'],
          assumptions: parsed.assumptions || [],
          missingInformation: parsed.missingInformation || [],
          clarificationPolicy: parsed.clarificationPolicy || 'ASSUME',
          sourceRequest: rawRequest,
          requirements,
          createdAt: Date.now(),
          schemaVersion: '1.0',
        };
      }
    } catch (e) {
      console.warn('[GoalInterpreter] LLM parsing failed, falling back to basic extraction.', e);
    }

    // Fallback
    return {
      goalId: `goal-${crypto.randomUUID()}`,
      missionId,
      objective: rawRequest.substring(0, 50),
      userIntent: 'Achieve user objective',
      deliverables: ['Execution Result'],
      constraints: [],
      acceptanceCriteria: ['Task finishes successfully'],
      assumptions: ['Assumed standard environment'],
      missingInformation: [],
      clarificationPolicy: 'ASSUME',
      sourceRequest: rawRequest,
      requirements,
      createdAt: Date.now(),
      schemaVersion: '1.0',
    };
  }
}
