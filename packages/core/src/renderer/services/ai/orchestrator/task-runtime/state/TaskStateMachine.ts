/**
 * @file orchestrator/task-runtime/state/TaskStateMachine.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task의 상태 전이 규칙과 불변성 검사를 담당하는 State Machine
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - TaskRuntimeStore.ts: 런타임 저장소에서 상태 업데이트 시 경유
 */

import {
  TaskStatus,
  TaskEntity,
  TransitionCommand,
  TaskRuntimeState
} from '../domain/types';
import {
  InvalidTransitionError,
  StaleStateError,
  MissingVerificationError
} from '../domain/errors';

export class TaskStateMachine {
  /**
   * 허용된 상태 전이 매핑 (from -> to[])
   * 명시되지 않은 경로는 불법(Illegal)으로 간주합니다.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    PENDING: ['READY', 'BLOCKED', 'CANCELLED'],
    READY: ['RUNNING', 'BLOCKED', 'CANCELLED'],
    RUNNING: ['VERIFYING', 'RETRY_WAIT', 'FAILED', 'WAITING_USER', 'CANCELLED'],
    VERIFYING: ['COMPLETED', 'RETRY_WAIT', 'FAILED', 'BLOCKED', 'WAITING_USER', 'CANCELLED'],
    RETRY_WAIT: ['READY', 'FAILED', 'WAITING_USER', 'CANCELLED'],
    BLOCKED: ['PENDING', 'READY', 'FAILED', 'WAITING_USER', 'CANCELLED'],
    WAITING_USER: ['READY', 'FAILED', 'CANCELLED'],
    FAILED: ['READY', 'SKIPPED', 'CANCELLED'],
    // 최종 상태들
    COMPLETED: [],
    SKIPPED: [],
    CANCELLED: []
  };

  /**
   * 상태 전이의 유효성을 검사합니다.
   */
  public static canTransition(from: TaskStatus, to: TaskStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * TransitionCommand를 기반으로 TaskEntity의 다음 상태를 반환합니다.
   * 모든 불변(Invariant) 조건을 검증하고 실패 시 Error를 던집니다. (순수 함수 지향)
   *
   * @param entity 기존의 태스크 엔티티
   * @param targetStatus 이동하고자 하는 목적 상태
   * @param command 전이를 지시하는 커맨드 객체
   * @param partialUpdates 상태 변경 시 함께 업데이트할 부가 데이터 (예: verification, failure 등)
   */
  public static transition(
    entity: TaskEntity,
    targetStatus: TaskStatus,
    command: TransitionCommand,
    partialUpdates: Partial<TaskRuntimeState> = {}
  ): TaskEntity {
    const currentState = entity.state.status;
    const currentVersion = entity.state.stateVersion;

    // [Invariant 10] 낙관적 락 검증: 오래된 stateVersion 거부
    if (currentVersion !== command.expectedStateVersion) {
      throw new StaleStateError(
        `State version mismatch for Task ${entity.definition.id}. Expected ${command.expectedStateVersion}, but got ${currentVersion}.`
      );
    }

    // [Invariant] 현재 상태 불일치 검증
    if (currentState !== command.expectedCurrentStatus) {
      throw new InvalidTransitionError(
        `Status mismatch. Expected ${command.expectedCurrentStatus}, but got ${currentState}.`
      );
    }

    // [Invariant] 상태 전이 규칙 (Allowed Path) 검사
    if (!this.canTransition(currentState, targetStatus)) {
      throw new InvalidTransitionError(
        `Illegal transition from ${currentState} to ${targetStatus}`
      );
    }

    // [Invariant 2 & 13] COMPLETED 전이 특별 제약조건
    if (targetStatus === 'COMPLETED') {
      const verif = partialUpdates.verification || entity.state.verification;
      const result = partialUpdates.taskResult || entity.state.taskResult;
      const activeAttemptId = partialUpdates.activeAttemptId || entity.state.activeAttemptId;

      if (!activeAttemptId) {
        throw new InvalidTransitionError('Cannot transition to COMPLETED: activeAttemptId is missing.');
      }
      if (!result) {
        throw new InvalidTransitionError('Cannot transition to COMPLETED: TaskResult is missing.');
      }
      if (!verif) {
        throw new MissingVerificationError('Cannot transition to COMPLETED: Verification is missing.');
      }
      if (verif.verdict !== 'PASS') {
        throw new InvalidTransitionError('Cannot transition to COMPLETED: Verification verdict must be PASS.');
      }
      if (result.taskId !== entity.definition.id || verif.taskId !== entity.definition.id) {
        throw new InvalidTransitionError('Cannot transition to COMPLETED: taskId mismatch in result or verification.');
      }
      if (result.attemptId !== activeAttemptId || verif.attemptId !== activeAttemptId) {
        throw new InvalidTransitionError('Cannot transition to COMPLETED: attemptId mismatch between result, verification, and activeAttemptId.');
      }
    }

    // [Invariant] RUNNING 전이 제약조건 (Attempt 활성화 보장)
    if (targetStatus === 'RUNNING') {
      const activeAttemptId = partialUpdates.activeAttemptId || entity.state.activeAttemptId;
      if (!activeAttemptId) {
        throw new InvalidTransitionError('Cannot transition to RUNNING: activeAttemptId is required to start a task.');
      }
      const attempts = { ...entity.state.attempts, ...partialUpdates.attempts };
      if (!attempts[activeAttemptId]) {
        throw new InvalidTransitionError(`Cannot transition to RUNNING: Attempt ${activeAttemptId} is not registered.`);
      }
    }

    // [Invariant 6] FAILED 전이 시 실패 원인 누락 검사
    if (targetStatus === 'FAILED') {
      const failure = partialUpdates.lastFailure || entity.state.lastFailure;
      if (!failure) {
        throw new InvalidTransitionError('Cannot transition to FAILED without a valid lastFailure object.');
      }
    }

    // [Invariant 5] BLOCKED 전이 시 원인 누락 검사
    if (targetStatus === 'BLOCKED') {
      const reason = partialUpdates.blockReason || entity.state.blockReason;
      if (!reason) {
        throw new InvalidTransitionError('Cannot transition to BLOCKED without a blockReason.');
      }
    }

    // 상태 적용 및 버전 증가
    const newState: TaskRuntimeState = {
      ...entity.state,
      ...partialUpdates,
      attempts: { ...entity.state.attempts, ...(partialUpdates.attempts || {}) },
      status: targetStatus,
      stateVersion: currentVersion + 1,
    };

    // 완료 시간 기록
    if (targetStatus === 'COMPLETED' || targetStatus === 'SKIPPED' || targetStatus === 'CANCELLED') {
      if (!newState.completedAt) {
        newState.completedAt = command.timestamp;
      }
    }

    return {
      definition: entity.definition,
      state: newState
    };
  }
}
