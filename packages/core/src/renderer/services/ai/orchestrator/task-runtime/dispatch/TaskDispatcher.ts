/**
 * @file orchestrator/task-runtime/dispatch/TaskDispatcher.ts
 * @system AMEVA OS Desktop Workstation
 * @role READY 상태의 태스크에 Lease를 걸고 RUNNING 상태로 전이시키며 Executor를 비동기로 기동
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { ExecutionStrategyResolver } from './ExecutionStrategyResolver';
import { DeepTaskExecutor } from '../executors/DeepTaskExecutor';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import type { ILLMEngineAdapter } from '../../types';

export class TaskDispatcher {
  constructor(
    private store: TaskRuntimeStore,
    private leaseManager: TaskLeaseManager,
    private ledger: MissionBudgetLedger,
    private resolver: ExecutionStrategyResolver,
    private adapter: ILLMEngineAdapter
  ) {}

  /**
   * READY 상태인 특정 태스크를 시작합니다.
   * - 락 획득 시도
   * - 실패 시 무시 (다른 워커가 실행 중)
   * - 성공 시 RUNNING 상태로 전이
   * - 비동기로 Executor 실행 (fire and forget, promise는 내부에서 상태 머신으로 귀결됨)
   */
  public dispatchTask(missionId: string, taskId: string, abortSignal?: AbortSignal): void {
    const task = this.store.getTask(missionId, taskId);
    
    if (task.state.status !== 'READY') {
      return;
    }

    try {
      // 1. Lease 획득 (내부에서 TaskAttempt 생성 및 활성화)
      const executionId = `exec-${crypto.randomUUID()}`;
      const lease = this.leaseManager.acquireLease(missionId, taskId, executionId, 'Dispatcher-Main');

      // 2. RUNNING 전이
      this.store.dispatchTransition(
        {
          commandId: `cmd-run-${crypto.randomUUID()}`,
          missionId,
          taskId,
          attemptId: lease.attemptId,
          expectedCurrentStatus: 'READY',
          expectedStateVersion: lease.stateVersion,
          reason: 'Dispatcher activated task execution',
          actor: 'TaskDispatcher',
          timestamp: Date.now()
        },
        'RUNNING'
      );

      // 3. 전략 판별
      const strategy = this.resolver.resolve(task);

      // 4. 비동기 Executor 실행 (Fire and Forget)
      this.launchDeepExecutor(missionId, taskId, lease.attemptId, abortSignal);

    } catch (e) {
      console.warn(`[TaskDispatcher] Failed to dispatch task ${taskId}:`, e);
      // Lease 획득 실패(충돌) 등일 수 있으므로 여기서 바로 FAILED로 보내지 않음
    }
  }

  private async launchDeepExecutor(missionId: string, taskId: string, attemptId: string, abortSignal?: AbortSignal) {
    try {
      const executor = new DeepTaskExecutor(this.store, this.leaseManager, this.ledger, this.adapter);
      await executor.execute(missionId, taskId, attemptId, abortSignal);
    } catch (e: any) {
      console.error(`[TaskDispatcher] DeepTaskExecutor crashed for ${taskId}:`, e);
      
      // 심각한 런타임 에러 시 FAILED로 강제 전이
      try {
        const currentTask = this.store.getTask(missionId, taskId);
        this.store.dispatchTransition(
          {
            commandId: `cmd-fail-${crypto.randomUUID()}`,
            missionId,
            taskId,
            attemptId,
            expectedCurrentStatus: 'RUNNING',
            expectedStateVersion: currentTask.state.stateVersion,
            reason: `Executor crashed: ${e.message}`,
            actor: 'DeepTaskExecutor',
            timestamp: Date.now()
          },
          'FAILED',
          { lastFailure: { errorType: 'ExecutorCrash', message: e.message, timestamp: Date.now() } }
        );
      } catch (transitionError) {
        console.error(`[TaskDispatcher] Failed to transition to FAILED after crash:`, transitionError);
      }
    }
  }
}
