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

let _traceIdCounter = 0
function makeTraceId(): string {
  return `trace_${Date.now()}_${++_traceIdCounter}`
}

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
  if (apiType !== 'api') return false
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

function extractJSON<T>(raw: string): T | null {
  try {
    // code fence 제거
    const cleaned = raw.replace(/```(?:json)?\n?/gi, '').replace(/```$/gm, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    // fallback: 첫 { ... } 추출 시도
    const match = raw.match(/\{[\s\S]*\}/)
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

const PLAN_SYSTEM = `당신은 전략 계획 전문가입니다.
제공된 분석 결과를 바탕으로 해결 절차를 수립하십시오. 최종 답변은 절대 포함하지 마십시오.

{
  "summary": "계획 요약 (1~2문장)",
  "plan": [
    { "step": 1, "action": "행동", "reason": "이유" }
  ]
}

반드시 위 JSON만 출력하십시오.`

const SOLVE_SYSTEM = `당신은 전문 문제 해결사입니다.
계획에 따라 답변 초안을 생성하십시오.

{
  "summary": "해결 접근 요약 (1~2문장)",
  "draft": "답변 초안 전문",
  "assumptions": ["가정 1"],
  "risk_points": ["위험 요소 1"]
}

반드시 위 JSON만 출력하십시오.`

const VERIFY_SYSTEM = `당신은 품질 검토 전문가입니다.
제공된 초안을 검증하십시오. 오류, 누락, 과장, 불명확성을 점검하십시오.

{
  "summary": "검증 요약 (1~2문장)",
  "passed": true,
  "issues": ["발견된 문제"],
  "fixes": ["수정 방법"]
}

반드시 위 JSON만 출력하십시오.`

function buildFinalizeSystem(context?: string): string {
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
    const analyze = extractJSON<AnalyzeStepOutput>(analyzeRaw)
    if (!analyze?.summary) throw new Error('analyze step failed: no summary')
    emit(makeEvent('analysis', analyze.summary, model))

    // --- Step 2: Plan ---
    const planPrompt = `[분석 결과]\n${JSON.stringify(analyze, null, 2)}\n\n[원래 요청]\n${input}`
    const planRaw = await llmCall(
      planPrompt,
      PLAN_SYSTEM,
      Math.min(maxTokens ?? 512, 400),
      temperature ?? 0.3
    )
    const plan = extractJSON<PlanStepOutput>(planRaw)
    if (!plan?.summary) throw new Error('plan step failed: no summary')
    emit(makeEvent('plan', plan.summary, model))

    // --- Step 3: Solve ---
    const solvePrompt = `[분석]\n${JSON.stringify(analyze, null, 2)}\n\n[계획]\n${JSON.stringify(plan, null, 2)}\n\n[원래 요청]\n${input}`
    const solveRaw = await llmCall(
      solvePrompt,
      SOLVE_SYSTEM,
      maxTokens ?? 512,
      temperature ?? 0.5
    )
    const solve = extractJSON<SolveStepOutput>(solveRaw)
    if (!solve?.summary) throw new Error('solve step failed: no summary')
    emit(makeEvent('solve', solve.summary, model))

    // --- Step 4: Verify ---
    const verifyPrompt = `[초안]\n${solve.draft}\n\n[원래 요청]\n${input}`
    const verifyRaw = await llmCall(
      verifyPrompt,
      VERIFY_SYSTEM,
      Math.min(maxTokens ?? 512, 300),
      temperature ?? 0.3
    )
    const verify = extractJSON<VerifyStepOutput>(verifyRaw)
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

    const finalizeRaw = await llmCall(
      finalizePrompt,
      buildFinalizeSystem(context),
      maxTokens ?? 1024,
      temperature ?? 0.6
    )
    const finalize = extractJSON<FinalizeStepOutput>(finalizeRaw)
    if (!finalize?.final) throw new Error('finalize step failed: no final')

    // finalize.visible_reasoning_trace를 trace에 추가
    if (Array.isArray(finalize.visible_reasoning_trace)) {
      for (const item of finalize.visible_reasoning_trace) {
        if (item?.text) {
          emit(makeEvent(item.type || 'summary', item.text, model))
        }
      }
    }

    return { trace, final: finalize.final, status: 'ok' }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errEvent = makeEvent('error', `파이프라인 오류: ${errMsg}`, model)
    trace.push(errEvent)
    onEvent?.(errEvent)
    return { trace, final: '', status: 'error' }
  }
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------

export function useReasoningProvider() {
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

      const modelName = modelPath
        ? modelPath.split(/[/\\]/).pop() || modelPath
        : apiType

      // ------------------------------------------------------------------
      // 1. Provider Native Thinking 우선 시도
      // ------------------------------------------------------------------
      if (supportsNativeThinking(apiType, modelPath)) {
        try {
          const nativeResult = await tryNativeThinking(
            input,
            options,
            modelName,
            onTraceEvent
          )
          if (nativeResult) return nativeResult
        } catch {
          // native thinking 실패 → fallback으로 진행
        }
      }

      // ------------------------------------------------------------------
      // 2. Fallback: Stepwise Reasoning Pipeline
      // ------------------------------------------------------------------
      if (enableFallbackPipeline && window.electronAPI) {
        const llmCall: LLMCallFn = async (prompt, systemPrompt, maxTok, temp) => {
          return new Promise<string>((resolve) => {
            let buffer = ''

            const unsubToken = window.electronAPI!.onLLMToken("default", (token: string) => {
              buffer += token
            })
            const unsubDone = window.electronAPI!.onLLMDone("default", (data: { success: boolean; error?: string }) => {
              unsubToken()
              unsubDone()
              resolve(data.success ? buffer.trim() : '')
            })

            window.electronAPI!.llmGenerate({
              sessionId: "default",
              modelPath: modelPath || '',
              prompt,
              systemPrompt,
              maxTokens: maxTok ?? 512,
              temperature: temp ?? 0.5,
              apiType: apiType === 'wasm' ? 'local' : apiType,
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
      if (window.electronAPI) {
        finalAnswer = await new Promise<string>((resolve) => {
          let buf = ''
          const unsubToken = window.electronAPI!.onLLMToken("default", (t: string) => { buf += t })
          const unsubDone = window.electronAPI!.onLLMDone("default", (d: { success: boolean; error?: string }) => {
            unsubToken()
            unsubDone()
            resolve(d.success ? buf.trim() : '')
          })
          window.electronAPI!.llmGenerate({
            sessionId: "default",
            modelPath: modelPath || '',
            prompt: input,
            maxTokens: maxTokens ?? 512,
            temperature: temperature ?? 0.7,
            apiType: apiType === 'wasm' ? 'local' : apiType,
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
