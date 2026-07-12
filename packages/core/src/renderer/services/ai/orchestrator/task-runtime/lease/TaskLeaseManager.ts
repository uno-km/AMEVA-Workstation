/**
 * @file orchestrator/task-runtime/lease/TaskLeaseManager.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task 동시 실행 방지를 위한 임대(Lease) 발급 및 관리소
 */

import { TaskLease } from '../domain/ExecutionTypes';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { LeaseConflictError, TaskNotFoundError } from '../domain/errors';
import type { TaskAttempt } from '../domain/types';

export class TaskLeaseManager {
  // Key: `${missionId}:${taskId}`
  private leases: Map<string, TaskLease> = new Map();

  // 기본 Lease 유효시간 (ms)
  private readonly DEFAULT_TTL = 30000; 

  constructor(private store: TaskRuntimeStore) {}

  /**
   * 태스크의 Lease를 획득하고 새로운 Attempt를 생성합니다.
   * 이미 유효한 Lease가 존재하면 거부됩니다.
   */
  public acquireLease(
    missionId: string, 
    taskId: string, 
    executionId: string, 
    ownerId: string,
    ttlMs: number = this.DEFAULT_TTL
  ): TaskLease {
    const key = this.getLeaseKey(missionId, taskId);
    const existing = this.leases.get(key);
    const now = Date.now();

    if (existing && existing.expiresAt > now) {
      throw new LeaseConflictError(`Task ${taskId} is currently leased to ${existing.ownerId} until ${existing.expiresAt}`);
    }

    const task = this.store.getTask(missionId, taskId);
    
    // 새 AttemptId 발급 및 Sequence 계산
    const attemptId = `attempt-${crypto.randomUUID()}`;
    const nextSequence = Object.keys(task.state.attempts).length;

    const newAttempt: TaskAttempt = {
      attemptId,
      taskId,
      sequence: nextSequence,
      status: 'READY',
      executionId,
      reasoningTurns: 0,
      toolCallCount: 0,
      recoveryCount: 0,
      startedAt: now,
    };

    // Store에 Attempt 등록 
    // 주의: 실제 READY -> RUNNING 전이는 StateMachine이 담당하므로 여기서는 객체만 심어줍니다.
    this.store.dispatchTransition(
      {
        commandId: `cmd-acquire-${crypto.randomUUID()}`,
        missionId,
        taskId,
        attemptId,
        expectedCurrentStatus: task.state.status,
        expectedStateVersion: task.state.stateVersion,
        reason: `Lease acquired by ${ownerId}`,
        actor: 'TaskLeaseManager',
        timestamp: now
      },
      task.state.status, // 상태는 일단 그대로 두고 Attempt만 갱신 (전이는 스케줄러가 알아서 함)
      {
        activeAttemptId: attemptId,
        attempts: { ...task.state.attempts, [attemptId]: newAttempt }
      }
    );

    // 다시 Store에서 버전 확인
    const updatedTask = this.store.getTask(missionId, taskId);

    const lease: TaskLease = {
      leaseId: `lease-${crypto.randomUUID()}`,
      missionId,
      taskId,
      attemptId,
      executionId,
      ownerId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      renewedAt: now,
      stateVersion: updatedTask.state.stateVersion,
      planVersion: 1 // TODO: MissionExecutionState에서 동기화 필요
    };

    this.leases.set(key, lease);
    return lease;
  }

  /**
   * 기존 Lease의 타임아웃을 갱신합니다.
   */
  public renewLease(leaseId: string, ttlMs: number = this.DEFAULT_TTL): TaskLease {
    for (const [key, lease] of this.leases.entries()) {
      if (lease.leaseId === leaseId) {
        const now = Date.now();
        if (lease.expiresAt < now) {
          throw new LeaseConflictError(`Lease ${leaseId} has already expired.`);
        }
        
        lease.expiresAt = now + ttlMs;
        lease.renewedAt = now;
        return lease;
      }
    }
    throw new LeaseConflictError(`Lease ${leaseId} not found.`);
  }

  /**
   * 작업 종료 시 Lease를 즉시 반환합니다.
   */
  public releaseLease(leaseId: string): void {
    for (const [key, lease] of this.leases.entries()) {
      if (lease.leaseId === leaseId) {
        this.leases.delete(key);
        return;
      }
    }
  }

  /**
   * 타임아웃된(만료된) Lease가 있는지 검사하여 일괄 제거합니다. (Garbage Collection)
   */
  public sweepExpiredLeases(): string[] {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, lease] of this.leases.entries()) {
      if (lease.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.leases.delete(key);
    }
    
    return expiredKeys; // 타임아웃된 taskId 등을 스케줄러에 통보하여 재시도 유도 가능
  }

  private getLeaseKey(missionId: string, taskId: string): string {
    return `${missionId}:${taskId}`;
  }
}
