/**
 * @file orchestrator/healing/SelfHealingMiddleware.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/healing/SelfHealingMiddleware.ts
 * @role 2-Stage 자가 치유 미들웨어 조율자 (Phase 1 → Phase 2 오케스트레이터)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: DI 주입받아 <tool_call> 파싱 실패 시 호출.
 *   `onToolCallParseError(malformedJson, parseError, ctx)` 단일 진입점만 노출.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - Phase 1 HeuristicHealingStrategy 시도.
 * - Phase 1 실패 시 Phase 2 LLMHealingDelegate로 폴백.
 * - maxLlmHealAttempts 카운터를 관리하여 무한 루프 방지.
 * - 각 단계의 성공/실패를 IPC 로그에 기록.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: Phase 1은 반드시 Phase 2보다 먼저 실행된다.
 * - MUST: Phase 1 성공 시 Phase 2를 절대 호출하지 않는다 (불필요한 LLM 호출 방지).
 * - MUST NOT: God Class 방지 — 실제 복구 로직을 이 클래스에 구현하지 말 것.
 * - MUST NOT: any 타입을 사용하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ISelfHealingMiddleware, SelfHealingConfig, HealingResult, HealingContext: 계약 타입.
 */
import type {
  ISelfHealingMiddleware,
  SelfHealingConfig,
  HealingResult,
  HealingContext
} from './types'

/*
 * [IPC LOG IMPORT]
 * - ipc.llmAddLog: 미들웨어 복구 이벤트를 엔진 로그 패널에 출력.
 */
import * as ipc from '../../../ipc/electronApiAdapter'

/* ============================================================
 * SelfHealingMiddleware 구현체
 * ============================================================ */

/**
 * SelfHealingMiddleware
 * ISelfHealingMiddleware의 표준 구현체.
 * Phase 1 → Phase 2 순서로 복구를 시도하는 통합 조율자.
 *
 * 사용 예시 (AgentOrchestrator에서):
 * ```ts
 * const healingMiddleware = SelfHealingMiddlewareFactory.create({
 *   maxLlmHealAttempts: 2,
 *   heuristicStrategy: new HeuristicHealingStrategy(),
 *   llmDelegate: new LLMHealingDelegate()
 * })
 * // 파싱 실패 시:
 * const result = await healingMiddleware.onToolCallParseError(malformedJson, error, ctx)
 * ```
 */
export class SelfHealingMiddleware implements ISelfHealingMiddleware {
  /*
   * [PRIVATE STATE - Configuration]
   * - config: 생성자에서 주입받은 불변 설정 객체 (전략 DI 포함).
   */
  private readonly config: SelfHealingConfig

  /*
   * [PRIVATE STATE - LLM Attempt Counter]
   * - llmAttemptCount: 세션 내 LLM 재시도 누적 횟수.
   * - 예상 값: 0 ~ maxLlmHealAttempts.
   * - reset()으로 새 세션 시작 시 초기화 가능.
   */
  private llmAttemptCount: number = 0

  constructor(config: SelfHealingConfig) {
    this.config = config
  }

  /**
   * LLM 재시도 카운터를 초기화한다.
   * 새로운 ReAct 세션 시작 시 AgentOrchestrator가 호출해야 한다.
   */
  public resetAttemptCount(): void {
    this.llmAttemptCount = 0
  }

  /**
   * <tool_call> JSON 파싱 실패 시 호출되는 통합 복구 진입점.
   * Phase 1 → Phase 2 순서로 복구를 시도한다.
   *
   * @param malformedJson - <tool_call> 태그에서 추출된 손상된 JSON 문자열
   * @param parseError - JSON.parse()가 반환한 원본 에러 메시지
   * @param ctx - Phase 2 LLM 슬로우 트랙에 필요한 컨텍스트
   * @returns HealingResult
   */
  public async onToolCallParseError(
    malformedJson: string,
    parseError: string,
    ctx: HealingContext
  ): Promise<HealingResult> {
    ipc.llmAddLog({
      text: `[SelfHealing] tool_call JSON 파싱 실패 감지. Phase 1 시작. 원본: ${malformedJson.slice(0, 100)}`,
      prefix: 'SelfHeal'
    })

    /* ─────────────────────────────────────────────────
     * PHASE 1: HeuristicHealingStrategy (동기, 0ms 목표)
     * ───────────────────────────────────────────────── */
    const phase1Result = this.config.heuristicStrategy.heal(malformedJson)

    if (phase1Result.success) {
      ipc.llmAddLog({
        text: `[SelfHealing] Phase 1 성공 (tryHealJSON). LLM 재호출 없이 복구 완료.`,
        prefix: 'SelfHeal'
      })
      return phase1Result
    }

    ipc.llmAddLog({
      text: `[SelfHealing] Phase 1 실패: ${phase1Result.error}. Phase 2 (LLM Slow-Track) 시작...`,
      prefix: 'SelfHeal'
    })

    /* ─────────────────────────────────────────────────
     * PHASE 2: LLMHealingDelegate (비동기, LLM 재호출)
     * ───────────────────────────────────────────────── */

    /*
     * [GUARD: maxLlmHealAttempts 초과 체크]
     * - 세션 내 LLM 재시도 누적 횟수가 설정된 최대값을 초과했는지 확인한다.
     */
    if (this.llmAttemptCount >= this.config.maxLlmHealAttempts) {
      const failMsg = `[SelfHealing] LLM 재시도 최대 횟수(${this.config.maxLlmHealAttempts}회) 소진. 복구 포기.`
      ipc.llmAddLog({ text: failMsg, prefix: 'SelfHeal' })
      return {
        success: false,
        error: failMsg,
        llmAttempts: this.llmAttemptCount
      }
    }

    /*
     * [CONTEXT INJECTION]
     * - HealingContext에 현재 llmAttemptCount를 주입하여
     *   LLMHealingDelegate가 내부 가드레일을 적용할 수 있게 한다.
     */
    const delegateCtx: HealingContext = {
      ...ctx,
      currentLlmAttempts: this.llmAttemptCount,
      maxLlmAttempts: this.config.maxLlmHealAttempts
    }

    const phase2Result = await this.config.llmDelegate.requestHeal(
      parseError,
      malformedJson,
      delegateCtx
    )

    /*
     * [UPDATE ATTEMPT COUNTER]
     * - Phase 2 시도 결과에 따라 카운터를 갱신한다.
     */
    this.llmAttemptCount = phase2Result.success
      ? this.llmAttemptCount + 1
      : phase2Result.llmAttempts

    if (phase2Result.success) {
      ipc.llmAddLog({
        text: `[SelfHealing] Phase 2 성공 (LLM). 복구 완료. 총 LLM 시도: ${this.llmAttemptCount}회`,
        prefix: 'SelfHeal'
      })
    } else {
      ipc.llmAddLog({
        text: `[SelfHealing] Phase 2 실패: ${phase2Result.error}`,
        prefix: 'SelfHeal'
      })
    }

    return phase2Result
  }
}

/* ============================================================
 * SelfHealingMiddlewareFactory
 * ============================================================ */

/**
 * SelfHealingMiddlewareFactory
 * DI 기반으로 SelfHealingMiddleware 인스턴스를 생성하는 팩토리.
 * AgentOrchestrator 내부에서 직접 new를 사용하지 않고 팩토리를 통해 생성한다.
 */
export class SelfHealingMiddlewareFactory {
  /**
   * SelfHealingConfig를 받아 SelfHealingMiddleware 인스턴스를 생성한다.
   *
   * @param config - 전략 구현체 및 설정 주입 객체
   * @returns ISelfHealingMiddleware 구현체
   */
  public static create(config: SelfHealingConfig): SelfHealingMiddleware {
    return new SelfHealingMiddleware(config)
  }

  /**
   * 기본 설정으로 SelfHealingMiddleware를 생성하는 편의 메서드.
   * AgentOrchestrator가 커스텀 설정 없이 기본 파이프라인을 원할 때 사용.
   *
   * @param maxLlmHealAttempts - LLM 재시도 최대 횟수 (기본값: 2)
   * @param engineAdapter - Phase 2에 사용할 LLM 엔진 어댑터
   * @returns ISelfHealingMiddleware 구현체
   */
  public static createDefault(
    maxLlmHealAttempts: number = 2,
    engineAdapter: import('../types').ILLMEngineAdapter
  ): SelfHealingMiddleware {
    /*
     * [DEFAULT STRATEGY INJECTION]
     * - HeuristicHealingStrategy: tryHealJSON 래핑 구현체.
     * - LLMHealingDelegate: Observation 주입 방식 구현체.
     * - engineAdapter는 createDefault() 외부에서 주입받는다 (DI 원칙).
     */
    const { HeuristicHealingStrategy } = require('./HeuristicHealingStrategy')
    const { LLMHealingDelegate } = require('./LLMHealingDelegate')

    return SelfHealingMiddlewareFactory.create({
      maxLlmHealAttempts,
      heuristicStrategy: new HeuristicHealingStrategy(),
      llmDelegate: new LLMHealingDelegate()
    })
  }
}
