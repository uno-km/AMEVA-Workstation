/**
 * @file orchestrator/healing/HeuristicHealingStrategy.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/healing/HeuristicHealingStrategy.ts
 * @role Phase 1 휴리스틱 JSON 자가 치유 전략 구현체
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - SelfHealingMiddleware.ts: Phase 1 전략 구현체로 DI 주입받아 사용.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 기존 tryHealJSON 유틸리티를 IJsonHealingStrategy 인터페이스로 래핑한다.
 * - 동기(sync) 실행으로 0ms 추가 지연을 목표로 한다.
 * - tryHealJSON 복구 후 JSON.parse() 재시도까지 수행하여 성공 여부를 판정한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: heal()은 절대 async가 되어서는 안 된다 (Phase 1 목표: 즉시 복구).
 * - MUST NOT: LLM을 호출하거나 네트워크 요청을 보내지 말 것.
 * - MUST NOT: any 타입을 사용하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - tryHealJSON: 기존 AMEVA OS 내장 JSON 복구 알고리즘.
 *   괄호 누락, Trailing Comma, 미종결 따옴표를 0ms에 복구.
 */
import { tryHealJSON } from '../../../../utils/agent/tryHealJSON'

/*
 * [TYPE IMPORTS]
 * - IJsonHealingStrategy: Phase 1 전략 계약 인터페이스.
 * - HealingResult: 복구 결과 유니언 타입.
 */
import type { IJsonHealingStrategy, HealingResult } from './types'

/* ============================================================
 * HeuristicHealingStrategy 구현체
 * ============================================================ */

/**
 * HeuristicHealingStrategy
 * IJsonHealingStrategy의 Phase 1 구현체.
 * tryHealJSON 유틸리티를 활용하여 손상된 JSON을 즉시(0ms) 복구 시도한다.
 *
 * 복구 가능한 케이스:
 * - 닫히지 않은 따옴표: `{"name": "run_command", "args": {"cmd": "dir`
 * - Trailing Comma: `{"name": "run_command",}`
 * - 미종결 중괄호/대괄호: `{"name": "run_command", "args": {"cmd": "dir"}`
 * - 단따옴표 사용: `{'name': 'run_command'}`
 *
 * 복구 불가능한 케이스 (Phase 2로 위임):
 * - 필드 자체 누락: `{"name": "run_command"}` (args 필드 없음)
 * - 잘못된 도구 명칭: `{"name": "run_comand"}`
 * - 논리적 오류: 중첩 구조 완전 손상
 */
export class HeuristicHealingStrategy implements IJsonHealingStrategy {
  /**
   * 손상된 JSON을 휴리스틱 알고리즘으로 즉시 복구 시도한다.
   * tryHealJSON → JSON.parse() 재시도 순서로 동작한다.
   *
   * @param malformedJson - <tool_call> 태그에서 추출된 손상된 JSON 문자열
   * @returns HealingResult (성공 시 method: 'heuristic')
   */
  public heal(malformedJson: string): HealingResult {
    /*
     * [VALIDATION - Empty Input Guard]
     * - 빈 문자열이나 공백만 있는 입력은 즉시 실패 반환한다.
     */
    if (!malformedJson || malformedJson.trim() === '') {
      return {
        success: false,
        error: '[HeuristicHealing] 입력 JSON 문자열이 비어있습니다.',
        llmAttempts: 0
      }
    }

    try {
      /*
       * [STEP 1: Apply tryHealJSON Algorithm]
       * - tryHealJSON은 괄호/따옴표 균형 복원, Trailing Comma 제거를 수행한다.
       * - 동기 실행으로 0ms 지연이 보장된다.
       */
      const healedStr = tryHealJSON(malformedJson)

      /*
       * [STEP 2: Validate Healed JSON]
       * - 복구된 문자열이 유효한 JSON인지 JSON.parse()로 검증한다.
       * - 파싱 성공 시 HealingSuccessResult 반환.
       * - 파싱 실패 시 HealingFailureResult 반환 (Phase 2로 위임).
       */
      JSON.parse(healedStr) // 검증 목적, 반환값은 사용하지 않음

      return {
        success: true,
        healedJson: healedStr,
        method: 'heuristic'
      }
    } catch (parseErr: unknown) {
      /*
       * [ERROR HANDLING - Heuristic Failure]
       * - tryHealJSON 후에도 파싱이 실패하면 Phase 2로 위임해야 함을 알린다.
       * - 에러를 침묵시키지 않고 error 필드에 기록한다.
       */
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      return {
        success: false,
        error: `[HeuristicHealing] tryHealJSON 후에도 파싱 실패: ${msg}`,
        llmAttempts: 0
      }
    }
  }
}
