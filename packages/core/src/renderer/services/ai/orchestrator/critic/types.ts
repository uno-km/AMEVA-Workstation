/**
 * @file orchestrator/critic/types.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/critic/types.ts
 * @role Actor-Critic 검증 훅 전용 타입 계약
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - LLMCriticStrategy.ts: Critic 모델 전략 구현 시 소비.
 * - ActorCriticHook.ts: 훅 구현 시 소비.
 * - FeedbackInjector.ts: 피드백 주입 시 소비.
 * - AgentOrchestrator.ts: 주입 포인트에서 인터페이스 타입 참조 시 소비.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: 이 파일에서 런타임 로직을 정의하지 말 것.
 * - MUST: 모든 타입은 명시적으로 export 해야 함.
 */

/* ============================================================
 * 1. Critic 검수 페이로드 타입 (Critic Payload)
 * ============================================================ */

/**
 * CriticToolCallPayload
 * 위험 도구 호출을 Critic에게 검수 요청할 때 전달하는 페이로드.
 */
export interface CriticToolCallPayload {
  readonly kind: 'tool_call'
  /** 검수 대상 도구 명칭 */
  readonly toolName: string
  /** 검수 대상 도구 인자 */
  readonly toolArgs: Record<string, unknown>
  /** 검수 맥락: 현재까지의 대화 히스토리 (Critic이 컨텍스트를 이해하기 위해 사용) */
  readonly conversationContext: string
}

/**
 * CriticFinalAnswerPayload
 * 최종 답변 확정 직전 Critic에게 검수 요청할 때 전달하는 페이로드.
 */
export interface CriticFinalAnswerPayload {
  readonly kind: 'final_answer'
  /** 검수 대상 최종 답변 텍스트 */
  readonly answer: string
  /** 원래 사용자 요청 (정합성 검사를 위해 사용) */
  readonly originalQuery: string
}

/**
 * CriticPayload
 * ICriticStrategy.evaluate()에 전달되는 유니언 타입.
 * kind 필드로 discriminated union 분기 가능.
 */
export type CriticPayload = CriticToolCallPayload | CriticFinalAnswerPayload

/* ============================================================
 * 2. Critic 판정 결과 타입 (Critic Verdict)
 * ============================================================ */

/**
 * CriticPassVerdict
 * Critic이 검수 통과 판정 시 반환하는 구조체.
 */
export interface CriticPassVerdict {
  readonly verdict: 'PASS'
  /** 검수 소요 시간 (ms). 성능 모니터링용. */
  readonly latencyMs: number
}

/**
 * CriticRejectVerdict
 * Critic이 거부 판정 시 반환하는 구조체.
 */
export interface CriticRejectVerdict {
  readonly verdict: 'REJECT'
  /** 거부 사유 (Actor에게 피드백으로 주입됨) */
  readonly reason: string
  /** 수정 제안 (선택적, Actor 재생성 가이드) */
  readonly suggestedFix?: string
  /** 검수 소요 시간 (ms) */
  readonly latencyMs: number
}

/**
 * CriticUncertainVerdict
 * Critic 엔진 오류, 파싱 실패 등으로 판정이 불가능할 때 반환하는 구조체.
 */
export interface CriticUncertainVerdict {
  readonly verdict: 'UNCERTAIN'
  /** 불확실 사유 */
  readonly reason?: string
  /** 검수 소요 시간 (ms) */
  readonly latencyMs: number
}

/**
 * CriticVerdict
 * ICriticStrategy.evaluate()가 반환하는 유니언 타입.
 */
export type CriticVerdict = CriticPassVerdict | CriticRejectVerdict | CriticUncertainVerdict

/* ============================================================
 * 3. Critic 컨텍스트 (Critic Context)
 * ============================================================ */

/**
 * CriticContext
 * ActorCriticHook이 CriticStrategy에게 전달하는 실행 컨텍스트.
 */
export interface CriticContext {
  /**
   * Critic 전용 LLM 엔진 어댑터.
   * Actor 엔진(7B)과 분리된 경량 Critic 모델(1.5B) 인스턴스.
   * DI로 주입되므로 테스트 대역으로 교체 가능.
   */
  criticEngineAdapter: import('../types').ILLMEngineAdapter
  /** Critic 검수 요청 대상 메시지 (페이로드 직렬화 결과) */
  payload: CriticPayload
}

/* ============================================================
 * 4. Actor-Critic 훅 인터페이스 (Hook Interface)
 * ============================================================ */

/**
 * IActorCriticHook
 * AgentOrchestrator가 주입받아 사용하는 Actor-Critic 훅 계약 인터페이스.
 * DI로 주입되므로 모든 구현체를 언제든 교체 가능하다.
 *
 * 호출 시점:
 * - beforeToolCall: 위험 도구 실행 직전 (DANGEROUS_TOOLS 목록에 있는 도구).
 * - beforeFinalAnswer: Final Answer 확정 직전.
 */
export interface IActorCriticHook {
  /**
   * 위험 도구 실행 직전 Critic 검수를 요청한다.
   * REJECT 반환 시 오케스트레이터는 도구를 실행하지 않고 피드백을 주입해야 한다.
   *
   * @param toolName - 실행 예정 도구 명칭
   * @param toolArgs - 실행 예정 도구 인자
   * @param conversationContext - 현재 대화 컨텍스트 요약 문자열
   * @returns CriticVerdict
   */
  beforeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    conversationContext: string
  ): Promise<CriticVerdict>

  /**
   * Final Answer 확정 직전 Critic 검수를 요청한다.
   * REJECT 반환 시 오케스트레이터는 재생성을 강제해야 한다.
   *
   * @param answer - 확정 예정 최종 답변 텍스트
   * @param originalQuery - 사용자의 원래 질문 (정합성 검사용)
   * @returns CriticVerdict
   */
  beforeFinalAnswer(
    answer: string,
    originalQuery: string
  ): Promise<CriticVerdict>
}

/* ============================================================
 * 5. 피드백 주입기 인터페이스 (Feedback Injector Interface)
 * ============================================================ */

/**
 * IFeedbackInjector
 * Critic이 REJECT 판정 시 Actor 히스토리에 피드백을 주입하는 계약.
 * 분리된 모듈로 관리하여 주입 로직을 교체 가능하게 설계.
 */
export interface IFeedbackInjector {
  /**
   * REJECT 판정 사유를 Actor 대화 히스토리에 Observation으로 주입한다.
   *
   * @param verdict - Critic의 REJECT 판정 결과
   * @param history - 수정할 대화 히스토리 배열 (참조 수정)
   * @param targetKind - 검수 대상 종류 ('tool_call' | 'final_answer')
   */
  injectRejection(
    verdict: CriticRejectVerdict,
    history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    targetKind: CriticPayload['kind']
  ): void
}

/* ============================================================
 * 6. Actor-Critic 전략 인터페이스 (Strategy Interface)
 * ============================================================ */

/**
 * ICriticStrategy
 * Critic 검수 전략의 계약 인터페이스 (Strategy Pattern).
 * 구현체를 교체하여 다른 Critic 모델이나 규칙 기반 검사로 전환 가능.
 */
export interface ICriticStrategy {
  /**
   * 주어진 페이로드를 검수하고 PASS 또는 REJECT 판정을 반환한다.
   *
   * @param ctx - Critic 엔진 어댑터 및 페이로드 포함 컨텍스트
   * @returns CriticVerdict
   */
  evaluate(ctx: CriticContext): Promise<CriticVerdict>
}

/* ============================================================
 * 7. Actor-Critic 설정 (Critic Config)
 * ============================================================ */

/**
 * ActorCriticConfig
 * ActorCriticHook 생성 시 주입하는 설정 구조체.
 */
export interface ActorCriticConfig {
  /**
   * Critic 검수를 트리거할 위험 도구 명칭 목록.
   * 이 목록에 포함된 도구 실행 직전에만 Critic이 개입한다.
   * - 기본: ['run_command', 'write_file']
   */
  dangerousTools: readonly string[]

  /**
   * Final Answer 검수 활성화 여부.
   * - true: 모든 Final Answer 확정 전에 Critic이 검수한다.
   * - false: Final Answer는 Critic 검수 없이 바로 확정.
   */
  critiqueFinalAnswer: boolean

  /**
   * 최대 Critic 거부 허용 횟수.
   * 이 횟수를 초과하면 원본 결과를 폴백으로 사용한다.
   * - 기본값: 2
   */
  maxCriticRejections: number

  /**
   * Critic 검수 전략 구현체 (DI).
   * - 기본: LLMCriticStrategy (1.5B 모델 사용)
   */
  criticStrategy: ICriticStrategy

  /**
   * REJECT 피드백 주입기 구현체 (DI).
   * - 기본: FeedbackInjector
   */
  feedbackInjector: IFeedbackInjector
}
