/**
 * @file orchestrator/critic/ActorCriticHook.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/critic/ActorCriticHook.ts
 * @role IActorCriticHook 표준 구현체 — Actor-Critic 검증 훅 메인 조율자
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: DI 주입받아 위험 도구 실행 전/Final Answer 확정 전 호출.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - beforeToolCall: DANGEROUS_TOOLS 목록에 있는 도구 실행 직전 Critic 검수 요청.
 * - beforeFinalAnswer: Final Answer 확정 직전 Critic 검수 요청 (설정에 따라).
 * - REJECT 시 FeedbackInjector로 Actor 히스토리에 피드백 주입.
 * - maxCriticRejections 초과 시 경고와 함께 PASS 폴백 반환.
 * - Critic 검수 소요 시간을 IPC 로그에 기록.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: beforeToolCall/beforeFinalAnswer는 항상 CriticVerdict를 반환해야 함.
 * - MUST: maxCriticRejections 초과 시 루프를 중단하지 않고 PASS 폴백 반환.
 * - MUST NOT: God Class 방지 — 실제 검수/주입 로직을 이 클래스에 구현하지 말 것.
 * - MUST NOT: any 타입을 사용하지 말 것.
 */

/*
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - IActorCriticHook, ActorCriticConfig, CriticVerdict: 계약 타입.
 * - CriticContext, CriticRejectVerdict: 내부 로직용 타입.
 */
import type {
  IActorCriticHook,
  ActorCriticConfig,
  CriticVerdict,
  CriticContext,
  CriticRejectVerdict
} from './types'

/*
 * [IPC LOG IMPORT]
 * - ipc.llmAddLog: Critic 검수 이벤트를 엔진 로그 패널에 출력.
 */
import * as ipc from '../../../ipc/electronApiAdapter'

/*
 * [LLM ENGINE ADAPTER IMPORT]
 * - ILLMEngineAdapter: Critic 전용 엔진 어댑터 타입 참조.
 */
import type { ILLMEngineAdapter } from '../types'

/*
 * [STRATEGY IMPORTS - for createDefault factory]
 * - LLMCriticStrategy: 1.5B Critic 전략 실성 구현체.
 * - FeedbackInjector: REJECT 피드백 주입기 구현체.
 */
import { LLMCriticStrategy } from './LLMCriticStrategy'
import { FeedbackInjector } from './FeedbackInjector'

/* ============================================================
 * ActorCriticHook 구현체
 * ============================================================ */

/**
 * ActorCriticHook
 * IActorCriticHook의 표준 구현체.
 * AgentOrchestrator에 DI로 주입되어 Critic 검수 훅 진입점을 제공한다.
 *
 * 내부 상태 관리:
 * - rejectionCount: 세션 내 REJECT 누적 횟수. resetRejectionCount()로 초기화.
 * - actorHistory: AgentOrchestrator가 주입한 Actor 대화 히스토리 참조.
 */
export class ActorCriticHook implements IActorCriticHook {
  /*
   * [PRIVATE STATE - Configuration]
   * - config: 생성자에서 주입받은 불변 설정 객체.
   */
  private readonly config: ActorCriticConfig

  /*
   * [PRIVATE STATE - Critic Engine Reference]
   * - criticAdapter: Critic 전용 LLM 엔진 어댑터 (Actor 엔진과 분리).
   *   ActorOrchestrator에서 모델 스와핑(Swapping) 시 교체 가능.
   */
  private readonly criticAdapter: ILLMEngineAdapter

  /*
   * [PRIVATE STATE - Rejection Counter]
   * - rejectionCount: 세션 내 REJECT 누적 횟수.
   * - 예상 값: 0 ~ maxCriticRejections.
   */
  private rejectionCount: number = 0

  /*
   * [PRIVATE STATE - Actor History Reference]
   * - actorHistory: AgentOrchestrator가 주입한 Actor 대화 히스토리.
   * - REJECT 시 FeedbackInjector가 이 배열에 Observation을 직접 추가.
   */
  private actorHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  constructor(config: ActorCriticConfig, criticAdapter: ILLMEngineAdapter) {
    this.config = config
    this.criticAdapter = criticAdapter
  }

  /**
   * Actor 대화 히스토리 참조를 설정한다.
   * AgentOrchestrator가 세션 시작 시 주입해야 한다.
   *
   * @param history - Actor의 현재 대화 히스토리 배열 (참조)
   */
  public setActorHistory(
    history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): void {
    this.actorHistory = history
  }

  /**
   * REJECT 카운터를 초기화한다.
   * 새로운 ReAct 세션 시작 시 AgentOrchestrator가 호출해야 한다.
   */
  public resetRejectionCount(): void {
    this.rejectionCount = 0
  }

  /* ──────────────────────────────────────────
   * IActorCriticHook 구현
   * ────────────────────────────────────────── */

  /**
   * 위험 도구 실행 직전 Critic 검수를 요청한다.
   * DANGEROUS_TOOLS 목록에 없는 도구는 즉시 PASS를 반환한다.
   *
   * @param toolName - 실행 예정 도구 명칭
   * @param toolArgs - 실행 예정 도구 인자
   * @param conversationContext - 현재 대화 컨텍스트 요약
   * @returns CriticVerdict
   */
  public async beforeToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    conversationContext: string
  ): Promise<CriticVerdict> {
    /*
     * [FAST-PASS: 안전 도구 체크]
     * - DANGEROUS_TOOLS 목록에 없는 도구는 Critic 검수 없이 즉시 PASS 반환.
     * - read_file, list_dir 등의 안전 도구에 불필요한 지연 방지.
     */
    if (!this.config.dangerousTools.includes(toolName)) {
      return { verdict: 'PASS', latencyMs: 0 }
    }

    ipc.llmAddLog({
      text: `[Critic] 위험 도구 '${toolName}' 감지. 비평가 검수 시작...`,
      prefix: 'ActorCritic'
    })

    return this.evaluateAndHandleVerdict(
      {
        criticEngineAdapter: this.criticAdapter,
        payload: {
          kind: 'tool_call',
          toolName,
          toolArgs,
          conversationContext
        }
      },
      'tool_call'
    )
  }

  /**
   * Final Answer 확정 직전 Critic 검수를 요청한다.
   * critiqueFinalAnswer가 false이면 즉시 PASS를 반환한다.
   *
   * @param answer - 확정 예정 최종 답변
   * @param originalQuery - 원래 사용자 질문
   * @returns CriticVerdict
   */
  public async beforeFinalAnswer(
    answer: string,
    originalQuery: string
  ): Promise<CriticVerdict> {
    /*
     * [FAST-PASS: Final Answer Critique 비활성화 체크]
     * - critiqueFinalAnswer가 false이면 즉시 PASS 반환.
     */
    if (!this.config.critiqueFinalAnswer) {
      return { verdict: 'PASS', latencyMs: 0 }
    }

    ipc.llmAddLog({
      text: `[Critic] Final Answer 검수 시작... (길이: ${answer.length}자)`,
      prefix: 'ActorCritic'
    })

    return this.evaluateAndHandleVerdict(
      {
        criticEngineAdapter: this.criticAdapter,
        payload: {
          kind: 'final_answer',
          answer,
          originalQuery
        }
      },
      'final_answer'
    )
  }

  /* ──────────────────────────────────────────
   * private: 공통 평가 + 처리 로직
   * ────────────────────────────────────────── */

  /**
   * Critic 전략을 실행하고 REJECT 시 피드백 주입을 수행하는 내부 공통 메서드.
   * beforeToolCall과 beforeFinalAnswer의 공통 로직을 캡슐화한다.
   */
  private async evaluateAndHandleVerdict(
    ctx: CriticContext,
    targetKind: 'tool_call' | 'final_answer'
  ): Promise<CriticVerdict> {
    /*
     * [GUARD: maxCriticRejections 초과 체크]
     * - 이미 최대 거부 횟수를 소진한 경우 경고와 함께 PASS 폴백 반환.
     * - 무한 거부 루프 방지.
     */
    if (this.rejectionCount >= this.config.maxCriticRejections) {
      ipc.llmAddLog({
        text: `[Critic] 최대 거부 횟수(${this.config.maxCriticRejections}회) 소진. 폴백 UNCERTAIN 반환.`,
        prefix: 'ActorCritic'
      })
      return { verdict: 'UNCERTAIN', reason: 'Max critic rejections exceeded', latencyMs: 0 }
    }

    /*
     * [CRITIC STRATEGY 실행]
     * - DI로 주입된 ICriticStrategy를 통해 검수를 수행한다.
     * - 전략 구현체는 항상 CriticVerdict를 반환 (throw 금지).
     */
    const verdict = await this.config.criticStrategy.evaluate(ctx)

    if (verdict.verdict === 'PASS') {
      ipc.llmAddLog({
        text: `[Critic] ${targetKind} PASS (검수 소요: ${verdict.latencyMs}ms)`,
        prefix: 'ActorCritic'
      })
      return verdict
    }

    /*
     * [REJECT 처리]
     * - 거부 횟수 증가.
     * - FeedbackInjector로 Actor 히스토리에 REJECT 사유 주입.
     */
    this.rejectionCount++

    ipc.llmAddLog({
      text: `[Critic] ${targetKind} REJECT (${this.rejectionCount}/${this.config.maxCriticRejections}). 사유: ${verdict.reason}`,
      prefix: 'ActorCritic'
    })

    /*
     * [FEEDBACK INJECTION]
     * - REJECT 사유와 수정 제안을 Actor 히스토리에 주입한다.
     * - actorHistory가 비어있으면 주입을 건너뛴다 (안전 가드).
     */
    if (this.actorHistory.length > 0) {
      this.config.feedbackInjector.injectRejection(
        verdict as CriticRejectVerdict,
        this.actorHistory,
        targetKind
      )
    } else {
      console.warn('[ActorCriticHook] actorHistory가 비어있습니다. setActorHistory()를 먼저 호출하세요.')
    }

    return verdict
  }
}

/* ============================================================
 * ActorCriticHookFactory
 * ============================================================ */

/**
 * ActorCriticHookFactory
 * DI 기반으로 ActorCriticHook 인스턴스를 생성하는 팩토리.
 */
export class ActorCriticHookFactory {
  /**
   * 기본 설정으로 ActorCriticHook을 생성하는 편의 메서드.
   *
   * @param criticAdapter - Critic 전용 LLM 엔진 어댑터
   * @param options - 설정 오버라이드 (선택적)
   * @returns IActorCriticHook 구현체
   */
  public static createDefault(
    criticAdapter: ILLMEngineAdapter,
    options: Partial<Pick<ActorCriticConfig, 'dangerousTools' | 'critiqueFinalAnswer' | 'maxCriticRejections'>> = {}
  ): ActorCriticHook {
    const config: ActorCriticConfig = {
      dangerousTools: options.dangerousTools ?? ['run_command', 'write_file'],
      critiqueFinalAnswer: options.critiqueFinalAnswer ?? false,
      maxCriticRejections: options.maxCriticRejections ?? 2,
      criticStrategy: new LLMCriticStrategy(),
      feedbackInjector: new FeedbackInjector()
    }

    return new ActorCriticHook(config, criticAdapter)
  }
}
