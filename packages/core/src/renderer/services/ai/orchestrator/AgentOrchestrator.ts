/**
 * @file orchestrator/AgentOrchestrator.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/AgentOrchestrator.ts
 * @role ReAct 루프 중앙 컨트롤러 (수석 셰프 / 뇌)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - useAIAgentMode.ts: deepReasoning 플래그 활성화 시 이 클래스를 인스턴스화하여 루프를 실행한다.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - LLMEngineAdapter, ThoughtParser, ToolRegistry를 조율하여 완전한 ReAct 루프를 구동한다.
 * - Thought → Tool Call → Observation → Repeat → Final Answer 사이클을 통제한다.
 * - 최대 턴 수(maxTurns)와 최대 컨텍스트 풀(contextPoolMaxTokens) 가드레일을 적용한다.
 * - 사용자 설정(Settings)에서 조절 가능한 파라미터를 OrchestratorConfig로 주입받는다.
 * - UI 계층에 OrchestratorEventCallback을 통해 실시간 이벤트를 방출한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: run() 메서드는 성공/실패 무관하게 반드시 최종 상태('done' 또는 'error')에 도달해야 한다.
 * - MUST: 컨텍스트 풀 초과 또는 maxTurns 초과 시 현재까지의 최선 답변을 반환하고 루프를 종료한다.
 * - MUST NOT: 단일 turn 내부에서 여러 tool_call을 동시에 실행하지 말 것 (턴제 원칙).
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - OrchestratorConfig: 사용자 설정에서 주입받는 구성 파라미터.
 * - OrchestratorEvent / OrchestratorEventCallback: UI 이벤트 방출 계약.
 * - AgentPhase / ToolCallRequest / ToolCallResult / TaskPlan / TaskStep: 상태 타입.
 * - ILLMEngineAdapter: 엔진 추상화 계약 인터페이스.
 */
import type {
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventCallback,
  AgentPhase,
  ToolCallRequest,
  ToolCallResult,
  TaskPlan,
  TaskStep
} from './types'

import { LLMEngineAdapterFactory } from './LLMEngineAdapter'
import type { ILLMEngineAdapter } from './types'
import { ThoughtParser } from './ThoughtParser'
import { ToolRegistry } from './ToolRegistry'

/*
 * [SELF-HEALING MIDDLEWARE IMPORT]
 * - ISelfHealingMiddleware: 2-Stage 자가 치유 파이프라인 주입 계약.
 *   Phase 1(HeuristicStrategy) → Phase 2(LLMDelegate) 순서로 복구 조율.
 *   AgentOrchestrator는 이 인터페이스만 알면 되고 구현 세부사항을 몰라도 된다.
 */
import type { ISelfHealingMiddleware, HealingContext } from './healing/types'

/*
 * [ACTOR-CRITIC HOOK IMPORT]
 * - IActorCriticHook: 위험 도구 실행 전/Final Answer 확정 전 Critic 검수 훅 계약.
 *   AgentOrchestrator는 이 인터페이스만 호출하고 검수 로직을 몰라도 된다.
 */
import type { IActorCriticHook } from './critic/types'
import { ActorCriticHook } from './critic/ActorCriticHook'

/*
 * [IPC ADAPTER IMPORT]
 * - ipc.llmAddLog: 오케스트레이터 루프 진행 이벤트를 엔진 로그 패널에 출력한다.
 */
import * as ipc from '../../ipc/electronApiAdapter'

/* ============================================================
 * 상수 정의 (Orchestrator Constants)
 * ============================================================ */

/**
 * ORCHESTRATOR_CONSTANTS
 * AgentOrchestrator 내부에서 사용하는 도메인 종속 상수.
 * God Store 방지 및 3단계 상수화 관리법(AGENTS.md 규칙 2)에 따라 도메인 지역 상수로 관리한다.
 */
const ORCHESTRATOR_CONSTANTS = {
  /**
   * 토큰 추정 계수.
   * 평균적으로 1 토큰 ≈ 4 글자(영어 기준), 한국어는 약 2~3 글자.
   * 안전 마진으로 3을 사용한다.
   */
  CHARS_PER_TOKEN_ESTIMATE: 3,

  /**
   * Task Plan 파싱을 위한 JSON 코드 블록 정규식.
   * 모델이 출력하는 ```json\n[...]\n``` 형식을 감지한다.
   */
  TASK_PLAN_REGEX: /```json\s*\n?([\s\S]*?)\n?```/i,

  /**
   * ReAct 시스템 프롬프트 템플릿 내 도구 목록 플레이스홀더.
   */
  TOOL_LIST_PLACEHOLDER: '{{TOOL_LIST}}',

  /**
   * 최종 답변 감지 키워드. 모델이 이 문자열로 시작하는 줄을 출력하면 루프를 종료한다.
   */
  FINAL_ANSWER_PREFIX: 'Final Answer:'
} as const

/* ============================================================
 * AgentOrchestratorSession 클래스
 * ============================================================ */

/**
 * AgentOrchestratorSession
 * 단일 사용자 요청에 대한 ReAct 루프 세션.
 * 세션 단위로 인스턴스를 생성하므로 동시 다중 요청이 격리된다.
 *
 * 사용 예시:
 * ```ts
 * const session = new AgentOrchestratorSession(config, onEvent)
 * await session.initialize()
 * const result = await session.run(userMessage, conversationHistory)
 * ```
 */
export class AgentOrchestratorSession {
  /*
   * [PRIVATE STATE - Configuration]
   * - config: 생성자에서 주입받은 불변 설정 객체.
   */
  private readonly config: OrchestratorConfig

  /*
   * [PRIVATE STATE - Core Components]
   * - adapter: 현재 선택된 LLM 엔진 어댑터 (프라이팬).
   * - parser: 스트림 토큰 분류 파서 (혼잣말 해석기).
   * - registry: 도구 등록 및 실행 레지스트리 (도구함).
   */
  private readonly adapter: ILLMEngineAdapter
  private readonly parser: ThoughtParser
  private readonly registry: ToolRegistry

  /*
   * [PRIVATE STATE - Event Callback]
   * - onEvent: UI 계층에서 구독하는 이벤트 방출 콜백.
   */
  private readonly onEvent: OrchestratorEventCallback

  /*
   * [PRIVATE STATE - Loop Control]
   * - currentPhase: 현재 에이전트 실행 단계.
   * - contextMessages: 누적된 대화 컨텍스트 (Stateful Orchestrator).
   * - currentTurn: 현재 진행 중인 ReAct 턴 번호 (1부터 시작).
   * - isAborted: 외부에서 abort()가 호출되었는지 여부.
   * - pendingToolCall: ThoughtParser가 감지한 미실행 도구 호출 요청.
   */
  private currentPhase: AgentPhase = 'idle'
  private contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  private currentTurn: number = 0
  private isAborted: boolean = false
  private pendingToolCall: ToolCallRequest | null = null

  /*
   * [PRIVATE STATE - Accumulators]
   * - accumulatedAnswer: 최종 답변 텍스트 누적기.
   * - accumulatedThoughts: 전체 혼잣말 누적 배열.
   */
  private accumulatedAnswer: string = ''
  private accumulatedThoughts: string[] = []

  /*
   * [PRIVATE STATE - Optional Middleware/Hook]
   * - selfHealingMiddleware: 2-Stage 자가 치유 파이프라인 (선택적 DI).
   *   주입 시 <tool_call> JSON 파싱 실패를 자동 복구한다.
   *   미주입 시 기존 에러 처리 경로로 폴백.
   * - actorCriticHook: Actor-Critic 검증 훅 (선택적 DI).
   *   주입 시 위험 도구 실행 전 및 Final Answer 확정 전 Critic 검수를 수행한다.
   *   미주입 시 검수 없이 통과.
   */
  private selfHealingMiddleware: ISelfHealingMiddleware | null = null
  private actorCriticHook: IActorCriticHook | null = null

  constructor(config: OrchestratorConfig, onEvent: OrchestratorEventCallback) {
    this.config = config
    this.onEvent = onEvent

    // 팩토리를 통해 엔진 어댑터 인스턴스 생성
    this.adapter = LLMEngineAdapterFactory.create(config)

    // ThoughtParser 콜백 바인딩
    this.parser = new ThoughtParser({
      onThought: (token, accumulated) => {
        this.accumulatedThoughts.push(token)
        this.emitEvent({ type: 'thought_token', token, accumulated })
      },
      onToolCall: (request) => {
        /*
         * [TOOL CALL INTERCEPTION]
         * - ThoughtParser가 <tool_call> JSON을 파싱 완료하면 이 콜백이 실행된다.
         * - 도구 요청을 pendingToolCall에 저장하여 스트리밍 완료 후 처리한다.
         */
        this.pendingToolCall = request
        this.emitEvent({ type: 'tool_call_start', toolName: request.name, toolArgs: request.args })
      },
      onFinalAnswerToken: (token, accumulated) => {
        this.accumulatedAnswer = accumulated
        this.emitEvent({ type: 'answer_token', token, accumulated })
      },
      onToolCallParseError: (malformedJson, parseError) => {
        /*
         * [SELF-HEALING INTEGRATION POINT]
         * - ThoughtParser에서 <tool_call> JSON 파싱이 실패하면 이 콜백이 호출된다.
         * - selfHealingMiddleware가 주입된 경우 비동기 복구를 시도한다.
         * - 복구 성공 시 healedJson을 파싱하여 pendingToolCall에 저장한다.
         * - 미주입 또는 복구 실패 시 pendingToolCall은 null 상태를 유지한다.
         *
         * 주의: ThoughtParser.onToolCallParseError는 동기 콜백이지만
         * SelfHealingMiddleware는 비동기(async)이므로 void IIFE 패턴을 사용한다.
         */
        if (this.selfHealingMiddleware !== null) {
          void (async () => {
            const healingCtx: HealingContext = {
              conversationHistory: [...this.contextMessages],
              engineAdapter: this.adapter,
              currentLlmAttempts: 0,
              maxLlmAttempts: 2
            }

            const result = await this.selfHealingMiddleware!.onToolCallParseError(
              malformedJson,
              parseError,
              healingCtx
            )

            if (result.success) {
              try {
                const healed = JSON.parse(result.healedJson) as ToolCallRequest
                if (healed.name && typeof healed.name === 'string') {
                  this.pendingToolCall = { name: healed.name, args: healed.args ?? {} }
                  this.emitEvent({
                    type: 'tool_call_start',
                    toolName: healed.name,
                    toolArgs: healed.args ?? {}
                  })
                  ipc.llmAddLog({
                    text: `[AgentOrchestrator] Self-Healing 복구 성공 (${result.method}). 도구: ${healed.name}`,
                    prefix: 'SelfHeal'
                  })
                }
              } catch (reparseErr: unknown) {
                const msg = reparseErr instanceof Error ? reparseErr.message : String(reparseErr)
                console.error('[AgentOrchestrator] Self-Healing 결과 재파싱 실패:', msg)
              }
            } else {
              ipc.llmAddLog({
                text: `[AgentOrchestrator] Self-Healing 복구 실패: ${result.error}`,
                prefix: 'SelfHeal'
              })
            }
          })()
        }
      }
    })

    // 도구 레지스트리 생성
    this.registry = new ToolRegistry()
  }

  /**
   * 세션을 초기화한다.
   * 엔진 어댑터 연결 확인, 기본 도구 등록, 모델 로딩을 수행한다.
   */
  public async initialize(): Promise<void> {
    ipc.llmAddLog({ text: '[AgentOrchestrator] 세션 초기화 시작', prefix: 'Orchestrator' })

    // 기본 내장 도구(run_command, read_file 등) 및 MCP 도구 등록
    await this.registry.registerDefaultTools()

    // 엔진 모델 로딩 (WebLLM의 경우 VRAM에 적재)
    try {
      await this.adapter.loadModel(this.config.modelId)
      ipc.llmAddLog({ text: `[AgentOrchestrator] 모델 로딩 완료: ${this.config.modelId}`, prefix: 'Orchestrator' })
    } catch (loadErr: unknown) {
      const msg = loadErr instanceof Error ? loadErr.message : String(loadErr)
      ipc.llmAddLog({ text: `[AgentOrchestrator] 모델 로딩 실패 (로컬 서버 미가동 가능성): ${msg}`, prefix: 'Orchestrator' })
      // 로딩 실패는 경고만 남기고 계속 진행 (Llama.cpp는 서버 기동 시 자동 로드)
    }
  }

  /* ──────────────────────────────────────────
   * Fluent Setters (Middleware / Hook DI)
   * ────────────────────────────────────────── */

  /**
   * Self-Healing 미들웨어를 주입한다 (Fluent API).
   * 주입 후 <tool_call> JSON 파싱 실패 시 2-Stage 자가 치유 파이프라인이 자동으로 개입한다.
   *
   * @param middleware - ISelfHealingMiddleware 구현체 (HeuristicHealing + LLMHealing)
   * @returns this (메서드 체이닝 지원)
   *
   * 사용 예시:
   * ```ts
   * const session = new AgentOrchestratorSession(config, onEvent)
   *   .withSelfHealing(SelfHealingMiddlewareFactory.createDefault(2, adapter))
   *   .withActorCritic(ActorCriticHookFactory.createDefault(criticAdapter))
   * ```
   */
  public withSelfHealing(middleware: ISelfHealingMiddleware): this {
    this.selfHealingMiddleware = middleware
    ipc.llmAddLog({ text: '[AgentOrchestrator] Self-Healing 미들웨어 주입 완료', prefix: 'Orchestrator' })
    return this
  }

  /**
   * Actor-Critic 훅을 주입한다 (Fluent API).
   * 주입 후 DANGEROUS_TOOLS 도구 실행 전 및 Final Answer 확정 전에 Critic이 개입한다.
   *
   * @param hook - IActorCriticHook 구현체 (LLMCriticStrategy 기반)
   * @returns this (메서드 체이닝 지원)
   */
  public withActorCritic(hook: IActorCriticHook): this {
    this.actorCriticHook = hook
    /*
     * [ACTOR HISTORY LINKAGE]
     * - ActorCriticHook이 REJECT 시 피드백을 주입할 contextMessages 참조를 연결한다.
     * - run() 호출 후 contextMessages가 초기화되므로 run() 내에서도 재연결한다.
     */
    if (hook instanceof ActorCriticHook) {
      hook.setActorHistory(this.contextMessages)
    }
    ipc.llmAddLog({ text: '[AgentOrchestrator] Actor-Critic 훅 주입 완료', prefix: 'Orchestrator' })
    return this
  }

  /**
   * ReAct 루프를 실행한다.
   * 사용자 메시지와 이전 대화 히스토리를 받아 최종 답변을 반환한다.
   *
   * @param userMessage - 사용자의 현재 질의 문자열
   * @param history - 이전 대화 컨텍스트 배열
   * @returns 최종 답변 문자열 (루프 완료 후)
   */
  public async run(
    userMessage: string,
    history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    this.emitPhaseChange('thinking')
    ipc.llmAddLog({ text: `[AgentOrchestrator] ReAct 루프 시작. maxTurns=${this.config.maxTurns}`, prefix: 'Orchestrator' })

    // 시스템 프롬프트 빌드
    const systemPrompt = this.buildSystemPrompt()

    // 컨텍스트 초기화: 시스템 + 이전 히스토리 + 현재 사용자 메시지
    this.contextMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ]

    /*
     * [ACTOR HISTORY RE-LINKAGE]
     * - run() 호출 시 contextMessages가 재초기화되므로 ActorCriticHook 참조를 갱신한다.
     * - 이렇게 해야 REJECT 시 올바른 배열에 피드백이 주입된다.
     */
    if (this.actorCriticHook instanceof ActorCriticHook) {
      this.actorCriticHook.setActorHistory(this.contextMessages)
      this.actorCriticHook.resetRejectionCount()
    }

    /*
     * [REACT LOOP]
     * - maxTurns와 contextPoolMaxTokens 두 가지 가드레일로 무한 루프를 방지한다.
     * - 각 턴마다: 생성 → 파서 → (도구 실행 → Observation 주입 → 반복) 또는 최종 답변.
     */
    while (this.currentTurn < this.config.maxTurns && !this.isAborted) {
      this.currentTurn++
      ipc.llmAddLog({ text: `[AgentOrchestrator] 턴 ${this.currentTurn} 시작`, prefix: 'Orchestrator' })

      // 컨텍스트 풀 가드레일 체크
      if (this.estimateContextTokens() > this.config.contextPoolMaxTokens) {
        ipc.llmAddLog({
          text: `[AgentOrchestrator] 컨텍스트 풀 초과(${this.estimateContextTokens()} > ${this.config.contextPoolMaxTokens} 토큰). 루프 조기 종료.`,
          prefix: 'Orchestrator'
        })
        break
      }

      // 파서 상태 리셋 (새 턴 시작)
      this.parser.reset()
      this.pendingToolCall = null

      try {
        // 스트리밍 생성 실행
        await this.runSingleTurn()
      } catch (turnErr: unknown) {
        const msg = turnErr instanceof Error ? turnErr.message : String(turnErr)
        console.error(`[AgentOrchestrator] 턴 ${this.currentTurn} 실행 오류:`, msg)
        this.emitPhaseChange('error')
        this.emitEvent({ type: 'error', message: msg })
        return `오류가 발생했습니다: ${msg}`
      }

      /*
       * [TOOL CALL BRANCH]
       * - pendingToolCall이 설정되어 있으면 도구를 실행하고 결과를 컨텍스트에 주입한다.
       * - 도구 실행 완료 후 다음 턴으로 계속 진행한다.
       */
      if (this.pendingToolCall !== null) {
        await this.executeToolAndObserve(this.pendingToolCall)
        continue // 다음 턴으로 진행
      }

      /*
       * [FINAL ANSWER BRANCH]
       * - pendingToolCall이 없고 답변 텍스트가 누적되었다면 루프를 종료한다.
       */
      if (this.accumulatedAnswer.trim() !== '') {
        break
      }

      /*
       * [EMPTY TURN GUARD]
       * - 도구 호출도 없고 답변도 없는 빈 턴이 나오면 루프를 종료한다.
       */
      ipc.llmAddLog({ text: `[AgentOrchestrator] 빈 턴 감지. 루프 종료.`, prefix: 'Orchestrator' })
      break
    }

    // 루프 완료 처리
    const finalAnswer = this.accumulatedAnswer.trim() || this.buildFallbackAnswer()

    /*
     * [ACTOR-CRITIC: FINAL ANSWER INTERCEPT]
     * - actorCriticHook이 주입된 경우 Final Answer 확정 직전에 Critic 검수를 수행한다.
     * - REJECT 시 피드백이 contextMessages에 주입되고 재생성이 강제된다.
     * - maxCriticRejections 초과 시 PASS 폴백으로 원본 답변을 사용한다.
     */
    if (this.actorCriticHook !== null && finalAnswer.trim() !== '') {
      const criticVerdict = await this.actorCriticHook.beforeFinalAnswer(
        finalAnswer,
        this.contextMessages.find((m) => m.role === 'user')?.content ?? ''
      )
      if (criticVerdict.verdict === 'REJECT') {
        /*
         * [REJECT: 재생성 강제]
         * - REJECT 시 currentTurn을 유지하고 루프를 한 번 더 실행한다.
         * - FeedbackInjector가 이미 contextMessages에 REJECT Observation을 주입했다.
         * - 단, maxTurns 또는 maxCriticRejections 초과 시 폴백으로 원본 답변을 사용한다.
         */
        if (this.currentTurn < this.config.maxTurns) {
          this.accumulatedAnswer = ''
          this.parser.reset()
          try {
            await this.runSingleTurn()
            const regeneratedAnswer = this.accumulatedAnswer.trim() || finalAnswer
            this.emitPhaseChange('done')
            this.emitEvent({ type: 'final_answer', answer: regeneratedAnswer })
            ipc.llmAddLog({ text: `[AgentOrchestrator] Critic 재생성 완료. 총 ${this.currentTurn}턴.`, prefix: 'Orchestrator' })
            return regeneratedAnswer
          } catch {
            // 재생성 실패 시 원본 답변 폴백
            ipc.llmAddLog({ text: '[AgentOrchestrator] Critic 재생성 실패. 원본 답변 사용.', prefix: 'Orchestrator' })
          }
        }
      }
    }

    this.emitPhaseChange('done')
    this.emitEvent({ type: 'final_answer', answer: finalAnswer })
    ipc.llmAddLog({ text: `[AgentOrchestrator] 루프 완료. 총 ${this.currentTurn}턴 실행.`, prefix: 'Orchestrator' })

    return finalAnswer
  }

  /**
   * 진행 중인 루프를 즉시 중단한다.
   */
  public async abort(): Promise<void> {
    this.isAborted = true
    await this.adapter.abort()
    this.emitPhaseChange('error')
    ipc.llmAddLog({ text: '[AgentOrchestrator] 사용자 중단 요청 처리됨', prefix: 'Orchestrator' })
  }

  /* ──────────────────────────────────────────
   * Private 메서드 (Internal Loop Mechanics)
   * ────────────────────────────────────────── */

  /**
   * 단일 ReAct 턴의 스트리밍 생성을 수행한다.
   * 각 토큰을 ThoughtParser에 주입하여 혼잣말/도구호출/답변을 실시간으로 분류한다.
   */
  private async runSingleTurn(): Promise<void> {
    let turnBuffer = ''

    await this.adapter.generateStream(
      this.contextMessages,
      (token) => {
        if (this.isAborted) return

        turnBuffer += token
        this.parser.feed(token)

        /*
         * [FINAL ANSWER DETECTION]
         * - 모델이 "Final Answer:" 접두사로 시작하는 텍스트를 출력하면
         *   파서 상태를 answering으로 전환한다.
         * - ThoughtParser가 처리하지 않는 일반 Llama.cpp ReAct 형식 지원용.
         */
        if (turnBuffer.includes(ORCHESTRATOR_CONSTANTS.FINAL_ANSWER_PREFIX) &&
            this.parser.getState() === 'idle') {
          const afterPrefix = turnBuffer.split(ORCHESTRATOR_CONSTANTS.FINAL_ANSWER_PREFIX)[1] ?? ''
          if (afterPrefix.trim() !== '') {
            this.accumulatedAnswer = afterPrefix.trim()
            this.emitEvent({ type: 'answer_token', token: afterPrefix, accumulated: this.accumulatedAnswer })
            this.emitPhaseChange('answering')
          }
        }

        /*
         * [TASK PLAN DETECTION]
         * - 초기 턴에서 모델이 JSON Task Plan을 출력하면 파싱하여 체크리스트를 생성한다.
         */
        if (this.currentTurn === 1 && turnBuffer.includes('```json')) {
          this.tryParseTaskPlan(turnBuffer)
        }
      }
    )

    /*
     * [ASSISTANT CONTEXT INJECTION]
     * - 생성된 전체 텍스트를 어시스턴트 메시지로 컨텍스트에 추가한다.
     * - 다음 턴에서 모델이 이전 생각과 행동을 기억할 수 있도록 한다.
     */
    if (turnBuffer.trim() !== '') {
      this.contextMessages.push({
        role: 'assistant',
        content: turnBuffer
      })
    }
  }

  /**
   * 도구를 실행하고 그 결과를 Observation으로 컨텍스트에 주입한다.
   * Actor-Critic 훅이 주입된 경우 실행 직전 Critic 검수를 수행한다.
   *
   * @param request - ThoughtParser가 파싱한 도구 호출 요청
   */
  private async executeToolAndObserve(request: ToolCallRequest): Promise<void> {
    this.emitPhaseChange('tool_calling')
    ipc.llmAddLog({
      text: `[AgentOrchestrator] 도구 실행: ${request.name}(${JSON.stringify(request.args)})`,
      prefix: 'Orchestrator'
    })

    /*
     * [ACTOR-CRITIC: TOOL CALL INTERCEPT]
     * - actorCriticHook이 주입된 경우, 도구 실행 직전 Critic 검수를 수행한다.
     * - REJECT 시: FeedbackInjector가 contextMessages에 피드백을 주입하고 도구 실행을 건너뛴다.
     * - PASS 또는 훅 미주입 시: 기존 도구 실행 경로로 계속 진행한다.
     */
    if (this.actorCriticHook !== null) {
      const conversationSummary = this.contextMessages
        .slice(-3)
        .map((m) => `[${m.role}]: ${m.content.slice(0, 150)}`)
        .join('\n')

      const verdict = await this.actorCriticHook.beforeToolCall(
        request.name,
        request.args,
        conversationSummary
      )

      if (verdict.verdict === 'REJECT') {
        /*
         * [REJECT: 도구 실행 건너뜀]
         * - FeedbackInjector가 이미 contextMessages에 REJECT Observation을 주입했다.
         * - 도구를 실행하지 않고 thinking 단계로 돌아가 다음 턴에서 재시도한다.
         */
        ipc.llmAddLog({
          text: `[AgentOrchestrator] Critic이 도구 '${request.name}' 실행을 거부함. 피드백 주입 후 재시도.`,
          prefix: 'Orchestrator'
        })
        this.emitPhaseChange('thinking')
        return
      }
    }

    const result: ToolCallResult = await this.registry.executeTool(request.name, request.args)

    this.emitPhaseChange('observing')
    this.emitEvent({ type: 'tool_call_end', result })

    /*
     * [OBSERVATION INJECTION]
     * - 도구 실행 결과를 user 역할 메시지로 컨텍스트에 주입한다.
     * - 이후 모델은 이 Observation을 바탕으로 다음 Thought를 생성한다.
     * - 포맷: "Observation: [결과 내용]"
     */
    const observationText = result.success
      ? `Observation: ${result.result ?? '(결과 없음)'}`
      : `Observation: 도구 실행 실패 - ${result.error ?? '알 수 없는 오류'}`

    this.contextMessages.push({
      role: 'user',
      content: observationText
    })

    ipc.llmAddLog({ text: `[AgentOrchestrator] Observation 주입 완료: ${observationText.slice(0, 100)}...`, prefix: 'Orchestrator' })
    this.emitPhaseChange('thinking')
  }

  /**
   * 현재 컨텍스트 메시지들의 총 토큰 수를 추정한다.
   * 정확한 토크나이저 없이 글자 수 기반 근사치를 사용한다.
   *
   * @returns 추정 토큰 수 (글자 수 / CHARS_PER_TOKEN_ESTIMATE)
   */
  private estimateContextTokens(): number {
    const totalChars = this.contextMessages
      .reduce((sum, msg) => sum + msg.content.length, 0)
    return Math.ceil(totalChars / ORCHESTRATOR_CONSTANTS.CHARS_PER_TOKEN_ESTIMATE)
  }

  /**
   * 스트리밍 버퍼에서 Task Plan JSON을 찾아 파싱하고 이벤트를 방출한다.
   * 초기 턴에서 모델이 Plan을 먼저 출력하도록 시스템 프롬프트에서 강제한다.
   *
   * @param buffer - 현재까지 누적된 스트리밍 텍스트
   */
  private tryParseTaskPlan(buffer: string): void {
    const match = buffer.match(ORCHESTRATOR_CONSTANTS.TASK_PLAN_REGEX)
    if (!match || !match[1]) return

    try {
      const parsed = JSON.parse(match[1]) as Array<{ id?: number; description?: string; step?: string }>

      /*
       * [TASK PLAN NORMALIZATION]
       * - 모델이 다양한 키 이름으로 Plan을 출력할 수 있으므로 정규화한다.
       * - id, description 필드를 우선 사용하고 없으면 인덱스/step 값으로 대체한다.
       */
      const steps: TaskStep[] = parsed.map((item, index) => ({
        id: item.id ?? index + 1,
        description: item.description ?? item.step ?? `단계 ${index + 1}`,
        status: 'pending' as const
      }))

      const plan: TaskPlan = {
        goal: this.contextMessages.find((m) => m.role === 'user')?.content ?? '목표',
        steps,
        currentStepIndex: 0
      }

      this.emitEvent({ type: 'task_plan', plan })
      ipc.llmAddLog({ text: `[AgentOrchestrator] Task Plan 감지: ${steps.length}단계`, prefix: 'Orchestrator' })
    } catch {
      /*
       * [INTENTIONAL IGNORE]
       * - 버퍼가 아직 완전한 JSON이 아닐 수 있으므로 파싱 실패는 무시한다.
       * - 다음 토큰 수신 시 재시도된다.
       */
    }
  }

  /**
   * 최종 답변 축적에 실패한 경우 혼잣말 내용을 기반으로 대체 답변을 생성한다.
   */
  private buildFallbackAnswer(): string {
    if (this.accumulatedThoughts.length > 0) {
      return `[추론 완료] ${this.accumulatedThoughts.join('').slice(0, 500)}`
    }
    return '요청을 처리하는 중에 문제가 발생했습니다. 다시 시도해주세요.'
  }

  /**
   * 에이전트 단계 변경 이벤트를 방출하고 내부 상태를 갱신한다.
   *
   * @param phase - 전환할 새로운 AgentPhase
   */
  private emitPhaseChange(phase: AgentPhase): void {
    this.currentPhase = phase
    this.emitEvent({ type: 'phase_change', phase })
  }

  /**
   * onEvent 콜백을 통해 UI 계층으로 이벤트를 방출한다.
   *
   * @param event - 방출할 OrchestratorEvent 객체
   */
  private emitEvent(event: OrchestratorEvent): void {
    try {
      this.onEvent(event)
    } catch (callbackErr: unknown) {
      /*
       * [ERROR HANDLING - CALLBACK GUARD]
       * - UI 콜백에서 발생한 예외가 오케스트레이터 루프를 중단시키지 않도록 격리한다.
       */
      console.error('[AgentOrchestrator] 이벤트 콜백 실행 중 오류:', callbackErr)
    }
  }

  /**
   * 오케스트레이터 ReAct 시스템 프롬프트를 빌드한다.
   * 등록된 도구 목록을 프롬프트에 직렬화하여 삽입한다.
   *
   * 프롬프트 구조:
   * 1. 에이전트 역할 정의
   * 2. 사용 가능한 도구 목록 (ToolRegistry에서 직렬화)
   * 3. ReAct 출력 포맷 강제 지침
   * 4. Task Plan 생성 지침 (복잡한 요청의 경우)
   */
  private buildSystemPrompt(): string {
    const toolList = this.registry.serializeForPrompt()

    return `당신은 AMEVA OS의 자율 ReAct 에이전트입니다. 사용자의 요청을 해결하기 위해 도구를 활용하고, 단계적으로 사고하며 행동합니다.

${toolList}

## 출력 규칙 (반드시 준수)

복잡한 요청의 경우, 먼저 아래 JSON 형식으로 Task Plan을 작성하세요:
\`\`\`json
[
  {"id": 1, "description": "1단계 작업 설명"},
  {"id": 2, "description": "2단계 작업 설명"}
]
\`\`\`

그런 다음 각 단계를 처리할 때 다음 포맷을 반드시 사용하세요:

<thought>
여기에 현재 상황 분석과 다음 행동 계획을 한국어로 작성하세요.
어떤 도구를 왜 사용할지 설명하세요.
</thought>

도구가 필요하다면:
<tool_call>
{"name": "도구명", "args": {"인자명": "값"}}
</tool_call>

모든 작업이 완료되어 최종 답변이 준비되면:
Final Answer: [여기에 사용자에게 전달할 최종 답변을 작성하세요]

## 핵심 원칙
- 한 번에 하나의 도구만 호출하세요 (턴제 원칙).
- 도구 실행 결과(Observation)를 받은 후 다음 Thought를 작성하세요.
- 최종 답변이 준비되지 않은 경우 절대로 "Final Answer:"를 사용하지 마세요.
- 모든 혼잣말(<thought>)과 최종 답변은 한국어로 작성하세요.`
  }
}
