/**
 * @file orchestrator/recovery/types.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/types.ts
 * @role Recovery-First 아키텍처 전용 타입 선언 파일
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - useAIState.ts: 스토어 내 복구 상태 타이핑에 사용.
 * - SupervisorAgent.ts, RecoveryEngine.ts, CheckpointSystem.ts 등 복구 패키지 내 전 영역에서 데이터 계약으로 소비.
 */

/**
 * RecoveryState
 * 에이전트의 현재 회복/정체 상태.
 * - 'normal': 정상 추론 수행 중.
 * - 'suspicious': 10초 이상 정체 감지 (주의).
 * - 'stalled': 20초 이상 정체 감지 (정체).
 * - 'recovering': 복구 로직 기동 및 회복 시도 중.
 * - 'recovery_failed': 자동 복구 사다리 시도가 최종 실패함 (수동 대기).
 */
export type RecoveryState = 'normal' | 'suspicious' | 'stalled' | 'recovering' | 'recovery_failed';

/**
 * RecoveryReason
 * 에이전트 정체/장애 귀책 사유 진단 타입.
 */
export type RecoveryReason =
  | 'STREAM_STALL'        // HTTP 커넥션은 살아있으나 토큰이 10초 이상 공급되지 않음
  | 'TOKEN_FREEZE'        // 토큰이 고정되거나 출력이 멈춤
  | 'PARSER_DEADLOCK'      // ThoughtParser의 내부 태그가 매칭 중 갇힘
  | 'PROMISE_DEADLOCK'     // fetch reader가 pending 상태로 교착
  | 'UI_DEADLOCK'          // 렌더러 IPC 또는 React 렌더링 동기화 마비
  | 'LLAMA_UNRESPONSIVE'   // Llama.cpp /health 응답 지연 또는 프로세스 크래시
  | 'MODEL_OVERLOADED'     // 모델 토큰 한도 초과 또는 GPU 연산 과부하
  | 'UNKNOWN';

/**
 * InferencePhase
 * 에이전트의 진행 단계 추정값.
 * - 'Planning': Task Plan 수립 또는 초기화 단계
 * - 'Reasoning': CoT 사고 과정 (<thought> 태그) 전개 단계
 * - 'Drafting': 에디터 패치 및 도구 실행, 본문 텍스트 생성 단계
 * - 'Finalizing': 최종 답변 완성 및 정리 단계
 */
export type InferencePhase = 'Planning' | 'Reasoning' | 'Drafting' | 'Finalizing';

/**
 * LlamaServerStatus
 * Llama.cpp 백엔드 프로세스의 감서 진단 상태.
 */
export type LlamaServerStatus = 'Alive' | 'Busy' | 'Overloaded' | 'Hung' | 'Dead';

/**
 * RecoveryCheckpoint
 * 자가회복을 위해 5초 주기로 스냅샷 저장되는 체크포인트 모델.
 */
export interface RecoveryCheckpoint {
  goal: string;
  thought: string;
  partialAnswer: string;
  toolState: string;
  step: number;
  timestamp: number;
  contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /** 태스크 런타임용 Task 목록 저장 */
  tasks?: any[];
}

/**
 * FailureEvent
 * FailureMemory에 기록되는 정체/실패 로그 모델.
 */
export interface FailureEvent {
  timestamp: number;
  sessionId: string;
  reason: RecoveryReason;
  details: string;
  actionTaken: string;
  success: boolean;
}
