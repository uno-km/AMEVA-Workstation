/**
 * @file orchestrator/task/types.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/task/types.ts
 * @role AMEVA 자율수행형 Task Runtime Engine 전용 데이터 모델 및 타입 선언
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskPlanner.ts, TaskGraph.ts, TaskQueue.ts, TaskExecutor.ts, TaskVerifier.ts, TaskCompletionManager.ts, FinalReporter.ts
 * - AgentOrchestrator.ts: 최상위 실행 루프의 Task 제어 시 타입 참조.
 * - useAIState.ts: Zustand 스토어 내 Task Plan 매핑 시 참조.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: 이 파일에서 함수 본문이나 클래스 등의 런타임 실행 로직을 정의하지 말 것.
 * - MUST: 모든 타입과 인터페이스는 명시적으로 export 해야 함.
 */

/**
 * TaskStatus
 * 개별 Task가 가질 수 있는 엄격한 상태 머신 상태값.
 * - 'PENDING': 선행 Task의 완료를 대기 중인 상태.
 * - 'READY': 모든 의존성이 해결되어 즉시 실행할 수 있는 상태.
 * - 'RUNNING': 현재 Executor가 해당 Task를 실행 중인 상태.
 * - 'COMPLETED': Verifier 검정을 완벽히 통과하여 완수된 상태.
 * - 'FAILED': 실행 실패 또는 Verifier 검정을 통과하지 못해 재시도 대기 상태.
 * - 'BLOCKED': 특정 오류나 하위 모듈 교착으로 인해 처리가 지연/차단된 상태.
 * - 'SKIPPED': 재시도 한계를 초과하여 복구 정책에 따라 강제 우회된 상태.
 * - 'USER_ASSIST': 복구가 최종 실패하여 사용자의 개입 및 수동 교정을 대기하는 락 상태.
 */
export type TaskStatus = 'PENDING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'SKIPPED' | 'USER_ASSIST';

/**
 * TaskResult
 * Task가 실행 완료된 후 Executor와 Verifier가 합성하여 생성하는 최종 산출 성적서.
 */
export interface TaskResult {
  /** 실행 및 검증 최종 판정 상태 */
  readonly status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'EXECUTED_PENDING_VERIFICATION';
  /** 생성된 실제 파일 경로 또는 본문 텍스트 결과물 */
  readonly artifact?: string;
  /** 태스크 수행 결과 요약 정보 */
  readonly summary: string;
  /** 완료를 보증하는 증거 데이터 (체크 값, API 응답 등) */
  readonly evidence: string;
  /** 태스크 기동부터 종료까지 소요된 총 밀리초 (ms) */
  readonly executionTime: number;
  /** 도구/텍스트 출력 목록 */
  readonly outputs?: any[];
  /** 선언된 출력 모드 */
  readonly declaredOutputMode?: any;
  /** 추론된 출력 모드 */
  readonly inferredOutputMode?: any;
  /** 추론된 파일 출력 경로 목록 */
  readonly inferredFileOutputs?: any;
}

/**
 * Task
 * Task Runtime Engine이 스케줄링하고 추적하는 개별 작업 노드 구조체.
 */
export interface Task {
  /** 고유 ID (예: 'task-1') */
  readonly id: string;
  /** 사용자 가독용 제목 */
  readonly title: string;
  /** 구체적인 작업 목표 설명 */
  readonly objective: string;
  /** 선행되어야 하는 선행 Task ID 목록 (DAG 관계 형성) */
  readonly dependencies: string[];
  /** 실행 우선순위 가중치 (기본값: 1) */
  readonly priority: number;
  /** 필수 여부 (기존엔 priority === 1 로 갈음했으나 명시적으로 추가) */
  readonly required?: boolean;
  /** 현재 태스크의 상태값 */
  status: TaskStatus;
  /** 완료 여부를 검증하기 위한 상세 가이드라인 */
  readonly expectedOutput: string;
  /** 현재까지의 실패 재시도 카운트 */
  retries: number;
  /** 허용된 최대 재시도 카운트 한도 */
  readonly maxRetries: number;
  /** Task 실행 결과 성적서 (완료/실패 시 매핑됨) */
  result?: TaskResult;
  /** 생성 시각 타임스탬프 (ms) */
  readonly createdAt: number;
  /** 완수 시각 타임스탬프 (ms) */
  completedAt?: number;
}

/**
 * TaskPlanRebuild
 * 기존 UI checklist의 호환성을 유지하기 위한 최상위 Task Plan 컨테이너.
 */
export interface TaskPlanRebuild {
  /** 최종 수행 목표 */
  readonly goal: string;
  /** 태스크 그래프 상의 모든 태스크 리스트 */
  readonly tasks: Task[];
  /** 최종 임무 요약 보고서 마크다운 (완료 시 작성됨) */
  finalReport?: string;
}
