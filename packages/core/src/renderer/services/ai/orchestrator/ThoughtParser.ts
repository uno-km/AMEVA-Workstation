/**
 * @file orchestrator/ThoughtParser.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/ThoughtParser.ts
 * @role 모델 스트림 실시간 파싱 - <thought> 혼잣말 및 <tool_call> 감지기
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: generateStream 콜백에서 발생하는 토큰을 이 파서에 주입한다.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 모델이 스트리밍으로 출력하는 텍스트를 토큰 단위로 누적하여
 *   <thought>...</thought> 구간과 <tool_call>...</tool_call> 구간을 실시간으로 감지한다.
 * - 감지된 구간에 따라 onThought, onToolCall, onFinalAnswer 콜백을 트리거한다.
 * - 상태 머신(State Machine) 기반으로 파서 상태를 관리한다.
 *
 * [지원 태그 포맷]
 * - 혼잣말 태그: <thought>...</thought> 또는 <think>...</think>
 * - 도구 호출 태그: <tool_call>{"name": "...", "args": {...}}</tool_call>
 * - 최종 답변: 태그 종료 후 일반 텍스트 출력
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 파서 상태는 reset() 호출 없이 재사용되어서는 안 된다.
 * - MUST NOT: 파서 내부에서 도구를 직접 실행하지 말 것. 콜백 트리거로만 신호를 보낼 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - ToolCallRequest: 파싱된 도구 호출 요청 구조체.
 */
import type { ToolCallRequest } from './types'

/* ============================================================
 * 1. 파서 상태 머신 정의
 * ============================================================ */

/**
 * ParserState
 * ThoughtParser의 내부 상태 머신 단계.
 *
 * - 'idle'         : 아직 특수 태그가 감지되지 않은 초기 상태.
 * - 'in_thought'   : <thought> 또는 <think> 태그 내부를 파싱하는 상태.
 * - 'in_tool_call' : <tool_call> 태그 내부 JSON을 파싱하는 상태.
 * - 'in_answer'    : 모든 태그 처리 후 최종 답변 텍스트를 수집하는 상태.
 */
type ParserState = 'idle' | 'in_thought' | 'in_tool_call' | 'in_answer'

/* ============================================================
 * 2. 파서 콜백 인터페이스
 * ============================================================ */

/**
 * ThoughtParserCallbacks
 * ThoughtParser 생성 시 주입하는 콜백 함수 묶음.
 * 각 콜백은 AgentOrchestrator에서 UI 상태 업데이트 및 도구 실행 트리거에 사용된다.
 */
export interface ThoughtParserCallbacks {
  /**
   * <thought> 태그 내 텍스트 토큰이 추가될 때마다 호출된다.
   * UI: "생각 중..." 버블에 혼잣말 텍스트를 실시간 추가.
   *
   * @param token     - 방금 추가된 단일 토큰
   * @param accumulated - 현재까지 누적된 혼잣말 전체 텍스트
   */
  onThought: (token: string, accumulated: string) => void

  /**
   * <tool_call> 태그의 JSON 파싱이 완료되어 도구 실행 준비가 됐을 때 호출된다.
   * 이 콜백이 호출되면 스트리밍이 일시 중지되고 도구 실행이 진행되어야 한다.
   *
   * @param request - 파싱된 도구 호출 요청 객체
   */
  onToolCall: (request: ToolCallRequest) => void

  /**
   * 최종 답변 텍스트 토큰이 추가될 때마다 호출된다.
   * UI: 마크다운 답변 버블에 텍스트를 실시간 추가.
   *
   * @param token     - 방금 추가된 단일 토큰
   * @param accumulated - 현재까지 누적된 최종 답변 전체 텍스트
   */
  onFinalAnswerToken: (token: string, accumulated: string) => void

  /**
   * <tool_call> JSON 파싱에 실패했을 때 호출되는 선택적 콜백.
   * Self-Healing 미들웨어가 주입된 경우 AgentOrchestrator가 이 콜백을 통해
   * 손상된 JSON을 수신하여 2-Stage 복구를 시도한다.
   * 미주입 시 console.error로만 로그를 남기고 스킵한다.
   *
   * @param malformedJson - 파싱에 실패한 원본 JSON 문자열
   * @param parseError    - JSON.parse()가 반환한 원본 에러 메시지
   */
  onToolCallParseError?: (malformedJson: string, parseError: string) => void
}

/* ============================================================
 * 3. ThoughtParser 클래스
 * ============================================================ */

/**
 * ThoughtParser
 * 모델 스트림을 토큰 단위로 받아 상태 머신으로 구간을 분류하는 파서.
 *
 * 사용 예시:
 * ```ts
 * const parser = new ThoughtParser({
 *   onThought: (tok, acc) => updateUI(acc),
 *   onToolCall: (req) => executeToolAndResume(req),
 *   onFinalAnswerToken: (tok, acc) => appendAnswer(acc)
 * })
 * // 스트리밍 루프에서:
 * for await (const token of stream) {
 *   parser.feed(token)
 * }
 * ```
 */
export class ThoughtParser {
  /*
   * [PRIVATE STATE - State Machine]
   * - state: 현재 파서 상태. 토큰 분류 기준.
   * - buffer: 태그 경계 감지를 위한 미처리 토큰 버퍼.
   * - thoughtAccumulator: <thought> 내부 텍스트 누적기.
   * - toolCallAccumulator: <tool_call> 내부 JSON 누적기.
   * - answerAccumulator: 최종 답변 텍스트 누적기.
   */
  private state: ParserState = 'idle'
  private buffer: string = ''
  private thoughtAccumulator: string = ''
  private toolCallAccumulator: string = ''
  private answerAccumulator: string = ''

  /*
   * [PRIVATE STATE - Callbacks]
   * - callbacks: 생성자에서 주입받은 이벤트 콜백 묶음.
   */
  private readonly callbacks: ThoughtParserCallbacks

  /*
   * [CONSTANTS - Tag Definitions]
   * - 지원하는 혼잣말 태그 열기/닫기 패턴.
   * - <thought>, <think>, </thought>, </think> 모두 처리한다.
   */
  private static readonly THOUGHT_OPEN_TAGS = ['<thought>', '<think>']
  private static readonly THOUGHT_CLOSE_TAGS = ['</thought>', '</think>']
  private static readonly TOOL_CALL_OPEN_TAG = '<tool_call>'
  private static readonly TOOL_CALL_CLOSE_TAG = '</tool_call>'

  constructor(callbacks: ThoughtParserCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * 파서 상태를 초기 상태로 완전히 리셋한다.
   * 새로운 ReAct 턴 시작 전에 반드시 호출해야 한다.
   */
  public reset(): void {
    this.state = 'idle'
    this.buffer = ''
    this.thoughtAccumulator = ''
    this.toolCallAccumulator = ''
    this.answerAccumulator = ''
  }

  /**
   * 현재 파서 상태를 반환한다.
   * AgentOrchestrator가 파서 진행 상태를 확인할 때 사용한다.
   */
  public getState(): ParserState {
    return this.state
  }

  /**
   * 누적된 최종 답변 텍스트를 반환한다.
   */
  public getAccumulatedAnswer(): string {
    return this.answerAccumulator
  }

  /**
   * 누적된 혼잣말 텍스트를 반환한다.
   */
  public getAccumulatedThought(): string {
    return this.thoughtAccumulator
  }

  /**
   * 스트리밍 토큰을 파서에 주입한다.
   * 모든 상태 전환 및 콜백 트리거가 이 메서드를 통해 이루어진다.
   *
   * @param token - 모델 스트리밍에서 수신된 단일 토큰 문자열
   */
  public feed(token: string): void {
    /*
     * [CORE ALGORITHM]
     * - 버퍼에 토큰을 추가한 뒤 상태에 따라 처리 분기한다.
     * - 태그 경계 감지는 버퍼의 suffix를 검사하는 방식으로 수행한다.
     */
    this.buffer += token

    switch (this.state) {
      case 'idle':
        this.processIdleState()
        break

      case 'in_thought':
        this.processThoughtState(token)
        break

      case 'in_tool_call':
        this.processToolCallState()
        break

      case 'in_answer':
        this.processAnswerState(token)
        break
    }
  }

  /* ──────────────────────────────────────────
   * 상태별 처리 메서드 (State Processors)
   * ────────────────────────────────────────── */

  /**
   * idle 상태 처리.
   * 버퍼에서 혼잣말 태그 또는 도구 호출 태그의 시작을 감지한다.
   */
  private processIdleState(): void {
    /*
     * [THOUGHT TAG DETECTION]
     * - 버퍼가 <thought> 또는 <think> 태그로 끝나는지 확인한다.
     */
    for (const openTag of ThoughtParser.THOUGHT_OPEN_TAGS) {
      if (this.buffer.includes(openTag)) {
        /*
         * [STATE TRANSITION: idle → in_thought]
         * - 태그 이전 텍스트는 버려지고 태그 이후부터 혼잣말 누적 시작.
         */
        const afterTag = this.buffer.split(openTag).slice(1).join(openTag)
        this.buffer = afterTag
        this.state = 'in_thought'
        return
      }
    }

    /*
     * [TOOL CALL TAG DETECTION]
     * - 버퍼가 <tool_call> 태그를 포함하는지 확인한다.
     */
    if (this.buffer.includes(ThoughtParser.TOOL_CALL_OPEN_TAG)) {
      const afterTag = this.buffer.split(ThoughtParser.TOOL_CALL_OPEN_TAG).slice(1).join(ThoughtParser.TOOL_CALL_OPEN_TAG)
      this.buffer = afterTag
      this.state = 'in_tool_call'
      return
    }

    /*
     * [PLAIN TEXT DETECTION]
     * - 특수 태그가 없는 일반 텍스트는 최종 답변으로 처리한다.
     * - 단, 태그가 시작될 가능성이 있는 '<' 직전까지만 방출한다.
     */
    const ltIndex = this.buffer.lastIndexOf('<')
    if (ltIndex > 0) {
      /*
       * [PARTIAL TAG GUARD]
       * - '<' 이전 텍스트는 안전하게 방출, '<' 이후는 버퍼에 보존.
       */
      const safeText = this.buffer.slice(0, ltIndex)
      this.buffer = this.buffer.slice(ltIndex)
      if (safeText.trim() !== '') {
        this.state = 'in_answer'
        this.processAnswerState(safeText)
      }
    } else if (ltIndex === -1 && this.buffer.length > 50) {
      /*
       * [FLUSH SAFE TEXT]
       * - '<' 가 없고 버퍼가 충분히 쌓이면 일반 답변 텍스트로 방출.
       */
      const safeText = this.buffer
      this.buffer = ''
      this.state = 'in_answer'
      this.processAnswerState(safeText)
    }
  }

  /**
   * in_thought 상태 처리.
   * </thought> 또는 </think> 닫기 태그가 나타날 때까지 혼잣말을 누적한다.
   *
   * @param latestToken - 방금 수신된 토큰 (콜백에 전달)
   */
  private processThoughtState(latestToken: string): void {
    /*
     * [CLOSE TAG DETECTION]
     * - 버퍼에 혼잣말 닫기 태그가 포함되어 있는지 확인한다.
     */
    for (const closeTag of ThoughtParser.THOUGHT_CLOSE_TAGS) {
      if (this.buffer.includes(closeTag)) {
        /*
         * [STATE TRANSITION: in_thought → idle]
         * - 닫기 태그 이전까지를 혼잣말 마지막 청크로 처리한다.
         * - 닫기 태그 이후 텍스트는 다음 idle 상태에서 처리된다.
         */
        const parts = this.buffer.split(closeTag)
        const lastThoughtChunk = parts[0]
        const afterClose = parts.slice(1).join(closeTag)

        if (lastThoughtChunk.trim() !== '') {
          this.thoughtAccumulator += lastThoughtChunk
          this.callbacks.onThought(lastThoughtChunk, this.thoughtAccumulator)
        }

        this.buffer = afterClose
        this.state = 'idle'
        return
      }
    }

    /*
     * [ACCUMULATE THOUGHT TOKEN]
     * - 닫기 태그가 아직 없으면 현재 버퍼 내용을 혼잣말로 누적한다.
     * - 버퍼 길이가 100자 이상이면 안전 방출하여 UI가 실시간으로 갱신되도록 한다.
     */
    if (this.buffer.length > 100) {
      const safeChunk = this.buffer.slice(0, 80)
      this.buffer = this.buffer.slice(80)
      this.thoughtAccumulator += safeChunk
      this.callbacks.onThought(safeChunk, this.thoughtAccumulator)
    } else if (latestToken && !this.buffer.includes('<')) {
      /*
       * [REAL-TIME PARTIAL FLUSH]
       * - '<' 문자가 없는 경우 현재 버퍼를 즉시 방출하여 스트리밍감을 유지한다.
       */
      this.thoughtAccumulator += latestToken
      this.callbacks.onThought(latestToken, this.thoughtAccumulator)
      this.buffer = this.buffer.slice(latestToken.length)
    }
  }

  /**
   * in_tool_call 상태 처리.
   * </tool_call> 닫기 태그가 나타나면 내부 JSON을 파싱하여 onToolCall 콜백을 호출한다.
   */
  private processToolCallState(): void {
    if (!this.buffer.includes(ThoughtParser.TOOL_CALL_CLOSE_TAG)) {
      // 버퍼가 과도하게 커지는 것을 방지하고 청크를 안전하게 누적
      if (this.buffer.length > 500 && !this.buffer.includes('<')) {
        this.toolCallAccumulator += this.buffer
        this.buffer = ''
      }
      return
    }

    const parts = this.buffer.split(ThoughtParser.TOOL_CALL_CLOSE_TAG)
    const rawContent = this.toolCallAccumulator + parts[0]
    const afterClose = parts.slice(1).join(ThoughtParser.TOOL_CALL_CLOSE_TAG)

    this.toolCallAccumulator = ''
    this.buffer = afterClose

    const jsonStrings = this.extractJsonObjects(rawContent)

    if (jsonStrings.length === 0) {
      const errMsg = "No valid JSON object found in tool_call block."
      console.error('[ThoughtParser] tool_call JSON 추출 실패:', errMsg, '원본:', rawContent)
      if (this.callbacks.onToolCallParseError) {
        this.callbacks.onToolCallParseError(rawContent.trim(), errMsg)
      }
    } else {
      for (const jsonStr of jsonStrings) {
        try {
          const parsed = JSON.parse(jsonStr) as ToolCallRequest
          if (parsed.name && typeof parsed.name === 'string') {
            this.callbacks.onToolCall({
              name: parsed.name,
              args: parsed.args ?? {}
            })
          } else {
            console.error('[ThoughtParser] tool_call JSON에 name 필드가 없습니다:', jsonStr)
          }
        } catch (parseErr: unknown) {
          const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr)
          console.error('[ThoughtParser] 개별 tool_call JSON 파싱 실패:', errMsg, '원본:', jsonStr)
          if (this.callbacks.onToolCallParseError) {
            this.callbacks.onToolCallParseError(jsonStr.trim(), errMsg)
          }
        }
      }
    }

    this.state = 'idle'
  }

  /**
   * 내부 텍스트에서 Balanced-Brace 스캐닝 방식으로 중괄호 쌍({ })이 일치하는 모든 JSON 객체 문자열을 추출합니다.
   * 여러 개의 JSON, 이스케이프 문자, 문자열 내부의 중괄호, 불필요한 마크다운 코드 펜스 등을 안전하게 우회합니다.
   */
  private extractJsonObjects(text: string): string[] {
    const results: string[] = []
    let braceCount = 0
    let inString = false
    let escape = false
    let startIndex = -1

    for (let i = 0; i < text.length; i++) {
      const char = text[i]

      if (escape) {
        escape = false
        continue
      }

      if (char === '\\') {
        escape = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            startIndex = i
          }
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0 && startIndex !== -1) {
            results.push(text.substring(startIndex, i + 1))
            startIndex = -1
          } else if (braceCount < 0) {
            braceCount = 0
            startIndex = -1
          }
        }
      }
    }
    return results
  }

  /**
   * in_answer 상태 처리.
   * 최종 답변 텍스트를 토큰 단위로 누적하고 콜백을 트리거한다.
   *
   * @param token - 방금 수신된 답변 토큰
   */
  private processAnswerState(token: string): void {
    /*
     * [GUARD: Detect new thought/tool tags in answer]
     * - 답변 중간에 새로운 <thought> 또는 <tool_call> 태그가 나타나면
     *   상태를 idle로 전환하여 재분기한다.
     */
    if (this.buffer.includes('<thought>') || this.buffer.includes('<think>') ||
        this.buffer.includes('<tool_call>')) {
      this.state = 'idle'
      this.processIdleState()
      return
    }

    this.answerAccumulator += token
    this.callbacks.onFinalAnswerToken(token, this.answerAccumulator)
    this.buffer = ''
  }
}
