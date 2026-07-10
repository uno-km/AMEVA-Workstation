/**
 * @file orchestrator/critic/LLMCriticStrategy.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/critic/LLMCriticStrategy.ts
 * @role 1.5B Critic 모델 기반 ICriticStrategy 구현체
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ActorCriticHook.ts: DI로 주입받아 Critic 검수 시 사용.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 1.5B Critic 전용 모델(또는 Actor 모델)을 경량 프롬프트로 호출한다.
 * - 검수 프롬프트: "주어진 코드/명령어에 보안 결함이나 구문 에러가 있는가? [PASS] or [REJECT: Reason]"
 * - 모델 출력에서 [PASS] / [REJECT: ...] 패턴을 파싱하여 CriticVerdict로 변환한다.
 * - 파싱 실패 시 (모델이 포맷을 어긴 경우) 안전 폴백으로 PASS를 반환한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: evaluate()는 항상 CriticVerdict를 반환해야 한다 (throw 금지).
 * - MUST: Critic 검수 시간(latencyMs)을 반드시 측정하여 반환에 포함할 것.
 * - MUST NOT: any 타입을 사용하지 말 것.
 * - MUST NOT: Critic 실패 시 전체 루프를 중단하지 말 것 (PASS 폴백).
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ICriticStrategy, CriticContext, CriticVerdict: 계약 타입.
 */
import type { ICriticStrategy, CriticContext, CriticVerdict } from './types'

/* ============================================================
 * 내부 상수 (Critic 도메인 지역 상수)
 * ============================================================ */

/**
 * CRITIC_CONSTANTS
 * LLMCriticStrategy 도메인 전용 로컬 상수.
 */
const CRITIC_CONSTANTS = {
  /**
   * Critic 모델에게 주입하는 시스템 프롬프트.
   * Actor(7B)와 완전히 분리된 독립 검수 역할을 수행한다.
   *
   * 출력 포맷 강제:
   * - 통과: [PASS]
   * - 거부: [REJECT: {사유}]
   */
  SYSTEM_PROMPT: [
    '당신은 코드 및 명령어 보안 감사관(Security Auditor)입니다.',
    '주어진 코드나 명령어, 답변을 검수하여 아래 기준으로 판정하십시오:',
    '',
    '판정 기준:',
    '1. 보안 취약점 (파일 시스템 무단 접근, 환경 변수 노출, rm -rf 류 파괴적 명령어)',
    '2. 명백한 구문 오류 (실행 불가능한 명령어 형식)',
    '3. 사용자 의도와 완전히 상반된 동작',
    '',
    '반드시 아래 두 형식 중 하나로만 응답하십시오:',
    '[PASS]',
    '[REJECT: 구체적인 거부 사유와 수정 방법]',
    '',
    '다른 텍스트는 절대 출력하지 마십시오.'
  ].join('\n'),

  /**
   * PASS 판정 파싱 정규식.
   */
  PASS_REGEX: /\[PASS\]/i,

  /**
   * REJECT 판정 파싱 정규식. 사유를 캡처 그룹으로 추출.
   */
  REJECT_REGEX: /\[REJECT:\s*([\s\S]*?)\]/i,

  /**
   * Critic 모델 출력 최대 토큰 수.
   * 판정 결과만 출력하므로 128토큰으로 충분하다.
   * 이 값을 초과하면 응답이 잘릴 수 있음.
   */
  MAX_OUTPUT_TOKENS: 128
} as const

/* ============================================================
 * LLMCriticStrategy 구현체
 * ============================================================ */

/**
 * LLMCriticStrategy
 * ICriticStrategy의 LLM 기반 구현체.
 * Critic 전용 1.5B 모델을 경량 프롬프트로 호출하여 검수한다.
 *
 * 모델 스와핑 전략:
 * - CriticContext.criticEngineAdapter는 Actor 엔진과 별개의 어댑터다.
 * - AgentOrchestrator가 beforeToolCall/beforeFinalAnswer 호출 시
 *   criticEngineAdapter를 주입하므로, 이 클래스는 스와핑 로직을 몰라도 된다.
 *
 * 판정 로직:
 * 1. 페이로드를 검수 대상 텍스트로 직렬화.
 * 2. Critic 엔진에 검수 프롬프트 + 검수 대상 전송.
 * 3. 모델 출력에서 [PASS] / [REJECT: ...] 파싱.
 * 4. 파싱 실패 시 안전 폴백: PASS 반환 (루프 중단 방지).
 */
export class LLMCriticStrategy implements ICriticStrategy {
  /**
   * 주어진 컨텍스트를 Critic 모델로 검수하고 판정을 반환한다.
   *
   * @param ctx - Critic 엔진 어댑터 및 검수 페이로드 컨텍스트
   * @returns CriticVerdict (항상 반환, throw 금지)
   */
  public async evaluate(ctx: CriticContext): Promise<CriticVerdict> {
    const startTime = Date.now()

    try {
      /*
       * [GUARD: Engine Ready Check]
       * - Critic 엔진이 준비 상태인지 확인한다.
       * - 미준비 상태면 안전 폴백(PASS)을 반환한다.
       */
      if (!ctx.criticEngineAdapter.isReady()) {
        console.warn('[LLMCriticStrategy] Critic 엔진 미준비. 안전 폴백(PASS) 반환.')
        return { verdict: 'PASS', latencyMs: Date.now() - startTime }
      }

      /*
       * [STEP 1: 검수 대상 텍스트 직렬화]
       * - CriticPayload를 Critic 모델이 이해할 수 있는 텍스트로 변환한다.
       */
      const subjectText = this.serializePayload(ctx.payload)

      /*
       * [STEP 2: Critic 모델 호출]
       * - 시스템 프롬프트 + 검수 대상 텍스트로 비동기 스트리밍을 요청한다.
       * - CRITIC_CONSTANTS.MAX_OUTPUT_TOKENS 초과 시 응답이 잘릴 수 있다.
       */
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: CRITIC_CONSTANTS.SYSTEM_PROMPT },
        { role: 'user', content: `검수 대상:\n${subjectText}` }
      ]

      let criticOutput = ''
      await ctx.criticEngineAdapter.generateStream(
        messages,
        (token) => { criticOutput += token }
      )

      /*
       * [STEP 3: 판정 파싱]
       * - 모델 출력에서 [PASS] 또는 [REJECT: 사유] 패턴을 추출한다.
       */
      return this.parseVerdict(criticOutput.trim(), startTime)
    } catch (err: unknown) {
      /*
       * [ERROR HANDLING - Safe Fallback]
       * - Critic 실행 자체가 실패한 경우 루프를 중단하지 않기 위해
       *   안전 폴백으로 PASS를 반환한다.
       * - 에러는 console.error로 기록하여 침묵시키지 않는다.
       */
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[LLMCriticStrategy] Critic 실행 예외. 안전 폴백(PASS) 반환:', msg)
      return { verdict: 'PASS', latencyMs: Date.now() - startTime }
    }
  }

  /* ──────────────────────────────────────────
   * private: 페이로드 직렬화
   * ────────────────────────────────────────── */

  /**
   * CriticPayload를 Critic 모델이 이해할 수 있는 텍스트로 변환한다.
   */
  private serializePayload(payload: import('./types').CriticPayload): string {
    if (payload.kind === 'tool_call') {
      return [
        `도구 호출 검수 요청:`,
        `  도구명: ${payload.toolName}`,
        `  인자:`,
        `  ${JSON.stringify(payload.toolArgs, null, 2)}`,
        ``,
        `실행 컨텍스트 (요약):`,
        `  ${payload.conversationContext.slice(0, 300)}`
      ].join('\n')
    }

    return [
      `최종 답변 검수 요청:`,
      ``,
      `원래 질문:`,
      `  ${payload.originalQuery}`,
      ``,
      `생성된 답변:`,
      `  ${payload.answer.slice(0, 500)}`
    ].join('\n')
  }

  /* ──────────────────────────────────────────
   * private: 판정 파싱
   * ────────────────────────────────────────── */

  /**
   * 모델 출력 텍스트에서 CriticVerdict를 파싱한다.
   * 파싱 실패 시 안전 폴백(PASS)을 반환한다.
   */
  private parseVerdict(output: string, startTime: number): CriticVerdict {
    const latencyMs = Date.now() - startTime

    /*
     * [REJECT 우선 파싱]
     * - REJECT 패턴이 있으면 사유를 추출하여 CriticRejectVerdict 반환.
     */
    const rejectMatch = output.match(CRITIC_CONSTANTS.REJECT_REGEX)
    if (rejectMatch) {
      const reason = rejectMatch[1]?.trim() ?? '사유 없음'
      return { verdict: 'REJECT', reason, latencyMs }
    }

    /*
     * [PASS 파싱]
     * - PASS 패턴이 있으면 CriticPassVerdict 반환.
     */
    if (CRITIC_CONSTANTS.PASS_REGEX.test(output)) {
      return { verdict: 'PASS', latencyMs }
    }

    /*
     * [안전 폴백]
     * - 모델이 포맷을 어긴 경우 PASS로 폴백하여 루프 중단을 방지한다.
     * - console.warn으로 기록하여 추후 디버깅이 가능하게 한다.
     */
    console.warn(
      '[LLMCriticStrategy] 판정 포맷 파싱 실패. 안전 폴백(PASS) 반환.',
      `출력: "${output.slice(0, 100)}"`
    )
    return { verdict: 'PASS', latencyMs }
  }
}
