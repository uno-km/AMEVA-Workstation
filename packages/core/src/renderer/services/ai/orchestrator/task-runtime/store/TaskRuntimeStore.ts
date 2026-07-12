/**
 * @file orchestrator/task-runtime/store/TaskRuntimeStore.ts
 * @system AMEVA OS Desktop Workstation
 * @role 순수 TypeScript Core Task Runtime 저장소. (단일 진실 공급원)
 * 
 * [설명]
 * - React나 Zustand에 의존하지 않고 오직 도메인 객체들만 보관 및 갱신합니다.
 * - StateMachine을 통한 전이만 허용합니다.
 */

import type { TaskEntity, TransitionCommand, TaskRuntimeState, TaskEvent } from '../domain/types';
import type { MissionExecutionState } from '../domain/ExecutionTypes';
import { TaskNotFoundError } from '../domain/errors';
import { TaskStateMachine } from '../state/TaskStateMachine';
import { TaskEventLog } from '../events/TaskEventLog';

export class TaskRuntimeStore {
  // missionId -> (taskId -> TaskEntity)
  private missions: Map<string, Map<string, TaskEntity>> = new Map();
  // missionId -> MissionExecutionState
  private missionStates: Map<string, MissionExecutionState> = new Map();
  private eventLog: TaskEventLog;

  constructor(eventLog: TaskEventLog) {
    this.eventLog = eventLog;
  }

  /**
   * Mission 초기화 (상태 생성)
   */
  public initMission(missionId: string, budget: MissionExecutionState['budget']): void {
    if (this.missionStates.has(missionId)) {
      throw new Error(`Mission ${missionId} is already initialized.`);
    }
    this.missionStates.set(missionId, {
      missionId,
      status: 'CREATED',
      budget: { ...budget },
    });
  }

  /**
   * Mission 상태 조회
   */
  public getMissionState(missionId: string): MissionExecutionState {
    const state = this.missionStates.get(missionId);
    if (!state) {
      throw new Error(`Mission ${missionId} not found in store.`);
    }
    return state;
  }

  /**
   * Mission 상태 갱신
   */
  public updateMissionState(missionId: string, updates: Partial<MissionExecutionState>): void {
    const state = this.getMissionState(missionId);
    const updated = { ...state, ...updates };
    
    // 깊은 복사(budget 등)는 주의 필요
    if (updates.budget) {
      updated.budget = { ...state.budget, ...updates.budget };
    }
    
    this.missionStates.set(missionId, updated);
  }

  /**
   * 새 태스크를 등록합니다. (단일 건)
   */
  public registerTask(entity: TaskEntity, missionId: string): void {
    if (!this.missions.has(missionId)) {
      this.missions.set(missionId, new Map());
    }
    const missionTasks = this.missions.get(missionId)!;
    if (missionTasks.has(entity.definition.id)) {
      return;
    }
    missionTasks.set(entity.definition.id, entity);

    // 이벤트 로깅
    this.eventLog.appendEvent({
      eventId: crypto.randomUUID(),
      sessionId: missionId,
      taskId: entity.definition.id,
      type: 'TASK_REGISTERED',
      toStatus: entity.state.status,
      reason: 'Initial task registration',
      actor: 'TaskRuntimeStore',
      timestamp: Date.now(),
      stateVersion: entity.state.stateVersion,
    });
  }

  /**
   * 다수의 태스크를 원자적으로(All-or-Nothing) 등록합니다. (PHASE 2)
   * 부분 등록을 방지하기 위해 등록 전 모든 ID의 중복 여부를 먼저 검사합니다.
   * 중복이 발견되면 Error를 발생시키고 어떤 태스크도 등록하지 않습니다.
   */
  public registerTasksAtomic(entities: TaskEntity[], missionId: string): void {
    if (!this.missions.has(missionId)) {
      this.missions.set(missionId, new Map());
    }
    const missionTasks = this.missions.get(missionId)!;

    // 1. Pre-flight Check (모두 가능한지 검사)
    for (const entity of entities) {
      if (missionTasks.has(entity.definition.id)) {
        throw new Error(`Atomic registration failed: Task ID '${entity.definition.id}' already exists in mission '${missionId}'. Partial registration prevented.`);
      }
    }

    // 2. Commit State & Log Events
    const now = Date.now();
    for (const entity of entities) {
      missionTasks.set(entity.definition.id, entity);
      
      this.eventLog.appendEvent({
        eventId: crypto.randomUUID(),
        sessionId: missionId,
        taskId: entity.definition.id,
        type: 'TASK_REGISTERED',
        toStatus: entity.state.status,
        reason: 'Atomic task batch registration',
        actor: 'TaskRuntimeStore',
        timestamp: now,
        stateVersion: entity.state.stateVersion,
      });
    }
  }

  /**
   * 특정 Task ID를 조회합니다.
   */
  public getTask(missionId: string, taskId: string): TaskEntity {
    const missionTasks = this.missions.get(missionId);
    if (!missionTasks) {
      throw new TaskNotFoundError(`Mission ${missionId} not found in store.`);
    }
    const task = missionTasks.get(taskId);
    if (!task) {
      throw new TaskNotFoundError(`Task ${taskId} not found in mission ${missionId}.`);
    }
    return task;
  }

  /**
   * 전체 태스크 목록을 배열로 반환합니다.
   */
  public getAllTasks(missionId: string): TaskEntity[] {
    const missionTasks = this.missions.get(missionId);
    return missionTasks ? Array.from(missionTasks.values()) : [];
  }

  /**
   * 상태 변경 없이 메타데이터(Attempt 등)만 갱신합니다.
   */
  public updateTaskMetadata(
    command: Omit<TransitionCommand, 'expectedCurrentStatus'>,
    partialUpdates: Partial<TaskRuntimeState>
  ): void {
    const task = this.getTask(command.missionId, command.taskId);
    
    // StateMachine의 순수 함수를 호출하여 Invariant 검증
    const updatedTask = TaskStateMachine.updateMetadata(task, command, partialUpdates);

    // 저장소 갱신
    this.missions.get(command.missionId)!.set(command.taskId, updatedTask);

    // 이벤트 로깅 (별도의 이벤트 타입이 필요할 수 있지만, 여기서는 TASK_STATE_TRANSITION_REJECTED나 다른 걸 피하기 위해 임시 사용)
    this.eventLog.appendEvent({
      eventId: `evt-meta-${crypto.randomUUID()}`,
      sessionId: 'sys-session', // 임시 세션
      missionId: command.missionId,
      taskId: command.taskId,
      type: 'TASK_VERIFICATION_STARTED', // TODO: 임시로 맵핑, 실제로는 TASK_METADATA_UPDATED 등 필요
      timestamp: command.timestamp,
      actor: command.actor,
      stateVersion: updatedTask.state.stateVersion,
      reason: command.reason,
      metadata: {
        command,
        updates: partialUpdates
      }
    });
  }

  /**
   * 태스크의 상태를 전이시킵니다. StateMachine을 통과합니다.
   * 
   * @param command 상태 전이 명령어 
   * @param targetStatus 목표 상태
   * @param partialUpdates 부가적인 상태 변경 (검증, 에러, 활성 시도ID 등)
   */
  public dispatchTransition(
    command: TransitionCommand,
    targetStatus: TaskEntity['state']['status'],
    partialUpdates?: Partial<TaskRuntimeState>
  ): void {
    const task = this.getTask(command.missionId, command.taskId);
    const fromStatus = task.state.status;

    try {
      // 순수 함수 기반 상태 변환 
      const updatedTask = TaskStateMachine.transition(task, targetStatus, command, partialUpdates);
      
      // 원자성 보장: Event 기록을 먼저 수행. 성공 시에만 Store 업데이트.
      this.eventLog.appendEvent({
        eventId: crypto.randomUUID(),
        sessionId: command.missionId,
        taskId: command.taskId,
        attemptId: command.attemptId,
        type: this.mapTargetStatusToEventType(targetStatus),
        fromStatus,
        toStatus: targetStatus,
        reason: command.reason,
        actor: command.actor,
        timestamp: command.timestamp,
        stateVersion: updatedTask.state.stateVersion,
        metadata: command.metadata
      });

      // Store 갱신 (메모리 맵이므로 예외가 발생할 가능성이 거의 없음)
      const missionTasks = this.missions.get(command.missionId)!;
      missionTasks.set(command.taskId, updatedTask);

    } catch (error: any) {
      // 거부된 전이 이벤트 기록
      this.eventLog.appendEvent({
        eventId: crypto.randomUUID(),
        sessionId: command.missionId,
        taskId: command.taskId,
        attemptId: command.attemptId,
        type: 'TASK_STATE_TRANSITION_REJECTED',
        fromStatus,
        toStatus: targetStatus,
        reason: `Rejection: ${error.message}`,
        actor: command.actor,
        timestamp: command.timestamp,
        stateVersion: task.state.stateVersion,
      });

      // 에러를 호출자에게 다시 전파
      throw error;
    }
  }

  /**
   * 목표 상태에 대응되는 이벤트 타입을 반환하는 헬퍼 메서드
   */
  private mapTargetStatusToEventType(targetStatus: TaskEntity['state']['status']): TaskEvent['type'] {
    switch (targetStatus) {
      case 'READY': return 'TASK_READY';
      case 'RUNNING': return 'TASK_STARTED';
      case 'VERIFYING': return 'TASK_VERIFICATION_STARTED';
      case 'COMPLETED': return 'TASK_VERIFICATION_PASSED';
      case 'FAILED': return 'TASK_FAILED';
      case 'BLOCKED': return 'TASK_BLOCKED';
      case 'SKIPPED': return 'TASK_SKIPPED';
      case 'CANCELLED': return 'TASK_CANCELLED';
      case 'WAITING_USER': return 'TASK_WAITING_USER';
      default: return 'TASK_RESULT_SUBMITTED';
    }
  }

  /**
   * (테스트용) 스토어 초기화
   */
  public clear(missionId?: string): void {
    if (missionId) {
      this.missions.delete(missionId);
      this.missionStates.delete(missionId);
    } else {
      this.missions.clear();
      this.missionStates.clear();
      this.eventLog.clear();
    }
  }
}
