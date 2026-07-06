/**
 * ReasoningTypes — 실제 LLM/Provider 출력 기반 추론 추적 공통 타입
 *
 * 설계 원칙:
 * - trace.text는 반드시 모델/provider 결과여야 한다.
 * - UI가 만든 문구는 절대 trace에 들어갈 수 없다.
 * - fake step, hardcoded progress, setTimeout 기반 단계 표시 금지.
 */

/** 추론 추적 이벤트 — UI에 표시되는 하나의 추론 단계 */
export interface ReasoningTraceEvent {
  id: string
  /** 이 trace를 생성한 출처 */
  source: 'model' | 'provider' | 'pipeline'
  /**
   * 추론 단계 유형:
   * - thinking: provider native thinking block (Claude extended thinking 등)
   * - reasoning_summary: provider가 제공하는 reasoning summary
   * - analysis: fallback pipeline Step 1 결과
   * - plan: fallback pipeline Step 2 결과
   * - solve: fallback pipeline Step 3 결과
   * - verify: fallback pipeline Step 4 결과
   * - summary: finalize step의 visible trace item
   * - tool_plan: tool call 계획
   * - unavailable: trace를 얻을 수 없는 경우 (fake step 대체 금지)
   * - error: trace 생성 실패
   */
  type:
    | 'thinking'
    | 'reasoning_summary'
    | 'analysis'
    | 'plan'
    | 'solve'
    | 'verify'
    | 'summary'
    | 'tool_plan'
    | 'unavailable'
    | 'error'
  /** 모델/provider/pipeline에서 반환된 실제 텍스트 (UI가 만든 문구 불가) */
  text: string
  /** 이 trace를 생성한 모델 식별자 */
  model: string
  /** ISO 8601 타임스탬프 */
  timestamp: string
}

/** ReasoningProvider.run() 반환값 */
export interface ReasoningResult {
  /** 실제 모델 출력에서만 생성된 trace 배열 */
  trace: ReasoningTraceEvent[]
  /** 최종 답변 (trace와 분리 저장) */
  final: string
  /** provider raw 응답 (선택적, 노출 금지) */
  raw?: unknown
  /**
   * 처리 상태:
   * - ok: trace 정상 생성
   * - reasoning_trace_unavailable: native thinking 없고 fallback도 불가 — fake step으로 대체 불가
   * - error: 오류 발생
   */
  status: 'ok' | 'reasoning_trace_unavailable' | 'error'
}

/** Stepwise Reasoning Pipeline Step 1 — Analyze */
export interface AnalyzeStepOutput {
  summary: string
  goal: string
  constraints: string[]
  unknowns: string[]
  required_steps: string[]
}

/** Stepwise Reasoning Pipeline Step 2 — Plan */
export interface PlanStepOutput {
  summary: string
  plan: Array<{
    step: number
    action: string
    reason: string
  }>
}

/** Stepwise Reasoning Pipeline Step 3 — Solve */
export interface SolveStepOutput {
  summary: string
  draft: string
  assumptions: string[]
  risk_points: string[]
}

/** Stepwise Reasoning Pipeline Step 4 — Verify */
export interface VerifyStepOutput {
  summary: string
  passed: boolean
  issues: string[]
  fixes: string[]
}

/** Stepwise Reasoning Pipeline Step 5 — Finalize */
export interface FinalizeStepOutput {
  visible_reasoning_trace: Array<{
    type: 'analysis' | 'plan' | 'solve' | 'verify' | 'summary'
    text: string
  }>
  final: string
}
