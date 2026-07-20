/**
 * @file orchestrator/task-runtime/planning/goal/GoalInterpreter.ts
 * @system AMEVA OS Desktop Workstation
 * @role User Request → 구조화된 GoalSpec 으로의 변환 파이프라인
 *
 * [P1-4 업데이트]
 * TaskOutputClassifier를 내부에서 실행하여 OutputMode를 결정.
 * 신뢰도 < 60% 시 GoalSpec.outputClassification.needsUserConfirmation=true 설정.
 *
 * [P2-4 업데이트]
 * Fallback 경로에서도 ASSUME 고정 대신 TaskOutputClassifier 결과를 활용.
 */

import type { GoalSpec } from '../domain/PlanningTypes';
import { RequirementExtractor } from './RequirementExtractor';
import { GoalInterpretationError } from '../domain/PlanningErrors';
import { TaskOutputClassifier } from './TaskOutputClassifier';

import type { ILLMEngineAdapter } from '../../../types';

export class GoalInterpreter {
  private extractor = new RequirementExtractor();
  private adapter: ILLMEngineAdapter;
  private classifier: TaskOutputClassifier;

  constructor(adapter: ILLMEngineAdapter) {
    this.adapter = adapter;
    this.classifier = new TaskOutputClassifier(adapter);
  }

  public async interpret(missionId: string, rawRequest: string): Promise<GoalSpec> {
    if (!rawRequest || rawRequest.trim().length === 0) {
      throw new GoalInterpretationError('User request cannot be empty.');
    }

    const requirements = this.extractor.extract(rawRequest);

    /*
     * [P1-4] TaskOutputClassifier 실행
     * 휘리스틱 + LLM 복합 분류 → outputClassification 결과 보관.
     * 신뢰도 < 60% 시 needsUserConfirmation=true 설정.
     */
    const classificationResult = await this.classifier.classify(rawRequest).catch(err => {
      console.warn('[GoalInterpreter] OutputMode 분류 실패, 기본값 사용:', err);
      return null;
    });

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

[clarificationPolicy 결정 규칙]
- 요청이 명확하고 전달물이 구체적이면: "ASSUME"
- 요청이 모호하거나 전달물이 불명확하면: "ASK_USER"

User Request: "${rawRequest}"
`;

    try {
      const response = await this.adapter.generateStream([
        { role: 'system', content: 'You are an expert goal analysis system.' },
        { role: 'user', content: prompt }
      ], () => {});

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        /*
         * [P2-4 FIX] clarificationPolicy 결정
         * OutputClassifier가 50:50이면 무조건 ASK_USER로 오버라이드.
         */
        let clarificationPolicy: 'ASSUME' | 'ASK_USER' =
          parsed.clarificationPolicy === 'ASK_USER' ? 'ASK_USER' : 'ASSUME';
        if (classificationResult?.needsUserConfirmation) {
          clarificationPolicy = 'ASK_USER';
        }

        return {
          goalId: `goal-${crypto.randomUUID()}`,
          missionId,
          objective: parsed.objective || rawRequest.substring(0, 80),
          userIntent: parsed.userIntent || 'Achieve user objective',
          deliverables: parsed.deliverables && parsed.deliverables.length > 0
            ? parsed.deliverables
            : ['Execution Result'],
          constraints: parsed.constraints || [],
          acceptanceCriteria: parsed.acceptanceCriteria || ['Task finishes successfully'],
          assumptions: parsed.assumptions || [],
          missingInformation: parsed.missingInformation || [],
          clarificationPolicy,
          sourceRequest: rawRequest,
          requirements,
          createdAt: Date.now(),
          schemaVersion: '1.0',
          outputClassification: classificationResult ? {
            mode: classificationResult.mode,
            confidence: classificationResult.confidence,
            reasons: classificationResult.reasons,
            needsUserConfirmation: classificationResult.needsUserConfirmation,
            classificationTimeMs: classificationResult.classificationTimeMs
          } : undefined,
        };
      }
    } catch (e) {
      console.warn('[GoalInterpreter] LLM parsing failed, falling back to basic extraction.', e);
    }

    /*
     * [P2-4 FIX] Fallback 경로
     * 이전: 무조건 clarificationPolicy: 'ASSUME' 고정.
     * 수정: OutputClassifier 50:50이면 ASK_USER로 전환.
     */
    const fallbackPolicy: 'ASSUME' | 'ASK_USER' =
      classificationResult?.needsUserConfirmation ? 'ASK_USER' : 'ASSUME';

    return {
      goalId: `goal-${crypto.randomUUID()}`,
      missionId,
      objective: rawRequest.substring(0, 80),
      userIntent: 'Achieve user objective',
      deliverables: ['Execution Result'],
      constraints: [],
      acceptanceCriteria: ['Task finishes successfully'],
      assumptions: ['Assumed standard environment'],
      missingInformation: classificationResult?.needsUserConfirmation
        ? ['Output type preference (file/artifact/analysis?) not clearly specified']
        : [],
      clarificationPolicy: fallbackPolicy,
      sourceRequest: rawRequest,
      requirements,
      createdAt: Date.now(),
      schemaVersion: '1.0',
      outputClassification: classificationResult ? {
        mode: classificationResult.mode,
        confidence: classificationResult.confidence,
        reasons: classificationResult.reasons,
        needsUserConfirmation: classificationResult.needsUserConfirmation,
        classificationTimeMs: classificationResult.classificationTimeMs
      } : undefined,
    };
  }
}
