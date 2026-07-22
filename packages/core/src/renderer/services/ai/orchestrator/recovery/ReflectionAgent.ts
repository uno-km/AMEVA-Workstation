/**
 * @file orchestrator/recovery/ReflectionAgent.ts
 * @system AMEVA OS Desktop Workstation
 * @role 태스크 다회 실패 시 LLM에게 실패 원인을 분석시키고 새로운 전략을 수립하게 하는 성찰 에이전트
 */

import type { ILLMEngineAdapter } from '../types';
import type { Task } from '../task/types';

export interface ProposedPlan {
  analysis: string;
  proposedAction: string;
}

export class ReflectionAgent {
  private llmAdapter: ILLMEngineAdapter;

  constructor(llmAdapter: ILLMEngineAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * 태스크 실패 내역을 분석하고 새로운 제안을 수립합니다.
   *
   * @param task 현재 실패한 태스크
   * @param failureReason 마지막 실패 사유
   * @param previousHistory 이전 수행 내용 요약 (옵션)
   * @returns ProposedPlan (분석 결과와 제안된 행동)
   */
  public async reflectOnFailure(task: Task, failureReason: string, previousHistory?: string): Promise<ProposedPlan> {
    console.info(`[ReflectionAgent] 태스크 ${task.id} 다회 실패에 대한 자아 성찰 시작...`);

    const systemPrompt = `당신은 시스템의 장애 복구를 담당하는 수석 분석가(Reflection Agent)입니다.
현재 에이전트가 단일 태스크를 수행하던 중 최대 재시도 횟수를 초과하여 실패했습니다.
실패 원인을 분석하고, 어떤 도구를 사용하여 어떻게 해결할 것인지 구체적인 계획을 제안하십시오.

출력은 반드시 아래 JSON 포맷을 준수하십시오:
{
  "analysis": "왜 실패했는지에 대한 상세 분석",
  "proposedAction": "다음 번에 어떤 도구를 사용하여 어떻게 문제를 해결할 것인지에 대한 구체적 행동 계획"
}`;

    const userPrompt = `[실패한 태스크 정보]
- ID: ${task.id}
- 제목: ${task.title}
- 목표: ${task.objective}
- 실패 사유: ${failureReason}

위 정보를 바탕으로 실패 원인을 분석하고, 해결을 위한 행동 계획을 JSON 형식으로 제안해 주십시오.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];

    try {
      const rawOutput = await this.llmAdapter.generateStream(messages, () => {
        // 토큰 스트리밍은 UI 정체 방지를 위해 콜백만 수신
      });

      console.debug(`[ReflectionAgent] 원본 출력:\n${rawOutput}`);

      // JSON 추출 및 파싱
      const jsonStr = this.extractJson(rawOutput);
      const result = JSON.parse(jsonStr);

      if (!result.analysis || !result.proposedAction) {
        throw new Error('필수 필드(analysis, proposedAction) 누락');
      }

      return {
        analysis: result.analysis,
        proposedAction: result.proposedAction
      };
    } catch (err) {
      console.error(`[ReflectionAgent] 자아 성찰 추론 실패:`, err);
      // Fallback
      return {
        analysis: `LLM 분석 실패 (원인: ${failureReason})`,
        proposedAction: '문맥을 초기화하고 다른 도구를 사용하거나 프롬프트를 조정하여 다시 시도합니다.'
      };
    }
  }

  private extractJson(text: string): string {
    const cleanText = text.trim();
    const blockMatch = cleanText.match(/```(?:json)?([\s\S]*?)```/i);
    if (blockMatch && blockMatch[1]) {
      return blockMatch[1].trim();
    }
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return cleanText.substring(firstBrace, lastBrace + 1);
    }
    return cleanText;
  }
}
