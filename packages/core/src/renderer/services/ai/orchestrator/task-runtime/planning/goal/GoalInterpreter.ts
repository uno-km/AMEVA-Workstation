/**
 * @file orchestrator/task-runtime/planning/goal/GoalInterpreter.ts
 * @system AMEVA OS Desktop Workstation
 * @role User Request -> 구조화된 GoalSpec 으로의 변환 파이프라인
 */

import { GoalSpec, Requirement } from '../domain/PlanningTypes';
import { RequirementExtractor } from './RequirementExtractor';
import { GoalInterpretationError } from '../domain/PlanningErrors';

export class GoalInterpreter {
  private extractor = new RequirementExtractor();

  /**
   * 사용자 요청(문자열)을 구조화된 GoalSpec으로 변환합니다.
   * 실제 구현 시 LLM을 사용하거나 특정 규칙 기반 엔진을 사용할 수 있습니다.
   */
  public async interpret(missionId: string, rawRequest: string): Promise<GoalSpec> {
    if (!rawRequest || rawRequest.trim().length === 0) {
      throw new GoalInterpretationError('User request cannot be empty.');
    }

    const requirements = this.extractor.extract(rawRequest);

    // TODO: Phase 3에서 실제 LLM을 연결하여 산출물, 제약 조건 등을 파싱합니다.
    const mockSpec: GoalSpec = {
      goalId: `goal-${crypto.randomUUID()}`,
      missionId,
      objective: rawRequest.substring(0, 50), // 목표 요약
      userIntent: 'Achieve user objective',
      deliverables: ['Execution Result'], // 최소 1개의 산출물
      constraints: [],
      acceptanceCriteria: ['Task finishes successfully'],
      assumptions: ['Assumed standard environment'],
      missingInformation: [],
      clarificationPolicy: 'ASSUME', // 정보가 모자랄 때 스스로 가정할 것인지 사용자에게 물을 것인지 결정
      sourceRequest: rawRequest,
      requirements,
      createdAt: Date.now(),
      schemaVersion: '1.0',
    };

    return mockSpec;
  }
}
