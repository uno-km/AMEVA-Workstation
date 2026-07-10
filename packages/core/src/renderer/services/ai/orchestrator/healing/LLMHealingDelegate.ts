/**
 * @file orchestrator/healing/LLMHealingDelegate.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/healing/LLMHealingDelegate.ts
 * @role Phase 2 LLM 슬로우 트랙 JSON 복구 위임자
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - SelfHealingMiddleware.ts: Phase 1 실패 시 이 위임자에게 복구 요청을 위임.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 휴리스틱으로 복구 불가한 치명적 JSON 오류를 LLM에게 위임한다.
 * - 발생한 파싱 에러를 Observation 메시지로 대화 컨텍스트에 주입한다.
 * - 모델이 다음 턴에서 스스로 올바른 <tool_call> JSON을 재출력하도록 유도한다.
 * - maxLlmAttempts 초과 시 HealingFailureResult를 반환하여 루프를 보호한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: Observation 주입 후 반드시 모델에게 스트리밍을 요청할 것.
 * - MUST: maxLlmAttempts를 절대 초과하지 않을 것 (무한 루프 방지).
 * - MUST NOT: 복구 과정에서 대화 히스토리를 훼손하지 말 것.
 * - MUST NOT: any 타입을 사용하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ILLMHealingDelegate, HealingResult, HealingContext: 자가 치유 계약 타입.
 */
import type { ILLMHealingDelegate, HealingResult, HealingContext } from './types'

/* ============================================================
 * 내부 상수 (LLM Healing 도메인 지역 상수)
 * ============================================================ */

/**
 * LLM_HEALING_CONSTANTS
 * LLMHealingDelegate 도메인 전용 로컬 상수.
 */
const LLM_HEALING_CONSTANTS = {
  /**
   * LLM Slow-Track 복구 요청 시 사용하는 Observation 접두사.
   * 모델이 이 패턴을 인식하여 이전 <tool_call> 포맷 오류를 인지한다.
   */
  HEAL_OBSERVATION_PREFIX: 'Observation (시스템 에러):',

  /**
   * <tool_call> 재출력을 유도하는 프롬프트 접미사.
   * 모델에게 정확한 JSON 포맷으로 재작성할 것을 지시한다.
   */
  HEAL_INSTRUCTION: [
    '위의 에러는 도구 호출 JSON 포맷이 잘못되었기 때문에 발생했습니다.',
    '다시 시도하십시오. 반드시 아래 정확한 JSON 포맷으로 <tool_call> 태그를 작성하세요:',
    '<tool_call>{"name": "도구명", "args": {"인자명": "값"}}</tool_call>'
  ].join('\n'),

  /**
   * 스트리밍 버퍼에서 <tool_call> JSON을 추출하기 위한 정규식.
   */
  TOOL_CALL_REGEX: /<tool_call>([\s\S]*?)<\/tool_call>/i
} as const

/* ============================================================
 * LLMHealingDelegate 구현체
 * ============================================================ */

/**
 * LLMHealingDelegate
 * ILLMHealingDelegate의 표준 구현체.
 * Phase 1 복구 실패 시 발생한 에러를 Observation으로 컨텍스트에 주입하고
 * 모델에게 다음 턴을 위임하여 스스로 포맷을 수정하도록 유도한다.
 *
 * 작동 방식:
 * 1. 에러 메시지를 Observation 형식으로 user 역할 메시지에 추가.
 * 2. 수정된 컨텍스트로 generateStream() 호출.
 * 3. 모델이 재출력한 <tool_call> JSON을 파싱하여 복구 성공 여부 판정.
 * 4. maxLlmAttempts 초과 시 HealingFailureResult 반환.
 */
export class LLMHealingDelegate implements ILLMHealingDelegate {
  /**
   * LLM에게 포맷 수정을 요청하고 복구 결과를 반환한다.
   *
   * @param parseError - JSON.parse()가 반환한 에러 메시지
   * @param malformedJson - 파싱에 실패한 원본 JSON 문자열
   * @param ctx - 대화 컨텍스트, 엔진 어댑터, 재시도 카운터 등
   * @returns HealingResult
   */
  public async requestHeal(
    parseError: string,
    malformedJson: string,
    ctx: HealingContext
  ): Promise<HealingResult> {
    /*
     * [GUARD: maxLlmAttempts 초과 체크]
     * - 이미 최대 재시도 횟수를 소진한 경우 즉시 실패 반환한다.
     * - 무한 루프 방지의 핵심 가드레일.
     */
    if (ctx.currentLlmAttempts >= ctx.maxLlmAttempts) {
      return {
        success: false,
        error: `[LLMHealing] 최대 LLM 재시도 횟수(${ctx.maxLlmAttempts}회) 초과. 복구 포기.`,
        llmAttempts: ctx.currentLlmAttempts
      }
    }

    /*
     * [GUARD: Engine Adapter Ready Check]
     * - 엔진이 준비 상태인지 확인한다.
     * - 비준비 상태에서 generateStream()을 호출하면 예외가 발생할 수 있다.
     */
    if (!ctx.engineAdapter.isReady()) {
      return {
        success: false,
        error: '[LLMHealing] LLM 엔진이 준비되지 않아 복구 요청 불가.',
        llmAttempts: ctx.currentLlmAttempts
      }
    }

    /*
     * [STEP 1: Observation 빌드]
     * - 파싱 에러와 잘못된 JSON을 포함한 Observation 메시지를 구성한다.
     * - 모델이 자신의 이전 출력 오류를 인지하고 수정하도록 유도한다.
     */
    const observationContent = [
      `${LLM_HEALING_CONSTANTS.HEAL_OBSERVATION_PREFIX}`,
      `파싱 에러: ${parseError}`,
      `잘못된 출력: ${malformedJson}`,
      '',
      LLM_HEALING_CONSTANTS.HEAL_INSTRUCTION
    ].join('\n')

    /*
     * [STEP 2: 수정된 컨텍스트 구성]
     * - 원본 대화 히스토리를 복사하고 Observation을 user 역할로 추가한다.
     * - 원본 conversationHistory는 수정하지 않는다 (불변성 유지).
     */
    const healingContext: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      ...ctx.conversationHistory,
      { role: 'user', content: observationContent }
    ]

    try {
      /*
       * [STEP 3: LLM 재호출]
       * - 수정된 컨텍스트로 스트리밍 생성을 요청한다.
       * - 모델이 재출력한 전체 텍스트를 수집한다.
       */
      let regeneratedOutput = ''
      await ctx.engineAdapter.generateStream(
        healingContext,
        (token) => { regeneratedOutput += token }
      )

      /*
       * [STEP 4: <tool_call> 추출 및 검증]
       * - 재생성된 텍스트에서 <tool_call> 태그를 추출한다.
       * - 추출된 JSON을 파싱하여 복구 성공 여부를 판정한다.
       */
      const toolCallMatch = regeneratedOutput.match(LLM_HEALING_CONSTANTS.TOOL_CALL_REGEX)
      if (!toolCallMatch || !toolCallMatch[1]) {
        return {
          success: false,
          error: `[LLMHealing] 재생성된 출력에서 <tool_call> 태그를 찾을 수 없습니다. 출력: ${regeneratedOutput.slice(0, 200)}`,
          llmAttempts: ctx.currentLlmAttempts + 1
        }
      }

      const extractedJson = toolCallMatch[1].trim()

      /*
       * [STEP 5: 최종 JSON 검증]
       * - 추출된 JSON이 파싱 가능한지 최종 확인한다.
       */
      JSON.parse(extractedJson) // 검증 목적

      return {
        success: true,
        healedJson: extractedJson,
        method: 'llm'
      }
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING]
       * - LLM 재호출 자체가 실패하거나 JSON 파싱이 여전히 실패한 경우.
       * - llmAttempts를 증가시켜 외부 재시도 루프가 상태를 추적할 수 있게 한다.
       */
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[LLMHealingDelegate] LLM 복구 시도 실패:', msg)
      return {
        success: false,
        error: `[LLMHealing] LLM 재호출 후에도 복구 실패: ${msg}`,
        llmAttempts: ctx.currentLlmAttempts + 1
      }
    }
  }
}
