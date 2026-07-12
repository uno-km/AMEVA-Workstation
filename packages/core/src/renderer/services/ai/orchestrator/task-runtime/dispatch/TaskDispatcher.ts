/**
 * @file orchestrator/task-runtime/dispatch/TaskDispatcher.ts
 * @system AMEVA OS Desktop Workstation
 * @role READY 상태의 태스크에 Lease를 걸고 RUNNING 상태로 전이시키며 Executor를 비동기로 기동
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionExecutionRuntime: tick() 내에서 READY Task 각각에 dispatchTask() 호출
 *
 * [Item 2 통합]
 * CheckpointRuntime을 생성자에서 주입받아 DeepTaskExecutor에 전달.
 * DeepTaskExecutor가 Turn 경계 및 Tool 성공 직후 Checkpoint를 저장할 수 있도록 한다.
 *
 * [AGENTS.md 규칙 1]
 * `any` 사용 없음. launchDeepExecutor의 catch에서 any 제거됨.
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { ExecutionStrategyResolver } from './ExecutionStrategyResolver';
import { DeepTaskExecutor } from '../executors/DeepTaskExecutor';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { CheckpointRuntime } from '../checkpoint/CheckpointRuntime';
import type { ILLMEngineAdapter } from '../../types';
import type { ExecutionHandle } from '../domain/ExecutionTypes';

export class TaskDispatcher {
  private store: TaskRuntimeStore;
  private leaseManager: TaskLeaseManager;
  private ledger: MissionBudgetLedger;
  private resolver: ExecutionStrategyResolver;
  private adapter: ILLMEngineAdapter;
  private checkpointRuntime?: CheckpointRuntime;

  constructor(
    store: TaskRuntimeStore,
    leaseManager: TaskLeaseManager,
    ledger: MissionBudgetLedger,
    resolver: ExecutionStrategyResolver,
    adapter: ILLMEngineAdapter,
    checkpointRuntime?: CheckpointRuntime
  ) {
    this.store = store;
    this.leaseManager = leaseManager;
    this.ledger = ledger;
    this.resolver = resolver;
    this.adapter = adapter;
    this.checkpointRuntime = checkpointRuntime;
  }

  /**
   * READY 상태인 특정 태스크를 시작합니다.
   * PHASE 3.5: fire-and-forget이 아닌 ExecutionHandle을 반환하여 런타임이 추적하게 합니다.
   */
  public dispatchTask(
    missionId: string,
    taskId: string,
    parentAbortSignal?: AbortSignal
  ): ExecutionHandle | null {
    const task = this.store.getTask(missionId, taskId);

    if (task.state.status !== 'READY') {
      return null;
    }

    try {
      // 1. Lease 획득 — [Critical 0-A Fix] Task 정의에서 실제 planVersion 전달
      const executionId = `exec-${crypto.randomUUID()}`;
      const planVersion = task.definition.plannerMetadata?.['planVersion'] as number | undefined ?? 1;
      const lease = this.leaseManager.acquireLease(
        missionId, taskId, executionId, 'Dispatcher-Main', undefined, planVersion
      );

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
      console.debug(`[TaskDispatcher] Strategy for ${taskId}: ${strategy}`);

      // 4. Abort Controller 구성
      const taskAbortController = new AbortController();
      if (parentAbortSignal) {
        parentAbortSignal.addEventListener('abort', () =>
          taskAbortController.abort('Mission Cancelled')
        );
      }

      // 5. 비동기 Executor 기동
      const executionPromise = this.launchDeepExecutor(
        missionId, taskId, lease.attemptId, lease.leaseId, taskAbortController.signal
      );

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

    } catch (dispatchErr: unknown) {
      const msg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
      console.warn(`[TaskDispatcher] Failed to dispatch task ${taskId}:`, msg);
      return null;
    }
  }

  /**
   * DeepTaskExecutor를 비동기로 기동하고 예외를 FAILED 전이로 처리한다.
   *
   * [any 제거]
   * `catch (e: any)` → `catch (e: unknown)` 으로 수정 (AGENTS.md 규칙 1).
   */
  private async launchDeepExecutor(
    missionId: string,
    taskId: string,
    attemptId: string,
    leaseId: string,
    abortSignal: AbortSignal
  ): Promise<void> {
    try {
      /*
       * [CheckpointRuntime 주입]
       * MissionExecutionRuntime이 공유하는 인스턴스를 DeepTaskExecutor에 전달.
       * 미주입 시 DeepTaskExecutor가 자체 독립 인스턴스를 생성한다.
       */
      const executor = new DeepTaskExecutor(
        this.store,
        this.leaseManager,
        this.ledger,
        this.adapter,
        undefined, // toolRegistry: 기본 사용
        this.checkpointRuntime // [Item 1] CheckpointRuntime 주입
      );
      await executor.execute(missionId, taskId, attemptId, leaseId, abortSignal);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[TaskDispatcher] DeepTaskExecutor crashed for ${taskId}:`, errorMsg);

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
            reason: `Executor crashed: ${errorMsg}`,
            actor: 'DeepTaskExecutor',
            timestamp: Date.now()
          },
          'FAILED',
          { lastFailure: { errorType: 'ExecutorCrash', message: errorMsg, timestamp: Date.now() } }
        );
      } catch (transitionError: unknown) {
        const tMsg = transitionError instanceof Error ? transitionError.message : String(transitionError);
        console.error(`[TaskDispatcher] Failed to transition to FAILED after crash:`, tMsg);
      }
    }
  }
}
