/**
 * @file orchestrator/types.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/types.ts
 * @role ReAct 오케스트레이터 전용 타입 정의 모듈
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - LLMEngineAdapter.ts: 엔진 어댑터 인터페이스 구현 시 소비.
 * - ThoughtParser.ts: 파서 이벤트 콜백 타입 소비.
 * - ToolRegistry.ts: 도구 정의 및 실행 결과 타입 소비.
 * - AgentOrchestrator.ts: 루프 전체 상태 타입 소비.
 * - useAIAgentMode.ts: 훅 파라미터 및 반환 타입 소비.
 * - AgentThoughtBubble.tsx: UI 렌더링 상태 타입 소비.
 * - AgentTaskChecklist.tsx: 태스크 플랜 렌더링 타입 소비.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - 오케스트레이터 도메인 내에서만 사용되는 타입을 중앙 집중 정의한다.
 * - 글로벌 aiTypes.ts를 오염시키지 않고 독립적으로 격리한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: 이 파일에서 런타임 로직(함수 본문, 클래스 인스턴스)을 정의하지 말 것.
 * - MUST: 모든 타입은 명시적으로 export 해야 함.
 */

/* ============================================================
 * 1. 에이전트 상태 머신 단계 (State Machine Phase)
 * ============================================================ */

/**
 * AgentPhase
 * ReAct 루프의 현재 실행 단계를 나타내는 리터럴 유니언 타입.
 *
 * - 'idle'        : 루프 미시작 대기 상태.
 * - 'thinking'    : 모델이 <thought> 태그 내 혼잣말을 출력하는 단계.
 * - 'tool_calling': <tool_call> 태그가 감지되어 도구 실행 대기/실행 중인 단계.
 * - 'observing'   : 도구 실행 결과(Observation)를 컨텍스트에 주입하는 단계.
 * - 'answering'   : 모델이 최종 답변 텍스트를 스트리밍하는 단계.
 * - 'done'        : 루프가 정상 종료된 상태.
 * - 'error'       : 예외 발생으로 루프가 비정상 종료된 상태.
 */
export type AgentPhase =
  | 'idle'
  | 'thinking'
  | 'tool_calling'
  | 'observing'
  | 'answering'
  | 'done'
  | 'error'

/* ============================================================
 * 2. 도구 호출 관련 타입 (Tool Call Types)
 * ============================================================ */

/**
 * ToolCallRequest
 * ThoughtParser가 모델 출력에서 감지한 도구 호출 요청 구조체.
 * 모델이 출력하는 JSON 포맷: { "name": "run_command", "args": { "cmd": "dir" } }
 */
export interface ToolCallRequest {
  /** 실행할 도구의 등록 명칭. ToolRegistry에 등록된 name과 일치해야 함. */
  name: string
  /** 도구에 전달할 인자 객체. 도구 정의의 parameters 스키마를 따름. */
  args: Record<string, unknown>
}

/**
 * ToolCallResult
 * ToolRegistry.executeTool() 실행 후 반환되는 결과 구조체.
 */
export interface ToolCallResult {
  /** 도구 실행 성공 여부 */
  success: boolean
  /** 성공 시 반환된 결과 텍스트 */
  result?: string
  /** 실패 시 에러 메시지 */
  error?: string
  /** 실행된 도구 명칭 (로깅용) */
  toolName: string
  /** 실행된 인자 (로깅용) */
  toolArgs: Record<string, unknown>

  // [Phase 2.2] Artifact 반환 계약
  artifactId?: string
  missionId?: string
  taskId?: string
  attemptId?: string
  outputId?: string
  expectedPath?: string
  normalizedStagedPath?: string
  size?: number
  contentHash?: string
  revision?: number
  idempotencyKey?: string
}

/* ============================================================
 * 3. 태스크 플랜 관련 타입 (Task Plan Types)
 * ============================================================ */

/**
 * TaskStepStatus
 * 체크리스트 각 단계의 상태.
 */
export type TaskStepStatus = 'pending' | 'in_progress' | 'done' | 'failed'

/**
 * TaskStep
 * 에이전트가 복잡한 요청을 처리하기 위해 수립한 단계적 계획의 개별 항목.
 * 모델이 최초 출력하는 JSON Plan: [{ "id": 1, "description": "..." }]
 */
export interface TaskStep {
  /** 순서 인덱스 (1부터 시작) */
  id: number
  /** 단계 설명 텍스트 */
  description: string
  /** 현재 실행 상태 */
  status: TaskStepStatus
}

/**
 * TaskPlan
 * 전체 태스크 플랜 컨테이너.
 */
export interface TaskPlan {
  /** 전체 목표 설명 */
  goal: string
  /** 단계 목록 */
  steps: TaskStep[]
  /** 현재 진행 중인 단계 인덱스 */
  currentStepIndex: number
}

/* ============================================================
 * 4. 오케스트레이터 이벤트 (Orchestrator Events)
 * ============================================================ */

/**
 * OrchestratorEventType
 * AgentOrchestrator가 상위 계층(Hook/UI)으로 방출하는 이벤트 종류.
 */
export type OrchestratorEventType =
  | 'phase_change'       // AgentPhase 전환
  | 'thought_token'      // 혼잣말 토큰 스트리밍
  | 'answer_token'       // 최종 답변 토큰 스트리밍
  | 'tool_call_start'    // 도구 실행 시작
  | 'tool_call_end'      // 도구 실행 완료
  | 'task_plan'          // Task Plan JSON 파싱 완료
  | 'task_step_update'   // 체크리스트 단계 상태 변경
  | 'final_answer'       // 최종 답변 확정
  | 'error'              // 루프 에러 발생
  | 'plan_approval_request' // 플랜 승인 대기
  | 'critic_feedback'    // 비평가 피드백
  | 'task_exec_start'    // 태스크 실행 시작

/**
 * OrchestratorEvent
 * UI 계층이 구독하는 이벤트 페이로드 유니언 타입.
 * 각 이벤트 종류에 따라 payload 구조가 달라진다.
 */
export type OrchestratorEvent =
  | { type: 'phase_change'; phase: AgentPhase }
  | { type: 'thought_token'; token: string; accumulated: string; taskTitle?: string }
  | { type: 'answer_token'; token: string; accumulated: string }
  | { type: 'tool_call_start'; toolName: string; toolArgs: Record<string, unknown> }
  | { type: 'tool_call_end'; result: ToolCallResult }
  | { type: 'task_plan'; plan: TaskPlan }
  | { type: 'task_step_update'; stepId: number; status: TaskStepStatus }
  | { type: 'final_answer'; answer: string }
  | { type: 'error'; message: string }
  | { type: 'plan_approval_request'; plan: { goal: string; steps: TaskStep[] } }
  | { type: 'critic_feedback'; verdict: 'PASS' | 'FAIL'; reason: string; taskTitle: string }
  | { type: 'task_exec_start'; taskTitle: string; attempt: number }

/**
 * OrchestratorEventCallback
 * 이벤트 구독 콜백 함수 시그니처.
 */
export type OrchestratorEventCallback = (event: OrchestratorEvent) => void

/* ============================================================
 * 5. 오케스트레이터 설정 (Orchestrator Config)
 * ============================================================ */

/**
 * OrchestratorConfig
 * AgentOrchestrator 인스턴스를 생성할 때 주입하는 설정 구조체.
 * 사용자가 Settings 화면에서 조절한 값이 이 구조체를 통해 오케스트레이터에 주입된다.
 */
export interface OrchestratorConfig {
  /**
   * 최대 ReAct 반복 턴 수.
   * - 예상 값: 1 ~ 10000 (사용자 설정 가능).
   * - 기본값: 10000 (사실상 무제한, 컨텍스트 풀 가드레일이 우선 적용).
   */
  maxTurns: number

  /**
   * 에이전트 컨텍스트 풀 최대 토큰 수.
   * - 7B 모델(Qwen2.5-7B) 기준 최대 컨텍스트: 32,768 토큰.
   * - 예상 값: 4096 ~ 131072 (사용자 설정 가능).
   * - 기본값: 32768 (Qwen2.5-7B 최대 컨텍스트).
   */
  contextPoolMaxTokens: number

  /**
   * 사용할 LLM 엔진 타입.
   * - AISettings.apiType에서 전달받아 어댑터 팩토리가 분기 결정에 사용.
   */
  engineType: 'local' | 'ollama' | 'wasm' | 'api'

  /**
   * 로컬 엔진 엔드포인트 URL (Ollama/Llama.cpp 전용).
   * - 예: 'http://localhost:11434' (Ollama), 'http://localhost:12345' (Llama.cpp).
   */
  endpointUrl?: string

  /**
   * 추론에 사용할 모델 경로 또는 식별자.
   * - local: '/path/to/model.gguf'
   * - ollama: 'qwen2.5:7b'
   * - wasm: 'Qwen2.5-7B-Instruct-q4f16_1-MLC'
   */
  modelId: string

  /**
   * 생성 온도 (창의성 파라미터).
   * - 예상 값: 0.0 ~ 2.0.
   * - 에이전트 추론 시 낮은 값(0.1~0.3) 권장.
   */
  temperature: number
}

/* ============================================================
 * 6. 엔진 어댑터 인터페이스 (Engine Adapter Interface)
 * ============================================================ */

/**
 * ILLMEngineAdapter
 * 모든 LLM 엔진(WebLLM, Ollama, Llama.cpp)이 구현해야 하는 추상 계약 인터페이스.
 * 오케스트레이터는 이 인터페이스만을 통해 엔진과 통신한다.
 */
export interface ILLMEngineAdapter {
  /**
   * 지정된 모델을 메모리(VRAM/RAM)에 적재한다.
   * - 이미 동일 모델이 적재된 경우: 즉시 반환 (재로딩 불필요).
   * - 다른 모델이 적재된 경우: 기존 모델 언로드 후 신규 적재.
   */
  loadModel(modelId: string): Promise<void>

  /**
   * 현재 적재된 모델을 메모리에서 해제한다.
   * VRAM 절약을 위한 턴제 스와핑 시 사용.
   */
  unloadModel(): Promise<void>

  /**
   * 메시지 배열을 받아 스트리밍 추론을 수행한다.
   *
   * @param messages - [{ role: 'system'|'user'|'assistant', content: string }] 형태의 대화 히스토리
   * @param onToken - 각 토큰이 생성될 때마다 호출되는 실시간 콜백
   * @returns 생성 완료된 전체 텍스트
   */
  generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string>

  /**
   * 진행 중인 스트리밍 생성을 즉시 중단한다.
   */
  abort(): Promise<void>

  /**
   * 현재 엔진이 사용 가능한 상태인지 확인한다.
   */
  isReady(): boolean
}

/* ============================================================
 * 7. 도구 정의 인터페이스 (Tool Definition Interface)
 * ============================================================ */

/**
 * ToolDefinition
 * ToolRegistry에 등록 가능한 도구의 명세 인터페이스.
 * 기존 AgentEngine의 RegisteredTool과 동일한 계약을 유지한다.
 */
export interface ToolDefinition {
  /** 도구 고유 명칭. 모델 프롬프트의 <tool_call> name 필드와 일치해야 함. */
  name: string
  /** 도구 기능 설명. 모델이 도구 선택 시 참조하는 설명문. */
  description: string
  /** JSON Schema 형태의 인자 구조 명세. */
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  /** 실제 도구 실행 함수. args를 받아 비동기로 결과를 반환한다. */
  execute: (args: Record<string, unknown>, context?: { 
    missionId?: string; 
    taskId?: string; 
    attemptId?: string;
    artifactId?: string;
    expectedOutput?: string;
    idempotencyKey?: string;
  }) => Promise<ToolCallResult>
}
