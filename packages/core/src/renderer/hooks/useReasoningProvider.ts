/**
 * @file useReasoningProvider.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/useReasoningProvider.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * useReasoningProvider — 실제 LLM/Provider 출력 기반 Reasoning Trace 공통 프로바이더
 *
 * 핵심 원칙:
 * 1. provider native thinking이 있으면 우선 사용.
 * 2. native thinking이 없으면 multi-call Stepwise Reasoning Pipeline 실행.
 * 3. 둘 다 실패/미지원이면 reasoning_trace_unavailable 반환.
 * 4. fake step, hardcoded 문구, setTimeout 기반 progress는 절대 생성하지 않음.
 * 5. trace.text는 반드시 모델/provider 실제 출력이어야 함.
 */

import { useCallback } from 'react'
import * as ipc from '../services/ipc/electronApiAdapter'
import { WebLLMEngine } from '../services/ai/WebLLMEngine'
import type {
  ReasoningResult,
  ReasoningTraceEvent,
  AnalyzeStepOutput,
  PlanStepOutput,
  SolveStepOutput,
  VerifyStepOutput,
  FinalizeStepOutput,
} from '../../shared/reasoningTypes'

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface ReasoningRunOptions {
  apiType: 'local' | 'api' | 'wasm' | 'ollama'
  apiKey?: string
  modelPath?: string
  maxTokens?: number
  temperature?: number
  context?: string
  /** Fallback pipeline 활성화 여부 (기본: true) */
  enableFallbackPipeline?: boolean
  /** onTraceEvent: 각 trace event 생성 직후 호출 (streaming 효과용) */
  onTraceEvent?: (event: ReasoningTraceEvent) => void
  /** onFinalChunk: final answer 스트리밍 토큰 콜백 */
  onFinalChunk?: (chunk: string) => void
}

type LLMCallFn = (
  prompt: string,
  systemPrompt: string,
  maxTokens?: number,
  temperature?: number
) => Promise<string>

// ---------------------------------------------------------------------------
// Trace 이벤트 생성 헬퍼
// ---------------------------------------------------------------------------

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `_traceIdCounter`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const _traceIdCounter = ...` 형태로 안전 캐싱 후 가공 기동.
       */
let _traceIdCounter = 0
  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `makeTraceId`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `makeTraceId(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function makeTraceId(): string {
  return `trace_${Date.now()}_${++_traceIdCounter}`
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `makeEvent`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `makeEvent(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function makeEvent(
  type: ReasoningTraceEvent['type'],
  text: string,
  model: string,
  source: ReasoningTraceEvent['source'] = 'pipeline'
): ReasoningTraceEvent {
  return {
    id: makeTraceId(),
    source,
    type,
    text,
    model,
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Native Thinking 감지
// ---------------------------------------------------------------------------

/**
 * 모델이 native thinking/reasoning 응답을 지원하는지 판별.
 * - API 모드에서 claude-3-7/claude-3-5, gemini-2.0-flash-thinking 등이 해당.
 * - 로컬 GGUF 모델은 미지원.
 */
function supportsNativeThinking(apiType: string, modelPath?: string): boolean {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `apiType !== 'api'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (apiType !== 'api')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (apiType !== 'api') return false
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `name`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const name = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const name = (modelPath || '').toLowerCase()
  return (
    name.includes('claude-3-7') ||
    name.includes('claude-3-5') ||
    name.includes('claude-3-opus') ||
    name.includes('gemini-2.0-flash-thinking') ||
    name.includes('o1') ||
    name.includes('o3') ||
    name.includes('deepseek-r1')
  )
}

// ---------------------------------------------------------------------------
// JSON 파싱 헬퍼 (LLM 출력에서 JSON 추출)
// ---------------------------------------------------------------------------

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `extractJSON`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `extractJSON(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function extractJSON<T>(raw: string): T | null {
  try {
    // code fence 제거
    const cleaned = raw.replace(/```(?:json)?\n?/gi, '').replace(/```$/gm, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    // fallback: 첫 { ... } 추출 시도
    const match = raw.match(/\{[\s\S]*\}/)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `match`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (match)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {}
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Stepwise Reasoning Pipeline (Fallback — 5 LLM calls)
// ---------------------------------------------------------------------------

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ANALYZE_SYSTEM`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ANALYZE_SYSTEM = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const ANALYZE_SYSTEM = `당신은 전문 분석가입니다.
사용자 요청을 분석하여 아래 JSON 형식으로만 응답하십시오. 최종 답변은 절대 포함하지 마십시오.

{
  "summary": "분석 요약 (1~2문장)",
  "goal": "핵심 목표",
  "constraints": ["제약 1", "제약 2"],
  "unknowns": ["불확실 요소 1"],
  "required_steps": ["필요 단계 1", "단계 2"]
}

반드시 위 JSON만 출력하십시오.`

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `PLAN_SYSTEM`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const PLAN_SYSTEM = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const PLAN_SYSTEM = `당신은 전략 계획 전문가입니다.
제공된 분석 결과를 바탕으로 해결 절차를 수립하십시오. 최종 답변은 절대 포함하지 마십시오.

{
  "summary": "계획 요약 (1~2문장)",
  "plan": [
    { "step": 1, "action": "행동", "reason": "이유" }
  ]
}

반드시 위 JSON만 출력하십시오.`

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `SOLVE_SYSTEM`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const SOLVE_SYSTEM = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const SOLVE_SYSTEM = `당신은 전문 문제 해결사입니다.
계획에 따라 답변 초안을 생성하십시오.

{
  "summary": "해결 접근 요약 (1~2문장)",
  "draft": "답변 초안 전문",
  "assumptions": ["가정 1"],
  "risk_points": ["위험 요소 1"]
}

반드시 위 JSON만 출력하십시오.`

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `VERIFY_SYSTEM`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const VERIFY_SYSTEM = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const VERIFY_SYSTEM = `당신은 품질 검토 전문가입니다.
제공된 초안을 검증하십시오. 오류, 누락, 과장, 불명확성을 점검하십시오.

{
  "summary": "검증 요약 (1~2문장)",
  "passed": true,
  "issues": ["발견된 문제"],
  "fixes": ["수정 방법"]
}

반드시 위 JSON만 출력하십시오.`

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `buildFinalizeSystem`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `buildFinalizeSystem(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function buildFinalizeSystem(context?: string): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ctx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ctx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const ctx = context ? `\n\n[참조 문서 컨텍스트]\n${context.slice(0, 1500)}` : ''
  return `당신은 최종 답변 생성 전문가입니다.
분석, 계획, 초안, 검증 결과를 종합하여 최종 답변을 생성하십시오.
raw CoT(내부 사고 과정)는 절대 그대로 노출하지 마십시오.${ctx}

{
  "visible_reasoning_trace": [
    { "type": "analysis", "text": "분석 결과 요약" },
    { "type": "plan", "text": "계획 요약" },
    { "type": "solve", "text": "해결 접근 요약" },
    { "type": "verify", "text": "검증 요약" }
  ],
  "final": "사용자에게 보여줄 최종 답변"
}

반드시 위 JSON만 출력하십시오.`
}

async function runStepwisePipeline(
  input: string,
  llmCall: LLMCallFn,
  model: string,
  onEvent?: (event: ReasoningTraceEvent) => void,
  context?: string,
  maxTokens?: number,
  temperature?: number
): Promise<ReasoningResult> {
  const trace: ReasoningTraceEvent[] = []

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `emit`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `emit(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
  function emit(event: ReasoningTraceEvent) {
    trace.push(event)
    onEvent?.(event)
  }

  try {
    // --- Step 1: Analyze ---
    const analyzeRaw = await llmCall(
      `[분석 대상 요청]\n${input}`,
      ANALYZE_SYSTEM,
      Math.min(maxTokens ?? 512, 400),
      temperature ?? 0.3
    )
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `analyze`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const analyze = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const analyze = extractJSON<AnalyzeStepOutput>(analyzeRaw)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!analyze?.summary) throw new Error('analyze step failed: no summary'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!analyze?.summary) throw new Error('analyze step failed: no summary')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!analyze?.summary) throw new Error('analyze step failed: no summary')
    emit(makeEvent('analysis', analyze.summary, model))

    // --- Step 2: Plan ---
    const planPrompt = `[분석 결과]\n${JSON.stringify(analyze, null, 2)}\n\n[원래 요청]\n${input}`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `planRaw`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const planRaw = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const planRaw = await llmCall(
      planPrompt,
      PLAN_SYSTEM,
      Math.min(maxTokens ?? 512, 400),
      temperature ?? 0.3
    )
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `plan`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const plan = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const plan = extractJSON<PlanStepOutput>(planRaw)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!plan?.summary) throw new Error('plan step failed: no summary'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!plan?.summary) throw new Error('plan step failed: no summary')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!plan?.summary) throw new Error('plan step failed: no summary')
    emit(makeEvent('plan', plan.summary, model))

    // --- Step 3: Solve ---
    const solvePrompt = `[분석]\n${JSON.stringify(analyze, null, 2)}\n\n[계획]\n${JSON.stringify(plan, null, 2)}\n\n[원래 요청]\n${input}`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `solveRaw`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const solveRaw = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const solveRaw = await llmCall(
      solvePrompt,
      SOLVE_SYSTEM,
      maxTokens ?? 512,
      temperature ?? 0.5
    )
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `solve`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const solve = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const solve = extractJSON<SolveStepOutput>(solveRaw)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!solve?.summary) throw new Error('solve step failed: no summary'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!solve?.summary) throw new Error('solve step failed: no summary')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!solve?.summary) throw new Error('solve step failed: no summary')
    emit(makeEvent('solve', solve.summary, model))

    // --- Step 4: Verify ---
    const verifyPrompt = `[초안]\n${solve.draft}\n\n[원래 요청]\n${input}`
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `verifyRaw`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const verifyRaw = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const verifyRaw = await llmCall(
      verifyPrompt,
      VERIFY_SYSTEM,
      Math.min(maxTokens ?? 512, 300),
      temperature ?? 0.3
    )
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `verify`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const verify = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const verify = extractJSON<VerifyStepOutput>(verifyRaw)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!verify?.summary) throw new Error('verify step failed: no summary'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!verify?.summary) throw new Error('verify step failed: no summary')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!verify?.summary) throw new Error('verify step failed: no summary')
    emit(makeEvent('verify', verify.summary, model))

    // --- Step 5: Finalize ---
    const finalizePrompt = [
      `[분석 요약] ${analyze.summary}`,
      `[계획 요약] ${plan.summary}`,
      `[초안] ${solve.draft}`,
      `[검증] 통과: ${verify.passed ? '예' : '아니오'}, 수정사항: ${verify.fixes.join(', ')}`,
      `\n[원래 요청]\n${input}`,
    ].join('\n')

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalizeRaw`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalizeRaw = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const finalizeRaw = await llmCall(
      finalizePrompt,
      buildFinalizeSystem(context),
      maxTokens ?? 1024,
      temperature ?? 0.6
    )
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalize`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalize = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const finalize = extractJSON<FinalizeStepOutput>(finalizeRaw)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!finalize?.final) throw new Error('finalize step failed: no final'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!finalize?.final) throw new Error('finalize step failed: no final')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!finalize?.final) throw new Error('finalize step failed: no final')

    // finalize.visible_reasoning_trace를 trace에 추가
    if (Array.isArray(finalize.visible_reasoning_trace)) {
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const item of finalize.visible_reasoning_trace) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (const item of finalize.visible_reasoning_trace) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `item?.text`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (item?.text)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (item?.text) {
          emit(makeEvent(item.type || 'summary', item.text, model))
        }
      }
    }

    return { trace, final: finalize.final, status: 'ok' }
  } catch (err: unknown) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `errMsg`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const errMsg = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const errMsg = err instanceof Error ? err.message : String(err)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `errEvent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const errEvent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const errEvent = makeEvent('error', `파이프라인 오류: ${errMsg}`, model)
    trace.push(errEvent)
    onEvent?.(errEvent)
    return { trace, final: '', status: 'error' }
  }
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `useReasoningProvider`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `useReasoningProvider(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function useReasoningProvider() {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `run`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const run = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const run = useCallback(
    async (
      input: string,
      options: ReasoningRunOptions
    ): Promise<ReasoningResult> => {
      const {
        apiType,
        apiKey,
        modelPath,
        maxTokens,
        temperature,
        context,
        enableFallbackPipeline = true,
        onTraceEvent,
      } = options

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `modelName`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const modelName = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const modelName = modelPath
        ? modelPath.split(/[/\\]/).pop() || modelPath
        : apiType

      // ------------------------------------------------------------------
      // 1. Provider Native Thinking 우선 시도
      // ------------------------------------------------------------------
      if (supportsNativeThinking(apiType, modelPath)) {
        try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nativeResult`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nativeResult = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const nativeResult = await tryNativeThinking(
            input,
            options,
            modelName,
            onTraceEvent
          )
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `nativeResult`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (nativeResult)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (nativeResult) return nativeResult
        } catch {
          // native thinking 실패 → fallback으로 진행
        }
      }

      // ------------------------------------------------------------------
      // 2. Fallback: Stepwise Reasoning Pipeline
      // ------------------------------------------------------------------
      if (enableFallbackPipeline && ipc.isElectronEnv()) {
  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `llmCall`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `llmCall(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
        const llmCall: LLMCallFn = async (prompt, systemPrompt, maxTok, temp) => {
          return new Promise<string>((resolve) => {
            if (apiType === 'wasm') {
              WebLLMEngine.getInstance().generateStream(
                [{ role: 'user', content: prompt }],
                {
                  systemPrompt,
                  maxTokens: maxTok ?? 512,
                  temperature: temp ?? 0.5
                }
              ).then((res) => resolve(res.trim())).catch(() => resolve(''))
              return
            }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            let buffer = ''

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubToken`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubToken = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const unsubToken = ipc.onLLMToken("default", (token: string) => {
              buffer += token
            })
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubDone`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubDone = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const unsubDone = ipc.onLLMDone("default", (data: { success: boolean; error?: string }) => {
              unsubToken()
              unsubDone()
              resolve(data.success ? buffer.trim() : '')
            })

            ipc.llmGenerate({
              sessionId: "default",
              modelPath: modelPath || '',
              prompt,
              systemPrompt,
              maxTokens: maxTok ?? 512,
              temperature: temp ?? 0.5,
              apiType: apiType, // wasm 우회 코드 삭제 및 순수 apiType 전송
              apiKey,
            })
          })
        }

        return runStepwisePipeline(
          input,
          llmCall,
          modelName,
          onTraceEvent,
          context,
          maxTokens,
          temperature
        )
      }

      // ------------------------------------------------------------------
      // 3. 둘 다 불가 → reasoning_trace_unavailable
      //    fake step으로 대체 금지
      // ------------------------------------------------------------------
      const unavailableEvent: ReasoningTraceEvent = makeEvent(
        'unavailable',
        '현재 모델/환경에서 추론 추적을 지원하지 않습니다.',
        modelName
      )
      onTraceEvent?.(unavailableEvent)

      // 일반 단일 LLM 호출로 최종 답변만 반환
      let finalAnswer = ''
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (ipc.isElectronEnv()) {
        finalAnswer = await new Promise<string>((resolve) => {
          if (apiType === 'wasm') {
            WebLLMEngine.getInstance().generateStream(
              [{ role: 'user', content: input }],
              {
                systemPrompt: 'You are an advanced reasoning AI.',
                maxTokens: maxTokens ?? 512,
                temperature: temperature ?? 0.7
              }
            ).then((res) => resolve(res.trim())).catch(() => resolve(''))
            return
          }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buf`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buf = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let buf = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubToken`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubToken = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const unsubToken = ipc.onLLMToken("default", (t: string) => { buf += t })
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubDone`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubDone = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const unsubDone = ipc.onLLMDone("default", (d: { success: boolean; error?: string }) => {
            unsubToken()
            unsubDone()
            resolve(d.success ? buf.trim() : '')
          })
          ipc.llmGenerate({
            sessionId: "default",
            modelPath: modelPath || '',
            prompt: input,
            maxTokens: maxTokens ?? 512,
            temperature: temperature ?? 0.7,
            apiType: apiType, // wasm 우회 코드 삭제 및 순수 apiType 전송
            apiKey,
            context,
          })
        })
      }

      return {
        trace: [unavailableEvent],
        final: finalAnswer,
        status: 'reasoning_trace_unavailable',
      }
    },
    []
  )

  return { run }
}

// ---------------------------------------------------------------------------
// Native Thinking 시도 (API 모드 전용 — Claude/Gemini 등)
// ---------------------------------------------------------------------------

async function tryNativeThinking(
  input: string,
  options: ReasoningRunOptions,
  modelName: string,
  onTraceEvent?: (event: ReasoningTraceEvent) => void
): Promise<ReasoningResult | null> {
  // 현재 Electron IPC 레이어는 native thinking 파라미터를 지원하지 않으므로
  // null을 반환해 fallback pipeline으로 위임.
  // 향후 Claude API / Gemini API를 직접 호출하는 IPC 채널이 추가되면
  // 여기서 thinking block 파싱 후 trace로 변환한다.
  void input; void options; void modelName; void onTraceEvent
  return null
}

