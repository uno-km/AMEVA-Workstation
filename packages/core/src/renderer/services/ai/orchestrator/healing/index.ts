/**
 * @file orchestrator/healing/index.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/healing/index.ts
 * @role Self-Healing 파이프라인 모듈 공개 배럴 파일
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: SelfHealingMiddlewareFactory.createDefault() 를 통해 인스턴스 생성.
 * - runDeepReasoningMode (useAIAgentMode.ts): 필요 시 직접 주입.
 */

export type {
  HealingResult,
  HealingContext,
  HealingSuccessResult,
  HealingFailureResult,
  IJsonHealingStrategy,
  ILLMHealingDelegate,
  ISelfHealingMiddleware,
  SelfHealingConfig
} from './types'

export { HeuristicHealingStrategy } from './HeuristicHealingStrategy'
export { LLMHealingDelegate } from './LLMHealingDelegate'
export { SelfHealingMiddleware, SelfHealingMiddlewareFactory } from './SelfHealingMiddleware'
