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
  TaskPlan,
  TaskStep
} from './types'

import { LLMEngineAdapterFactory } from './LLMEngineAdapter'
import type { ILLMEngineAdapter } from './types'
import { ThoughtParser } from './ThoughtParser'
import { ToolRegistry } from './ToolRegistry'

// 신규 Task Runtime 모듈 임포트
import { TaskGraph } from './task/TaskGraph'
import { TaskQueue } from './task/TaskQueue'
import { TaskExecutor } from './task/TaskExecutor'
import { TaskVerifier } from './task/TaskVerifier'
import { TaskCompletionManager } from './task/TaskCompletionManager'
import { FinalReporter } from './task/FinalReporter'
import { TaskEventLog } from './task-runtime/events/TaskEventLog'
import { TaskRuntimeStore } from './task-runtime/store/TaskRuntimeStore'
import { LegacyTaskPlanAdapter, type LegacyTaskPayload } from './task-runtime/compatibility/LegacyTaskPlanAdapter'

// PHASE 2 신규 Planning 파이프라인 임포트
import { GoalInterpreter } from './task-runtime/planning/goal/GoalInterpreter'
import { TaskPlanner as V2TaskPlanner } from './task-runtime/planning/planner/TaskPlanner'
import { PlanValidator } from './task-runtime/planning/validation/PlanValidator'
import { PlanActivationService } from './task-runtime/planning/activation/PlanActivationService'
import type { TaskPlan as V2TaskPlan } from './task-runtime/planning/domain/PlanningTypes'

// PHASE 3 신규 Execution 런타임 임포트
import { MissionExecutionRuntime } from './task-runtime/mission/MissionExecutionRuntime'

// FINAL REMEDIATION — STAGE B: Feature Flag 및 Execution Ownership
import { V2RuntimeFeatureFlag } from './task-runtime/domain/V2RuntimeFeatureFlag'

// [Item 3] 앱 재시작 복원 — RuntimeRestoreCoordinator + IndexedDB Adapter
import { RuntimeRestoreCoordinator } from './task-runtime/persistence/RuntimeRestoreCoordinator';
import {
  IndexedDBRuntimePersistenceAdapter,
  InMemoryRuntimePersistenceAdapter,
} from './task-runtime/persistence/RuntimePersistenceAdapter';

// Legacy TaskPlanner
import { TaskPlanner } from './task/TaskPlanner'

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
import { SupervisorAgent } from './recovery/SupervisorAgent'
import { CriticAgent } from './recovery/CriticAgent'
import { RecoveryEngine } from './recovery/RecoveryEngine'
import { CheckpointSystem } from './recovery/CheckpointSystem'
import type { RecoveryOrchestratorBridge } from './recovery/RecoveryEngine'
import type { RecoveryCheckpoint } from './recovery/types'

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
  private contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  private currentTurn: number = 0
  private isAborted: boolean = false
  private pendingToolCall: ToolCallRequest | null = null

  // Recovery-First 아키텍처 멤버
  private readonly sessionId: string = 'sess_' + Math.random().toString(36).substring(2, 9)
  private readonly supervisor: SupervisorAgent = SupervisorAgent.getInstance()
  private readonly critic: CriticAgent = new CriticAgent()
  private checkpointIntervalId: any = null

  // 신규 Task Runtime 멤버
  private taskQueue: TaskQueue | null = null
  private taskGraph: TaskGraph | null = null

  // Task Runtime V2 Core Store (Shadow Mode)
  private readonly eventLog: TaskEventLog = new TaskEventLog()
  private readonly taskStore: TaskRuntimeStore = new TaskRuntimeStore(this.eventLog)

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
                text: `[AgentOrchestrator] Self-Healing 복구 실패: ${(result as any).reason || (result as any).error || 'Unknown error'}`,
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
    // V2 Runtime에서 actorCriticHook 필드는 사용하지 않거나 외부 주입으로 변경됨
    // 하위 호환성을 위해 메서드는 유지하되 내부 참조만 설정한다.
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
    ipc.llmAddLog({ text: `[AgentOrchestrator] 신규 Task Runtime Engine 가동 시작`, prefix: 'Orchestrator' })

    // supervisor 모니터링 및 체크포인트 시작
    this.supervisor.startMonitoring(this.sessionId, (reason) => {
      void RecoveryEngine.getInstance().handleStall(reason, this.buildRecoveryBridge())
    })

    // [PHASE 2.5 & 3] V2 Planning Pipeline & Execution Runtime Integration
    // [STAGE B] Feature Flag: 기본값 LEGACY_ONLY. V2는 명시적 활성화 시만 시도.
    let v2Success = false;
    let activePlan: V2TaskPlan | null = null;

    if (V2RuntimeFeatureFlag.shouldAttemptV2(this.sessionId)) {
      try {
        ipc.llmAddLog({ text: `[AgentOrchestrator] V2 mode: ${V2RuntimeFeatureFlag.getMode()}. Attempting V2 Planning Pipeline...`, prefix: 'Orchestrator' });
        activePlan = await this.planAndActivateV2(this.sessionId, userMessage);
        v2Success = true;
      } catch (e: any) {
        ipc.llmAddLog({ text: `[AgentOrchestrator] V2 Pipeline Failed: ${(e instanceof Error ? e.message : String(e))}. Checking fallback policy...`, prefix: 'Orchestrator' });
        // Planning/Activation 실패: Execution 미시작이므로 Legacy Fallback 허용 여부 확인
        if (!V2RuntimeFeatureFlag.isLegacyFallbackAllowed(this.sessionId)) {
          // V2_ONLY 모드이거나 이미 Execution이 시작된 경우 — 오류 전파
          throw e;
        }
        ipc.llmAddLog({ text: `[AgentOrchestrator] Legacy Fallback allowed for session ${this.sessionId}.`, prefix: 'Orchestrator' });
      }
    } else {
      ipc.llmAddLog({ text: `[AgentOrchestrator] V2 mode: ${V2RuntimeFeatureFlag.getMode()}. V2 skipped. Using Legacy path.`, prefix: 'Orchestrator' });
    }

    if (v2Success && activePlan) {
      ipc.llmAddLog({ text: `[AgentOrchestrator] V2 Pipeline Success. Launching MissionExecutionRuntime (PHASE 3)`, prefix: 'Orchestrator' });

      // [STAGE B] Execution Ownership 획득 — V2가 실행 소유자
      V2RuntimeFeatureFlag.acquireV2Ownership(this.sessionId, this.sessionId);

      /*
       * [Item 3 — RuntimeRestoreCoordinator 앱 진입점 연결]
       * IndexedDB가 지원되는 Renderer 환경에서는 IndexedDB Adapter 사용.
       * Renderer 환경 감지: typeof indexedDB !== 'undefined'
       * 미지원 환경(테스트/SSR): InMemoryRuntimePersistenceAdapter 폴백.
       *
       * 세션 시작 시 미완료 Mission 목록을 감지하여 로그에 남긴다.
       * 자동 재개는 하지 않음 — 사용자 승인 필요 (UserAssistRuntime 통해 처리).
       */
      const persistenceAdapter =
        typeof indexedDB !== 'undefined'
          ? new IndexedDBRuntimePersistenceAdapter()
          : new InMemoryRuntimePersistenceAdapter();

      // 미완료 Mission 감지 (비동기, 실패해도 실행 차단 안 함)
      new RuntimeRestoreCoordinator(persistenceAdapter)
        .detectIncompleteMissions()
        .then(incomplete => {
          if (incomplete.length > 0) {
            ipc.llmAddLog({
              text: `[AgentOrchestrator] ${incomplete.length}개의 미완료 Mission이 감지되었습니다: ${incomplete.map(m => m.missionId).join(', ')}`,
              prefix: 'Orchestrator'
            });
          }
        })
        .catch((detectErr: unknown) => {
          const msg = detectErr instanceof Error ? detectErr.message : String(detectErr);
          console.warn('[AgentOrchestrator] 미완료 Mission 감지 실패:', msg);
        });

      const v2Runtime = new MissionExecutionRuntime(
        this.taskStore, this.adapter, this.sessionId, 10000, persistenceAdapter
      );

      // [STAGE B] Execution 시작 마킹 — 이 이후 Legacy Fallback 절대 금지
      V2RuntimeFeatureFlag.markV2ExecutionStarted(this.sessionId);
      v2Runtime.start();

      // V2 런타임 폴링 대기 (PAUSED = work done)
      return await new Promise<string>((resolve) => {
        const intervalId = setInterval(() => {
          if (this.isAborted) {
            v2Runtime.cancel('User aborted mission');
            clearInterval(intervalId);
            V2RuntimeFeatureFlag.releaseOwnership(this.sessionId);
            this.emitPhaseChange('error');
            resolve('Mission aborted by user.');
            return;
          }

          const missionState = this.taskStore.getMissionState(this.sessionId);
          if (!missionState) return;

          if (missionState.status === 'PAUSED' || missionState.status === 'COMPLETED') {
            clearInterval(intervalId);
            V2RuntimeFeatureFlag.releaseOwnership(this.sessionId);
            this.emitPhaseChange('done');
            resolve(`V2 Mission finished. Consumed Tasks: ${this.taskStore.getAllTasks(this.sessionId).length}`);
          } else if (missionState.status === 'FAILED') {
            clearInterval(intervalId);
            V2RuntimeFeatureFlag.releaseOwnership(this.sessionId);
            this.emitPhaseChange('error');
            resolve(`V2 Mission Failed: ${missionState.cancellationReason || 'Unknown error'}`);
          } else if (missionState.status === 'CANCELLED') {
            clearInterval(intervalId);
            V2RuntimeFeatureFlag.releaseOwnership(this.sessionId);
            this.emitPhaseChange('error');
            resolve(`V2 Mission Cancelled: ${missionState.cancellationReason}`);
          }
        }, 1000);
      });
    }

    // [STAGE B] Legacy Ownership 획득 — Legacy가 실행 소유자
    V2RuntimeFeatureFlag.acquireLegacyOwnership(this.sessionId);


    // 1. Task Planner 가동하여 Goal에 기반한 태스크 계획 획득 (Legacy Fallback)
    const planner = new TaskPlanner(this.adapter)
    const initialTasks = await planner.plan(userMessage)

    // [Task Runtime V2] Legacy JSON(initialTasks) -> Domain Entity 변환 및 Store 등록 (Shadow Mode)
    const adapterResult = LegacyTaskPlanAdapter.importFromLegacy(initialTasks as unknown as LegacyTaskPayload[]);
    for (const entity of adapterResult.importedTasks) {
      this.taskStore.registerTask(entity, this.sessionId);
    }
    if (adapterResult.warnings.length > 0) {
      ipc.llmAddLog({ text: `[AgentOrchestrator] Task Runtime V2 Adapter 경고: ${adapterResult.warnings.length}건 발생`, prefix: 'TaskV2' });
    }

    // 2. Task Graph 및 Queue, Completion Manager 초기화
    this.taskGraph = new TaskGraph(initialTasks)
    
    // Cycle 오류 체크 가드
    if (this.taskGraph.hasCycle()) {
      ipc.llmAddLog({ text: '[AgentOrchestrator] 태스크 그래프 상에 순환 의존성(Cycle) 감지! 폴백 처리합니다.', prefix: 'Orchestrator' })
    }
    
    this.taskQueue = new TaskQueue(this.taskGraph)
    const completionManager = new TaskCompletionManager(this.taskQueue)

    // Zustand 스토어 참조 (useAIState 동적 임포트 형태 바인딩)
    const { useAIState } = await import('../../../stores/useAIState')
    const state = useAIState.getState()

    // 5초 체크포인트 주기 연동 (태스크 상태 직렬화 병합)
    this.checkpointIntervalId = setInterval(async () => {
      if (this.isAborted) return
      await CheckpointSystem.saveCheckpoint(this.sessionId, {
        goal: userMessage,
        thought: this.parser.getAccumulatedThought() ?? '',
        partialAnswer: this.accumulatedAnswer,
        toolState: this.pendingToolCall ? JSON.stringify(this.pendingToolCall) : '',
        step: this.currentTurn,
        contextMessages: this.contextMessages,
        tasks: this.taskGraph ? this.taskGraph.getTasks() : [] // 태스크 상태 직렬화 추가
      })
    }, 5000)

    // 동적 UI 싱크 함수 선언
    const syncUIState = () => {
      if (!this.taskGraph) return;
      const allTasks = this.taskGraph.getTasks();
      const steps = allTasks.map((t, idx) => ({
        id: idx + 1, // 기존 UI 호환용 정수 ID
        description: t.title,
        status: t.status === 'COMPLETED' ? 'done' as const : 
                t.status === 'RUNNING' ? 'in_progress' as const : 
                t.status === 'FAILED' ? 'failed' as const : 'pending' as const
      }));
      state.setAgentTaskPlan({ goal: userMessage, steps, currentStepIndex: 0 });
      state.setTaskProgress(completionManager.getCompletionRate());
    };

    // 최초 UI 동기화
    syncUIState()

    // ── Human-in-the-loop: Task Plan 승인 대기 ──
    const approvalResult = await new Promise<{ approved: boolean; feedback?: string }>((resolve) => {
      state.setPlanApprovalState('pending')
      state.setResolvePlanApproval(resolve)
      
      this.emitEvent({
        type: 'plan_approval_request',
        plan: { goal: userMessage, steps: state.agentTaskPlan?.steps ?? [] }
      })
    })

    state.setPlanApprovalState('idle')
    state.setResolvePlanApproval(null)

    if (!approvalResult.approved) {
      ipc.llmAddLog({ text: `[AgentOrchestrator] 사용자가 플랜 리뷰를 요청했습니다: ${approvalResult.feedback}`, prefix: 'Orchestrator' })
      const replannedMessage = `[이전 목표]\n${userMessage}\n\n[사용자 피드백에 따른 계획 수정 요청]\n${approvalResult.feedback ?? ''}`
      this.cleanupRecovery()
      return await this.run(replannedMessage, history)
    }

    try {
      const executor = new TaskExecutor()
      const verifier = new TaskVerifier(this.adapter)

      // 시스템 프롬프트 및 이전 대화 컨텍스트 초기화
      const systemPrompt = this.buildSystemPrompt()
      this.contextMessages = [
        { role: 'system', content: systemPrompt },
        ...history
      ]

      // 3. Task Dispatcher & Execution 루프 구동
      while (this.taskQueue && this.taskQueue.hasMoreTasks() && !this.isAborted) {
        const currentTask = this.taskQueue.dispatchNext()
        if (!currentTask) {
          // READY 상태 노드가 없는데 PENDING이 남은 경우 (의존성 대기)
          await new Promise(resolve => setTimeout(resolve, 500));
          continue
        }

        ipc.llmAddLog({ text: `[AgentOrchestrator] 태스크 실행 개시: ${currentTask.id} (${currentTask.title})`, prefix: 'Orchestrator' })
        syncUIState()

        let verifyPassed = false;
        
        while (currentTask.retries <= currentTask.maxRetries && !this.isAborted) {
          currentTask.retries++;
          
          // 태스크 실행 시작 이벤트 방출
          this.emitEvent({
            type: 'task_exec_start',
            taskTitle: currentTask.title,
            attempt: currentTask.retries
          })
          
          // 태스크별 ReAct 루프 가동
          this.accumulatedAnswer = '' // 답변 버퍼 초기화
          const result = await executor.execute(currentTask, this)

          if (result.status === 'SUCCESS') {
            // Verifier를 통한 2단계 사후 검정
            verifyPassed = await verifier.verify(currentTask, result, this)
            if (verifyPassed) {
              this.taskQueue.setCompleted(currentTask.id, result)
              
              // [Task Runtime V2] 상태 전이 동기화 (RUNNING -> VERIFYING -> COMPLETED)
              try {
                const shadowAttemptId = `attempt_${crypto.randomUUID()}`;
                
                // 1. READY 전이
                this.taskStore.dispatchTransition({
                  commandId: crypto.randomUUID(), missionId: this.sessionId, taskId: currentTask.id, expectedCurrentStatus: 'PENDING', expectedStateVersion: 1, reason: 'Shadow Sync READY', actor: 'orchestrator', timestamp: Date.now()
                }, 'READY');
                
                // 2. RUNNING 전이 (Attempt 활성화)
                this.taskStore.dispatchTransition({
                  commandId: crypto.randomUUID(), missionId: this.sessionId, taskId: currentTask.id, expectedCurrentStatus: 'READY', expectedStateVersion: 2, reason: 'Shadow Sync RUNNING', actor: 'orchestrator', timestamp: Date.now()
                }, 'RUNNING', { 
                  activeAttemptId: shadowAttemptId,
                  attempts: {
                    [shadowAttemptId]: {
                      attemptId: shadowAttemptId, taskId: currentTask.id, sequence: currentTask.retries, status: 'RUNNING', reasoningTurns: 1, toolCallCount: 1, recoveryCount: 0
                    }
                  }
                });

                // 3. VERIFYING 전이
                this.taskStore.dispatchTransition({
                  commandId: crypto.randomUUID(), missionId: this.sessionId, taskId: currentTask.id, expectedCurrentStatus: 'RUNNING', expectedStateVersion: 3, reason: 'Shadow Sync VERIFYING', actor: 'orchestrator', timestamp: Date.now()
                }, 'VERIFYING');

                // 4. COMPLETED 전이 (Result 및 Verification 주입)
                this.taskStore.dispatchTransition({
                  commandId: crypto.randomUUID(), missionId: this.sessionId, taskId: currentTask.id, expectedCurrentStatus: 'VERIFYING', expectedStateVersion: 4, reason: 'Shadow Sync COMPLETED', actor: 'orchestrator', timestamp: Date.now()
                }, 'COMPLETED', {
                  taskResult: {
                    attemptId: shadowAttemptId, taskId: currentTask.id, createdAt: Date.now(), status: 'COMPLETED', summary: result.summary || '', outputs: [], evidence: []
                  } as any,
                  verification: {
                    verificationId: crypto.randomUUID(), taskId: currentTask.id, attemptId: shadowAttemptId, verdict: 'PASS', passedCriteria: [], failedCriteria: [], verifierType: 'semantic', createdAt: Date.now()
                  }
                });
              } catch (e: any) { 
                ipc.llmAddLog({ text: `[AgentOrchestrator] Shadow Sync Drift 감지: ${e.message}`, prefix: 'TaskV2' });
              }

              this.emitEvent({
                type: 'critic_feedback',
                verdict: 'PASS',
                reason: `태스크 ${currentTask.id} (${currentTask.title}) 비평가 검증 최종 통과.`,
                taskTitle: currentTask.title
              })
              break
            }
          }

          // 검증 실패 시 또는 실행 실패 시 처리
          const failReason = result.status !== 'SUCCESS' ? (result.summary || '실행 오류') : '의미론적 산출 기준 미달';
          this.emitEvent({
            type: 'critic_feedback',
            verdict: 'FAIL',
            reason: `태스크 ${currentTask.id} (${currentTask.title}) 비평 검증 실패 (사유: ${failReason}). 재시도 대기...`,
            taskTitle: currentTask.title
          })
          
          ipc.llmAddLog({ text: `[AgentOrchestrator] 태스크 ${currentTask.id} 수행 또는 검증 실패 (시도 ${currentTask.retries}/${currentTask.maxRetries})`, prefix: 'Orchestrator' })
          
          if (currentTask.retries > currentTask.maxRetries) {
            // Skip 처리
            this.taskQueue.setSkipped(currentTask.id)
            break
          } else {
            this.taskQueue.setFailed(currentTask.id)
            syncUIState()
            // 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        syncUIState()
      }

      // 4. Mission 완료 결과 평가 및 최종 마크다운 보고서 생성
      const finalResultGrade = completionManager.evaluateMissionResult()
      const stats = completionManager.getSummaryStats()
      const finalReportText = FinalReporter.buildReport(
        userMessage,
        stats,
        completionManager.getCompletionRate(),
        finalResultGrade,
        this.currentTurn,
        0 // RecoveryCount
      )

      // 최종 상태 바인딩
      state.setFinalReport(finalReportText)
      this.emitPhaseChange('done')
      this.emitEvent({ type: 'final_answer', answer: finalReportText })

      return finalReportText
    } finally {
      this.cleanupRecovery()
    }
  }

  /**
   * 진행 중인 루프를 즉시 중단한다.
   */
  public async abort(): Promise<void> {
    this.isAborted = true
    await this.adapter.abort()
    this.emitPhaseChange('error')
    this.cleanupRecovery()
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

        // recovery 모니터링 연동
        const isToolCalling = this.parser.getState() as any === 'tool_calling'
        this.supervisor.onToken(token, this.parser.getAccumulatedThought() ?? '', isToolCalling)

        const criticVerdict = this.critic.evaluateThought(this.parser.getAccumulatedThought() ?? '')
        if (criticVerdict === 'stalled') {
          void RecoveryEngine.getInstance().handleStall('TOKEN_FREEZE', this.buildRecoveryBridge())
        }

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
       */
    }
  }

  /**
   * 에이전트 단계 변경 이벤트를 방출하고 내부 상태를 갱신한다.
   *
   * @param phase - 전환할 새로운 AgentPhase
   */
  private emitPhaseChange(phase: AgentPhase): void {
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

  private cleanupRecovery(): void {
    if (this.checkpointIntervalId) {
      clearInterval(this.checkpointIntervalId)
      this.checkpointIntervalId = null
    }
    this.supervisor.stopMonitoring()
    RecoveryEngine.getInstance().resetSession(this.sessionId)
    void CheckpointSystem.clearCheckpoint(this.sessionId)
  }

  private buildRecoveryBridge(): RecoveryOrchestratorBridge {
    return {
      sessionId: this.sessionId,
      abortCurrentStream: () => {
        void this.adapter.abort()
      },
      reconnectStream: async () => {
        try {
          await this.runSingleTurn()
          return true;
        } catch {
          return false;
        }
      },
      resetParser: () => {
        this.parser.reset()
        this.critic.reset()
      },
      rebuildStreamContext: async () => {
        try {
          const filtered = this.contextMessages.filter(m => m.role !== 'system')
          const systemPrompt = this.buildSystemPrompt()
          this.contextMessages = [
            { role: 'system', content: systemPrompt },
            ...filtered
          ]
          await this.runSingleTurn()
          return true;
        } catch {
          return false;
        }
      },
      resumeFromCheckpoint: async (checkpoint: RecoveryCheckpoint) => {
        try {
          this.contextMessages = checkpoint.contextMessages
          this.accumulatedAnswer = checkpoint.partialAnswer
          this.currentTurn = checkpoint.step
          if (checkpoint.toolState) {
            this.pendingToolCall = JSON.parse(checkpoint.toolState)
          }
          this.parser.reset()
          this.parser.feed(checkpoint.thought)

          // 신규 Task 리스트 및 큐 복원 연동
          if (checkpoint.tasks) {
            this.taskGraph = new TaskGraph(checkpoint.tasks)
            this.taskQueue = new TaskQueue(this.taskGraph)
            const { useAIState } = await import('../../../stores/useAIState')
            const state = useAIState.getState()
            const steps = checkpoint.tasks.map((t, idx) => ({
              id: idx + 1,
              description: t.title,
              status: t.status === 'COMPLETED' ? 'done' as const : 
                      t.status === 'RUNNING' ? 'in_progress' as const : 
                      t.status === 'FAILED' ? 'failed' as const : 'pending' as const
            }));
            state.setAgentTaskPlan({ goal: checkpoint.goal, steps, currentStepIndex: 0 });
            const finished = checkpoint.tasks.filter((t: any) => t.status === 'COMPLETED' || t.status === 'SKIPPED').length;
            const rate = checkpoint.tasks.length > 0 ? Math.round((finished / checkpoint.tasks.length) * 100) : 0;
            state.setTaskProgress(rate);
          }

          await this.runSingleTurn()
          return true;
        } catch {
          return false;
        }
      }
    }
  }

  /**
   * [PHASE 2 Integration Point]
   * 새로운 Planning Pipeline 을 구동하는 진입점.
   * AgentOrchestrator는 기존의 run()과는 별개로 이 진입점을 통해 Goal을 구조화하고
   * V2 플랜을 활성화할 수 있습니다.
   */
  public async planAndActivateV2(missionId: string, rawRequest: string): Promise<V2TaskPlan> {
    const interpreter = new GoalInterpreter(this.adapter);
    const planner = new V2TaskPlanner(this.adapter);
    const validator = new PlanValidator();
    const activationService = new PlanActivationService(this.taskStore);

    // 1. 목표 구조화
    const spec = await interpreter.interpret(missionId, rawRequest);

    // 2. Draft Plan 생성
    const draftPlan = await planner.createPlan(spec);

    // 3. Validation
    const valResult = validator.validate(draftPlan, spec);
    if (!valResult.valid) {
      this.emitEvent({ type: 'error', message: `Plan validation failed: ${valResult.errors.map(e => e.message).join(', ')}` } as any);
      throw new Error('Plan validation failed');
    }

    // 4. Activation
    draftPlan.status = 'APPROVED';
    activationService.activate(draftPlan);

    ipc.llmAddLog({ text: 'PHASE 2 Planning Pipeline activated successfully.', prefix: 'AgentOrchestrator' });
    return draftPlan;
  }
}
