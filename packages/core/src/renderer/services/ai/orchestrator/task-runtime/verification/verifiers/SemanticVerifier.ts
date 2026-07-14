/**
 * @file orchestrator/task-runtime/verification/verifiers/SemanticVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role LLM을 사용하거나 고급 휴리스틱을 통해 Task Acceptance Criteria가 논리적으로 충족되었는지 검사
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - VerificationRuntime: TaskVerifier 파이프라인의 Semantic 검증 단계
 *
 * [FINAL REMEDIATION — STAGE C] LLM Adapter 실제 연결
 * - 이전: 모든 Criterion에 FAIL을 반환하는 DISABLED_SAFELY stub
 * - 이후: ILLMEngineAdapter.generateStream()을 통해 실제 LLM 판정 수행
 * - LLM 가용 여부 확인 후 불가 시 UNCERTAIN으로 폴백 (False PASS/False FAIL 방지)
 * - 파싱 실패 시 UNCERTAIN 반환 — PASS 반환 절대 금지
 *
 * [False Success 방지 계약]
 * - LLM 판정 실패(에러, 타임아웃, 파싱 불가) 시 PASS 반환 절대 금지
 * - UNCERTAIN 반환 → 상위 VerificationRuntime이 NEEDS_REVIEW로 처리
 * - isReady() false 시 NOT_APPLICABLE 반환 (LLM 미연결 환경에서 검증 차단)
 */

import type { TaskVerifier } from './TaskVerifier';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';
import { VERIFICATION_TIMEOUT_POLICY } from '../domain/VerificationTimeoutPolicy';
import type { ILLMEngineAdapter } from '../../../types';


/**
 * [Semantic 판정 요청 프롬프트 상수]
 * LLM에게 Acceptance Criteria 충족 여부를 판단하도록 요청하는 프롬프트 템플릿.
 */
const SEMANTIC_JUDGE_SYSTEM_PROMPT = `You are a strict task completion evaluator.
Given a task result text and an acceptance criterion, determine if the result satisfies the criterion.
Respond ONLY with JSON matching this structure:
{
  "verdict": "PASS" | "FAIL" | "UNCERTAIN",
  "reason": "<concise reason>",
  "confidence": 0.0-1.0,
  "defects": [
    {
      "type": "SEMANTIC_INCONSISTENCY" | "REQUIREMENT_UNCOVERED" | "INSUFFICIENT_EVIDENCE",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "targetSection": "Optional section name",
      "message": "Specific defect description",
      "repairInstruction": "How to fix",
      "retryScope": "ARTIFACT" | "SECTION" | "FIELD" | "FILE" | "FUNCTION" | "TEST" | "TOOL_CALL" | "FULL_TASK",
      "retryable": true
    }
  ]
}
Do NOT add any text outside the JSON. Be conservative: if unsure, respond UNCERTAIN, never PASS.`;

/**
 * [LLM 판정 응답 파싱 결과 타입]
 */
interface LLMJudgementResponse {
  verdict: 'PASS' | 'FAIL' | 'UNCERTAIN';
  reason: string;
  confidence: number;
  defects?: any[];
}

/**
 * [LLM 응답 판정 안전 파싱]
 */
function parseLLMJudgement(raw: string): LLMJudgementResponse | null {
  try {
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const parsed: unknown = JSON.parse(jsonStr);
    if (
      typeof parsed !== 'object' || parsed === null ||
      !('verdict' in parsed) || !('reason' in parsed) || !('confidence' in parsed)
    ) return null;
    
    const p = parsed as Record<string, unknown>;
    const verdict = p['verdict'];
    if (verdict !== 'PASS' && verdict !== 'FAIL' && verdict !== 'UNCERTAIN') return null;
    
    if (typeof p['reason'] !== 'string') return null;
    if (typeof p['confidence'] !== 'number') return null;

    if ('defects' in p) {
      if (!Array.isArray(p['defects'])) return null;
      for (const d of p['defects']) {
        if (typeof d !== 'object' || d === null) return null;
        const def = d as Record<string, unknown>;
        if (typeof def['type'] !== 'string' || typeof def['severity'] !== 'string' || typeof def['message'] !== 'string') return null;
      }
    }

    return {
      verdict,
      reason: p['reason'],
      confidence: Math.max(0, Math.min(1, p['confidence'])),
      defects: p['defects'] as any[] | undefined
    };
  } catch {
    return null;
  }
}

export class SemanticVerifier implements TaskVerifier {
  public readonly verifierType = 'SEMANTIC_VERIFIER';
  public readonly verifierVersion = '2.0.0'; // [STAGE C] LLM 연결 버전

  /*
   * [LLM Adapter]
   * 생성자에서 주입. 미주입 시 null로 폴백 처리.
   * VerificationRuntime이 DeepTaskExecutor의 adapter를 전달해야 함.
   */
  private readonly adapter: ILLMEngineAdapter | null;

  constructor(adapter?: ILLMEngineAdapter) {
    this.adapter = adapter ?? null;
  }

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    const criteria = input.taskDefinition.acceptanceCriteria || [];

    if (criteria.length === 0) {
      results.push({
        criterionId: 'semantic_acceptance',
        verifierType: this.verifierType,
        verdict: 'NOT_APPLICABLE',
        reason: 'No acceptance criteria defined for semantic verification.',
      });
      return results;
    }

    /*
     * [LLM 가용성 검사]
     * LLM Adapter가 없거나 isReady()가 false이면 NOT_APPLICABLE 반환.
     * DISABLED_SAFELY stub의 FAIL 반환보다 정확한 상태 보고.
     */
    if (!this.adapter || !this.adapter.isReady()) {
      for (const criterion of criteria) {
        results.push({
          criterionId: `semantic_criterion_${crypto.randomUUID()}`,
          verifierType: this.verifierType,
          verdict: 'NOT_APPLICABLE',
          reason: `Semantic verification for "${criterion}" is NOT_APPLICABLE: LLM adapter is not connected or not ready.`,
          repairHint: 'Ensure LLM adapter is initialized before verification.',
          confidence: 0.0
        });
      }
      return results;
    }

    /*
     * [Task Result 추출]
     * VerificationInput에서 Task의 실제 실행 결과 텍스트를 추출.
     * 결과가 없으면 FAIL로 판정.
     */
    const taskResultText = input.taskState.taskResult?.summary ?? '';
    if (!taskResultText.trim()) {
      for (const criterion of criteria) {
        results.push({
          criterionId: `semantic_criterion_${crypto.randomUUID()}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Semantic verification for "${criterion}" failed: Task result output is empty.`,
          repairHint: 'Task execution produced no output. Retry execution.',
          confidence: 1.0
        });
      }
      return results;
    }

    /*
     * [Criterion별 LLM 판정 실행]
     * 각 Acceptance Criterion에 대해 독립적으로 LLM 판정을 요청.
     * 타임아웃 5초 이내 응답 없으면 UNCERTAIN 처리.
     */
    for (const criterion of criteria) {
      const criterionId = `semantic_criterion_${crypto.randomUUID()}`;
      try {
        const userPrompt = [
          `Task Result:\n${taskResultText.slice(0, 2000)}`,  // 2000자 제한
          `Acceptance Criterion: "${criterion}"`,
          'Does the task result satisfy this criterion?'
        ].join('\n\n');

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: SEMANTIC_JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ];

        let judgement: LLMJudgementResponse | null = null;
        let attempt = 0;
        let lastRawResponse = '';
        let localLlmCalls = 0;

        while (attempt < 2) {
          attempt++;
          let rawResponse = '';
          const timeoutMs = VERIFICATION_TIMEOUT_POLICY.totalVerificationTimeoutMs;
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error(`SemanticVerifier LLM timeout (${timeoutMs}ms)`)), timeoutMs)
          );
          
          let repairMessage = '';
          if (attempt === 2) {
            repairMessage = `\nYour previous response was invalid JSON or missing required schema fields. Please try again with valid JSON only. Raw response was: ${lastRawResponse.slice(0, 500)}`;
          }

          const generatePromise = this.adapter.generateStream([
            { role: 'system', content: SEMANTIC_JUDGE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt + repairMessage }
          ], () => { /* noop */ });

          localLlmCalls++;
          rawResponse = await Promise.race([generatePromise, timeoutPromise]);
          lastRawResponse = rawResponse;

          // 1차 파싱 시도
          judgement = parseLLMJudgement(rawResponse);
          
          if (!judgement) {
            // 로컬 deterministic JSON repair (추가 LLM 호출 없음)
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
               try {
                 // 좀 더 적극적인 복구 (예: 누락된 괄호 채우기, trailing comma 제거 등 - 여기서는 단순 정규식 기반)
                 let fixed = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                 judgement = parseLLMJudgement(fixed);
               } catch {
                 judgement = null;
               }
            }
          }

          // 자유 텍스트 PASS 방어
          if (judgement && judgement.verdict === 'PASS') {
             if (rawResponse.trim() === 'PASS' || rawResponse.trim() === '[PASS]' || rawResponse.trim() === '') {
                 judgement = null; // 절대 PASS 처리 금지
             }
          }

          if (judgement) {
            break;
          }
        }

        if (!judgement) {
          results.push({
            criterionId,
            verifierType: this.verifierType,
            verdict: 'UNCERTAIN',
            reason: `LLM response could not be parsed for criterion "${criterion}". Raw: ${lastRawResponse.slice(0, 200)}`,
            repairHint: 'Check LLM output format. Ensure model follows JSON verdict format.',
            confidence: 0.0,
            llmCallCount: localLlmCalls,
            defect: {
              defectId: `def-${crypto.randomUUID()}`,
              signature: `SEMANTIC:CRITIC_RESPONSE_INVALID:parse_error`,
              stage: 'SEMANTIC',
              type: 'CRITIC_RESPONSE_INVALID',
              severity: 'HIGH',
              required: true,
              message: 'Failed to parse LLM judgment',
              retryable: true,
              retryScope: 'FULL_TASK'
            }
          });
        } else {
          // If verdict is FAIL and defects array is provided, map them
          if (judgement.verdict === 'FAIL' && judgement.defects && judgement.defects.length > 0) {
            for (const d of judgement.defects) {
              results.push({
                criterionId,
                verifierType: this.verifierType,
                verdict: 'FAIL',
                reason: judgement.reason,
                confidence: judgement.confidence,
                llmCallCount: localLlmCalls,
                defect: {
                  defectId: `def-${crypto.randomUUID()}`,
                  signature: `SEMANTIC:${d.type || 'SEMANTIC_INCONSISTENCY'}:${d.targetSection || 'unknown'}:${criterionId}`,
                  stage: 'SEMANTIC',
                  type: d.type || 'SEMANTIC_INCONSISTENCY',
                  severity: d.severity || 'MEDIUM',
                  required: true,
                  targetSection: d.targetSection,
                  message: d.message || judgement.reason,
                  repairInstruction: d.repairInstruction,
                  retryable: d.retryable ?? true,
                  retryScope: d.retryScope || 'FULL_TASK'
                }
              });
            }
          } else {
            results.push({
              criterionId,
              verifierType: this.verifierType,
              verdict: judgement.verdict,
              reason: judgement.reason,
              repairHint: judgement.verdict !== 'PASS' ? `LLM determined criterion "${criterion}" was not met.` : undefined,
              confidence: judgement.confidence,
              llmCallCount: localLlmCalls,
              defect: judgement.verdict === 'FAIL' ? {
                defectId: `def-${crypto.randomUUID()}`,
                signature: `SEMANTIC:SEMANTIC_INCONSISTENCY:unknown:${criterionId}`,
                stage: 'SEMANTIC',
                type: 'SEMANTIC_INCONSISTENCY',
                severity: 'MEDIUM',
                required: true,
                message: judgement.reason,
                retryable: true,
                retryScope: 'FULL_TASK'
              } : undefined
            });
          }
        }
      } catch (error: unknown) {
        /*
         * [LLM 호출 예외 처리]
         * 오류 발생 시 UNCERTAIN 반환. PASS 반환 절대 금지.
         * catch(e) {} 침묵 예외 절대 금지 (AGENTS.md 규칙 5).
         */
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SemanticVerifier] LLM verification failed for criterion "${criterion}": ${errorMessage}`);
        results.push({
          criterionId,
          verifierType: this.verifierType,
          verdict: 'UNCERTAIN',
          reason: `LLM verification error for "${criterion}": ${errorMessage}`,
          repairHint: 'Semantic verification failed due to LLM error. Manual review required.',
          confidence: 0.0,
          defect: {
            defectId: `def-${crypto.randomUUID()}`,
            signature: `SEMANTIC:CRITIC_UNAVAILABLE:error`,
            stage: 'SEMANTIC',
            type: 'CRITIC_UNAVAILABLE',
            severity: 'HIGH',
            required: true,
            message: errorMessage,
            retryable: true,
            retryScope: 'FULL_TASK'
          }
        });
      }
    }

    return results;
  }
}
