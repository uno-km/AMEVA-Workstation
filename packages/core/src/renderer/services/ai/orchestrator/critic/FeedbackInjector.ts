/**
 * @file orchestrator/critic/FeedbackInjector.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/critic/FeedbackInjector.ts
 * @role Critic REJECT 판정 시 Actor 히스토리에 피드백 Observation 주입기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - ActorCriticHook.ts: REJECT 판정 시 Actor 히스토리 수정을 위해 호출.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - CriticRejectVerdict에 담긴 거부 사유와 수정 제안을 Observation 메시지로 포맷한다.
 * - 포맷된 Observation을 Actor 대화 히스토리 배열에 user 역할로 추가한다.
 * - 주입된 피드백은 다음 턴에서 Actor가 재생성 시 컨텍스트로 활용한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 히스토리 원본 배열을 직접 수정한다 (참조 수정). 복사본을 반환하지 않음.
 * - MUST NOT: any 타입을 사용하지 말 것.
 */

/*
 * [TYPE IMPORTS]
 * - IFeedbackInjector, CriticRejectVerdict, CriticPayload: 계약 타입.
 */
import type { IFeedbackInjector, CriticRejectVerdict } from './types'
import type { CriticPayload } from './types'

/* ============================================================
 * 내부 상수 (FeedbackInjector 도메인 지역 상수)
 * ============================================================ */

/**
 * FEEDBACK_CONSTANTS
 * FeedbackInjector 도메인 전용 로컬 상수.
 */
const FEEDBACK_CONSTANTS = {
  /** tool_call 검수 거부 시 Observation 접두사 */
  TOOL_CALL_PREFIX: 'Observation (비평가 검수 거부):',
  /** final_answer 검수 거부 시 Observation 접두사 */
  FINAL_ANSWER_PREFIX: 'Observation (비평가 답변 검수 거부):',
  /** 재생성 지시 공통 접미사 */
  REGENERATE_INSTRUCTION: '위의 피드백을 반영하여 다시 시도하십시오.'
} as const

/* ============================================================
 * FeedbackInjector 구현체
 * ============================================================ */

/**
 * FeedbackInjector
 * IFeedbackInjector의 표준 구현체.
 * REJECT 판정 사유를 Actor 대화 히스토리에 Observation으로 주입한다.
 *
 * 주입되는 메시지 예시 (tool_call):
 * ```
 * [역할: user]
 * Observation (비평가 검수 거부):
 * 도구 호출 'run_command'이 거부되었습니다.
 *
 * 거부 사유: rm -rf 명령어는 파괴적이며 실행이 금지됩니다.
 * 수정 제안: 특정 파일만 삭제하도록 명령어를 수정하십시오.
 *
 * 위의 피드백을 반영하여 다시 시도하십시오.
 * ```
 */
export class FeedbackInjector implements IFeedbackInjector {
  /**
   * REJECT 판정 사유를 Actor 히스토리에 Observation으로 주입한다.
   *
   * @param verdict - Critic의 REJECT 판정 결과
   * @param history - 수정할 Actor 대화 히스토리 배열 (직접 수정)
   * @param targetKind - 검수 대상 종류 ('tool_call' | 'final_answer')
   */
  public injectRejection(
    verdict: CriticRejectVerdict,
    history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    targetKind: CriticPayload['kind']
  ): void {
    /*
     * [STEP 1: Observation 메시지 빌드]
     * - 검수 대상 종류에 따라 접두사를 다르게 적용한다.
     * - 거부 사유와 수정 제안을 Observation 본문에 포함한다.
     */
    const prefix = targetKind === 'tool_call'
      ? FEEDBACK_CONSTANTS.TOOL_CALL_PREFIX
      : FEEDBACK_CONSTANTS.FINAL_ANSWER_PREFIX

    const observationLines: string[] = [prefix]

    if (targetKind === 'tool_call') {
      observationLines.push('도구 호출이 비평가(Critic)에 의해 거부되었습니다.')
    } else {
      observationLines.push('최종 답변이 비평가(Critic)에 의해 거부되었습니다.')
    }

    observationLines.push('')
    observationLines.push(`거부 사유: ${verdict.reason}`)

    /*
     * [OPTIONAL: 수정 제안 포함]
     * - suggestedFix가 있을 경우에만 포함한다.
     */
    if (verdict.suggestedFix) {
      observationLines.push(`수정 제안: ${verdict.suggestedFix}`)
    }

    observationLines.push('')
    observationLines.push(FEEDBACK_CONSTANTS.REGENERATE_INSTRUCTION)

    const observationContent = observationLines.join('\n')

    /*
     * [STEP 2: 히스토리에 주입]
     * - user 역할 메시지로 Observation을 추가한다.
     * - Actor 모델은 다음 턴에서 이 Observation을 컨텍스트로 읽는다.
     */
    history.push({ role: 'user', content: observationContent })
  }
}
