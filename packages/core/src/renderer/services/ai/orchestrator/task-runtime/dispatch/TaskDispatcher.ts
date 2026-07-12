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
import type { ExecutionHandle } from '../domain/ExecutionTypes';

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
   * PHASE 3.5: fire-and-forget이 아닌 ExecutionHandle을 반환하여 런타임이 추적하게 합니다.
   */
  public dispatchTask(missionId: string, taskId: string, parentAbortSignal?: AbortSignal): ExecutionHandle | null {
    const task = this.store.getTask(missionId, taskId);
    
    if (task.state.status !== 'READY') {
      return null;
    }

    try {
      // 1. Lease 획득
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

      // 4. Abort Controller 구성
      const taskAbortController = new AbortController();
      if (parentAbortSignal) {
        parentAbortSignal.addEventListener('abort', () => taskAbortController.abort('Mission Cancelled'));
      }

      // 5. 비동기 Executor 기동 (Promise 반환)
      const executionPromise = this.launchDeepExecutor(missionId, taskId, lease.attemptId, lease.leaseId, taskAbortController.signal);

      // 6. Handle 반환
      return {
        executionId,
        missionId,
        taskId,
        attemptId: lease.attemptId,
        promise: executionPromise,
        abortController: taskAbortController,
        startedAt: Date.now(),
        status: 'RUNNING',
        leaseId: lease.leaseId
      };

    } catch (e) {
      console.warn(`[TaskDispatcher] Failed to dispatch task ${taskId}:`, e);
      return null;
    }
  }

  private async launchDeepExecutor(missionId: string, taskId: string, attemptId: string, leaseId: string, abortSignal: AbortSignal): Promise<void> {
    try {
      const executor = new DeepTaskExecutor(this.store, this.leaseManager, this.ledger, this.adapter);
      await executor.execute(missionId, taskId, attemptId, leaseId, abortSignal);
    } catch (e: any) {
      console.error(`[TaskDispatcher] DeepTaskExecutor crashed for ${taskId}:`, e);
      
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
