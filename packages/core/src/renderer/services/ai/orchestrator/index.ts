/**
 * @file orchestrator/index.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/index.ts
 * @role 오케스트레이터 모듈 공개 배럴 파일 (Public API Gate)
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - useAIAgentMode.ts: AgentOrchestratorSession 임포트 시 이 배럴을 통해 접근 가능.
 * - 외부 모듈은 반드시 이 파일을 통해 오케스트레이터 심볼을 임포트해야 한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 내부 구현 세부사항(ThoughtParser, 어댑터 클래스 내부 등)을 직접 노출하지 말 것.
 * - MUST: 공개 API만 re-export하여 캡슐화를 유지할 것.
 */

/*
 * [PUBLIC API EXPORTS]
 * - AgentOrchestratorSession: ReAct 루프 세션 공개 클래스.
 * - 타입 전용 exports: 외부에서 타입 추론에 사용.
 */
export { AgentOrchestratorSession } from './AgentOrchestrator'
export type {
  OrchestratorConfig,
  OrchestratorEvent,
  OrchestratorEventCallback,
  AgentPhase,
  ToolCallRequest,
  ToolCallResult,
  ToolDefinition,
  TaskStep,
  TaskStepStatus,
  TaskPlan
} from './types'

/*
 * [REGISTRY PUBLIC EXPORT]
 * - ToolRegistry: 외부에서 커스텀 도구를 등록하고 싶을 때 사용.
 */
export { ToolRegistry } from './ToolRegistry'
