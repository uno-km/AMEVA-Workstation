/**
 * @file orchestrator/critic/index.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/critic/index.ts
 * @role Actor-Critic 검증 훅 모듈 공개 배럴 파일
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: ActorCriticHookFactory.createDefault() 를 통해 인스턴스 생성.
 * - runDeepReasoningMode (useAIAgentMode.ts): 필요 시 직접 주입.
 */

export type {
  CriticPayload,
  CriticToolCallPayload,
  CriticFinalAnswerPayload,
  CriticVerdict,
  CriticPassVerdict,
  CriticRejectVerdict,
  CriticContext,
  IActorCriticHook,
  IFeedbackInjector,
  ICriticStrategy,
  ActorCriticConfig
} from './types'

export { LLMCriticStrategy } from './LLMCriticStrategy'
export { FeedbackInjector } from './FeedbackInjector'
export { ActorCriticHook, ActorCriticHookFactory } from './ActorCriticHook'
