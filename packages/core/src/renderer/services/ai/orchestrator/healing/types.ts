/**
 * @file orchestrator/healing/types.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/healing/types.ts
 * @role 2-Stage 하이브리드 자가 치유 파이프라인 전용 타입 계약
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - HeuristicHealingStrategy.ts: Phase 1 휴리스틱 전략 구현 시 소비.
 * - LLMHealingDelegate.ts: Phase 2 LLM 슬로우 트랙 구현 시 소비.
 * - SelfHealingMiddleware.ts: 두 Phase를 조율하는 미들웨어 구현 시 소비.
 * - AgentOrchestrator.ts: 주입 포인트에서 인터페이스 타입 참조 시 소비.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: 이 파일에서 런타임 로직(함수 본문, 클래스 인스턴스)을 정의하지 말 것.
 * - MUST: 모든 타입은 명시적으로 export 해야 함.
 */

/* ============================================================
 * 1. 자가 치유 결과 타입 (Healing Result)
 * ============================================================ */

/**
 * HealingSuccessResult
 * 자가 치유 성공 시 반환되는 구조체.
 * method 필드로 Phase 1(휴리스틱) vs Phase 2(LLM) 구분 가능.
 */
export interface HealingSuccessResult {
  readonly success: true
  /** 복구된 유효한 JSON 문자열 */
  readonly healedJson: string
  /** 복구 방법: 'heuristic' = Phase 1 (0ms), 'llm' = Phase 2 (LLM 재호출) */
  readonly method: 'heuristic' | 'llm'
}

/**
 * HealingFailureResult
 * 자가 치유 실패 시 반환되는 구조체.
 */
export interface HealingFailureResult {
  readonly success: false
  /** 복구 실패 사유 */
  readonly error: string
  /** 시도된 LLM 재호출 횟수 (Phase 2 시도 카운트) */
  readonly llmAttempts: number
}

/**
 * HealingResult
 * IJsonHealingStrategy 및 ISelfHealingMiddleware가 반환하는 유니언 타입.
 * success 필드로 discriminated union 분기 가능.
 */
export type HealingResult = HealingSuccessResult | HealingFailureResult

/* ============================================================
 * 2. 자가 치유 컨텍스트 (Healing Context)
 * ============================================================ */

/**
 * HealingContext
 * Phase 2 LLM 슬로우 트랙이 재호출을 수행할 때 필요한 컨텍스트 정보.
 * 오케스트레이터 루프에서 주입되며, LLMHealingDelegate가 소비한다.
 */
export interface HealingContext {
  /**
   * 현재 ReAct 루프의 대화 컨텍스트 (모델 기억).
   * LLM Slow-Track은 이 컨텍스트에 Observation을 주입하여 포맷 수정을 유도한다.
   */
  conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** 복구 재시도 시 사용할 LLM 엔진 어댑터 */
  engineAdapter: import('../types').ILLMEngineAdapter
  /** 현재까지 누적된 LLM 재시도 횟수 (maxHealAttempts와 비교) */
  currentLlmAttempts: number
  /** 최대 LLM 재시도 허용 횟수 (Configurable) */
  maxLlmAttempts: number
}

/* ============================================================
 * 3. 전략 인터페이스 (Strategy Interfaces)
 * ============================================================ */

/**
 * IJsonHealingStrategy
 * Phase 1 휴리스틱 복구 전략의 계약 인터페이스.
 * 구현체를 교체하여 다른 알고리즘으로 전환할 수 있다 (Strategy Pattern).
 *
 * 구현 조건:
 * - 동기(sync) 실행: 0ms 추가 지연이 목표이므로 async 불가.
 * - LLM 재호출 없이 순수 문자열 변환으로만 복구 시도.
 */
export interface IJsonHealingStrategy {
  /**
   * 손상된 JSON 문자열을 휴리스틱 알고리즘으로 복구 시도한다.
   *
   * @param malformedJson - 파싱에 실패한 원본 JSON 문자열
   * @returns HealingResult (성공 시 healedJson 포함)
   */
  heal(malformedJson: string): HealingResult
}

/**
 * ILLMHealingDelegate
 * Phase 2 LLM 슬로우 트랙 위임 계약 인터페이스.
 * LLM에게 포맷 수정을 요청하는 비동기 전략.
 *
 * 구현 조건:
 * - Phase 1 실패 후에만 호출된다.
 * - 최대 재시도 횟수(maxLlmAttempts) 초과 시 반드시 HealingFailureResult를 반환한다.
 */
export interface ILLMHealingDelegate {
  /**
   * LLM에게 포맷 수정을 요청하고 결과를 반환한다.
   * Observation 주입 방식으로 컨텍스트에 에러를 삽입하여 모델 자가 수정을 유도한다.
   *
   * @param parseError - JSON.parse()가 반환한 에러 메시지
   * @param malformedJson - 파싱에 실패한 원본 JSON 문자열
   * @param ctx - 대화 컨텍스트 및 엔진 어댑터 참조
   * @returns HealingResult (성공 시 healedJson 포함)
   */
  requestHeal(
    parseError: string,
    malformedJson: string,
    ctx: HealingContext
  ): Promise<HealingResult>
}

/**
 * ISelfHealingMiddleware
 * Phase 1 + Phase 2를 조율하는 미들웨어 계약 인터페이스.
 * AgentOrchestrator는 이 인터페이스만을 통해 자가 치유를 요청한다.
 * Dependency Injection으로 주입되므로 테스트 대역 교체 가능.
 */
export interface ISelfHealingMiddleware {
  /**
   * <tool_call> JSON 파싱 실패 시 호출되는 통합 복구 진입점.
   * 내부적으로 Phase 1 → Phase 2 순서로 복구를 시도한다.
   *
   * @param malformedJson - 파싱에 실패한 원본 JSON 문자열
   * @param parseError - JSON.parse()가 반환한 에러 메시지
   * @param ctx - LLM 슬로우 트랙에 필요한 컨텍스트
   * @returns HealingResult
   */
  onToolCallParseError(
    malformedJson: string,
    parseError: string,
    ctx: HealingContext
  ): Promise<HealingResult>
}

/* ============================================================
 * 4. 미들웨어 설정 (Healing Config)
 * ============================================================ */

/**
 * SelfHealingConfig
 * SelfHealingMiddleware 생성 시 주입하는 설정 구조체.
 */
export interface SelfHealingConfig {
  /**
   * LLM 슬로우 트랙 최대 재시도 횟수.
   * - 기본값: 2 (Phase 2 최대 2회)
   * - OrchestratorConfig에서 Configurable 적용 가능.
   */
  maxLlmHealAttempts: number
  /**
   * Phase 1 휴리스틱 전략 구현체 (DI).
   * - 기본: HeuristicHealingStrategy
   */
  heuristicStrategy: IJsonHealingStrategy
  /**
   * Phase 2 LLM 위임 구현체 (DI).
   * - 기본: LLMHealingDelegate
   */
  llmDelegate: ILLMHealingDelegate
}
