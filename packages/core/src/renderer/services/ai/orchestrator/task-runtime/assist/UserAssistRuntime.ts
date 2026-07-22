/**
 * @file orchestrator/task-runtime/assist/UserAssistRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role 자동 Recovery 불가 시 UserAssistRequest를 생성하고 사용자 응답을 Runtime Command로 변환
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionExecutionRuntime: WAITING_USER 상태 전환 시 호출
 * - UI Layer: UserAssistRequest 목록 구독 (읽기 전용)
 *
 * [STAGE G — User Assist Runtime 및 UI]
 *
 * [설계 원칙]
 * - UI는 Runtime 상태를 직접 수정하지 않는다 → respondToRequest() 호출만 가능
 * - 중복 응답 차단 (idempotencyKey)
 * - 만료된 Request 거부
 * - 필수 Task에 SKIP 옵션 차단
 * - Request 처리 후 Scheduler가 재개할 수 있도록 store에 전이
 *
 * [False Success 방지]
 * - 사용자 응답 없이 UserAssist가 SUCCESS를 선언하지 않음
 * - 사용자가 CANCEL을 선택하지 않는 한 자동 취소 없음
 */

import type { TaskRuntimeStore } from '../store/TaskRuntimeStore';

/**
 * 사용자에게 제공되는 선택 옵션.
 */
export type UserAssistOption =
  | 'RESUME_FROM_CHECKPOINT'
  | 'RETRY_SAME_STRATEGY'
  | 'RETRY_DIFFERENT_STRATEGY'
  | 'PROVIDE_ADDITIONAL_INPUT'
  | 'GRANT_PERMISSION'
  | 'USE_PARTIAL_RESULT'
  | 'SKIP_OPTIONAL_TASK'
  | 'CANCEL_MISSION'
  | 'ACCEPT_PROPOSED_PLAN'
  | 'DISAGREE_AND_REPLAN';

/**
 * User Assist Request.
 * WAITING_USER 상태로 전환 시 생성됨.
 */
export interface UserAssistRequest {
  requestId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  /** 요약 제목 */
  title: string;
  /** 현재 상황 설명 */
  summary: string;
  /** 실패 원인 */
  failureReason: string;
  /** 현재까지 완료된 작업 내용 */
  completedWork: string;
  /** 누락된 작업 내용 */
  missingWork: string;
  /** 사용 가능한 Checkpoint ID */
  availableCheckpointId?: string;
  /** 지금까지 자동 복구 시도 횟수 */
  recoveryAttempts: number;
  /** 제공 가능한 옵션 */
  options: UserAssistOption[];
  /** LLM이 제안하는 복구 계획 (있는 경우) */
  proposedPlan?: { analysis: string; proposedAction: string };
  /** 권장 옵션 */
  recommendedOption: UserAssistOption;
  /** 필수 응답 여부 */
  required: boolean;
  /** 생성 시각 */
  createdAt: number;
  /** 만료 시각 (24시간 기본) */
  expiresAt: number;
  /** 멱등성 키 (중복 응답 차단) */
  idempotencyKey: string;
  /** 현재 상태 */
  status: 'PENDING' | 'RESPONDED' | 'RESOLVED' | 'EXPIRED';
}

/**
 * 사용자 응답.
 */
export interface UserAssistResponse {
  requestId: string;
  selectedOption: UserAssistOption;
  additionalInput?: string;
  respondedAt: number;
}

/*
 * [도메인 종속 지역 상수]
 */
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간

export class UserAssistRuntime {
  private readonly requests: Map<string, UserAssistRequest> = new Map();
  private readonly respondedIdempotencyKeys: Set<string> = new Set();
  
  private readonly store: TaskRuntimeStore;

  constructor(store: TaskRuntimeStore) {
    this.store = store;
  }

  /**
   * UserAssistRequest를 생성하고 Task를 WAITING_USER 상태로 전환한다.
   */
  public createRequest(params: {
    missionId: string;
    taskId: string;
    attemptId: string;
    title: string;
    summary: string;
    failureReason: string;
    completedWork: string;
    missingWork: string;
    availableCheckpointId?: string;
    recoveryAttempts: number;
    proposedPlan?: { analysis: string; proposedAction: string };
    isTaskRequired: boolean;
  }): UserAssistRequest {
    const idempotencyKey = `ua-${params.taskId}-${params.attemptId}`;

    // 멱등성 검사: 동일 idempotencyKey의 PENDING Request가 있으면 반환
    const existing = Array.from(this.requests.values()).find(
      r => r.idempotencyKey === idempotencyKey && r.status === 'PENDING'
    );
    if (existing) {
      return existing;
    }

    const requestId = `ua-${crypto.randomUUID()}`;
    const now = Date.now();

    // 필수 Task는 SKIP 옵션 제공 안 함
    const options: UserAssistOption[] = [
      'RESUME_FROM_CHECKPOINT',
      'RETRY_SAME_STRATEGY',
      'RETRY_DIFFERENT_STRATEGY',
      'PROVIDE_ADDITIONAL_INPUT',
      'GRANT_PERMISSION',
    ];
    if (!params.isTaskRequired) {
      options.push('USE_PARTIAL_RESULT', 'SKIP_OPTIONAL_TASK');
    }
    options.push('CANCEL_MISSION');

    const request: UserAssistRequest = {
      requestId,
      missionId: params.missionId,
      taskId: params.taskId,
      attemptId: params.attemptId,
      title: params.title,
      summary: params.summary,
      failureReason: params.failureReason,
      completedWork: params.completedWork,
      missingWork: params.missingWork,
      availableCheckpointId: params.availableCheckpointId,
      recoveryAttempts: params.recoveryAttempts,
      proposedPlan: params.proposedPlan,
      options,
      recommendedOption: params.proposedPlan ? 'ACCEPT_PROPOSED_PLAN' : (params.availableCheckpointId ? 'RESUME_FROM_CHECKPOINT' : 'RETRY_SAME_STRATEGY'),
      required: params.isTaskRequired,
      createdAt: now,
      expiresAt: now + DEFAULT_EXPIRY_MS,
      idempotencyKey: `ua-${params.taskId}-${params.attemptId}`,
      status: 'PENDING'
    };

    this.requests.set(requestId, request);

    // Task를 WAITING_USER 상태로 전환
    try {
      const task = this.store.getTask(params.missionId, params.taskId);
      this.store.dispatchTransition(
        {
          commandId: `cmd-ua-${crypto.randomUUID()}`,
          missionId: params.missionId,
          taskId: params.taskId,
          expectedCurrentStatus: task.state.status,
          expectedStateVersion: task.state.stateVersion,
          reason: `User assistance required: ${params.failureReason.slice(0, 100)}`,
          actor: 'UserAssistRuntime',
          timestamp: now
        },
        'WAITING_USER'
      );
    } catch (transitionErr: unknown) {
      const msg = transitionErr instanceof Error ? transitionErr.message : String(transitionErr);
      console.warn(`[UserAssistRuntime] WAITING_USER 전이 실패 (이미 해당 상태일 수 있음):`, msg);
    }

    return request;
  }

  /**
   * 사용자 응답을 처리하고 Runtime Command를 실행한다.
   *
   * [Idempotency]
   * 동일 idempotencyKey에 대한 중복 응답을 차단한다.
   */
  public respondToRequest(response: UserAssistResponse): { success: boolean; message: string } {
    const request = this.requests.get(response.requestId);

    if (!request) {
      return { success: false, message: `Request ${response.requestId} not found.` };
    }

    // 만료 확인
    if (Date.now() > request.expiresAt) {
      request.status = 'EXPIRED';
      return { success: false, message: `Request ${response.requestId} has expired.` };
    }

    // 중복 응답 차단
    if (this.respondedIdempotencyKeys.has(request.idempotencyKey)) {
      return { success: false, message: `Duplicate response for ${request.idempotencyKey}.` };
    }

    // 필수 Task에 SKIP 시도 차단
    if (request.required && response.selectedOption === 'SKIP_OPTIONAL_TASK') {
      return { success: false, message: `Cannot skip required task ${request.taskId}.` };
    }

    // 중복 방지 등록
    this.respondedIdempotencyKeys.add(request.idempotencyKey);
    request.status = 'RESPONDED';

    // 옵션에 따른 Runtime 전이
    this.executeResponseCommand(request, response);

    return { success: true, message: `Response '${response.selectedOption}' accepted for request ${response.requestId}.` };
  }

  /**
   * 사용자 응답 옵션을 Runtime 상태 전이로 변환한다.
   */
  private executeResponseCommand(request: UserAssistRequest, response: UserAssistResponse): void {
    const task = this.store.getTask(request.missionId, request.taskId);
    const now = Date.now();

    const baseCommand = {
      commandId: `cmd-ua-resp-${crypto.randomUUID()}`,
      missionId: request.missionId,
      taskId: request.taskId,
      attemptId: request.attemptId,
      expectedCurrentStatus: 'WAITING_USER' as const,
      expectedStateVersion: task.state.stateVersion,
      actor: 'UserAssistRuntime',
      timestamp: now
    };

    switch (response.selectedOption) {
      case 'RESUME_FROM_CHECKPOINT':
      case 'RETRY_SAME_STRATEGY':
      case 'RETRY_DIFFERENT_STRATEGY':
      case 'PROVIDE_ADDITIONAL_INPUT':
      case 'GRANT_PERMISSION':
      case 'ACCEPT_PROPOSED_PLAN':
      case 'DISAGREE_AND_REPLAN':
        // WAITING_USER → READY (Scheduler가 처리)
        this.store.dispatchTransition(
          { ...baseCommand, reason: `User selected: ${response.selectedOption}` },
          'READY'
        );
        request.status = 'RESOLVED';
        break;

      case 'USE_PARTIAL_RESULT':
        // WAITING_USER → READY (부분 결과로 VERIFYING 진입)
        this.store.dispatchTransition(
          { ...baseCommand, reason: `User accepted partial result.` },
          'READY'
        );
        request.status = 'RESOLVED';
        break;

      case 'SKIP_OPTIONAL_TASK':
        // WAITING_USER → SKIPPED (필수 Task는 이미 위에서 차단됨)
        this.store.dispatchTransition(
          { ...baseCommand, reason: `User skipped optional task.` },
          'SKIPPED'
        );
        request.status = 'RESOLVED';
        break;

      case 'CANCEL_MISSION':
        // WAITING_USER → CANCELLED
        this.store.dispatchTransition(
          { ...baseCommand, reason: `User cancelled mission.` },
          'CANCELLED'
        );
        request.status = 'RESOLVED';
        break;

      default:
        console.error(`[UserAssistRuntime] 알 수 없는 옵션: ${response.selectedOption}`);
        break;
    }
  }

  /**
   * 특정 Task의 PENDING 상태 Request를 반환한다.
   */
  public getPendingRequest(taskId: string): UserAssistRequest | null {
    for (const request of this.requests.values()) {
      if (request.taskId === taskId && request.status === 'PENDING') {
        return request;
      }
    }
    return null;
  }

  /**
   * 모든 Request 목록을 반환한다 (UI 표시용).
   */
  public getAllRequests(): UserAssistRequest[] {
    return [...this.requests.values()];
  }

  /**
   * Mission 종료 시 정리.
   */
  public dispose(): void {
    this.requests.clear();
    this.respondedIdempotencyKeys.clear();
  }
}
