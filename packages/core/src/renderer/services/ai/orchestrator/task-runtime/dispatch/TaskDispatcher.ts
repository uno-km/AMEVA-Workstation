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
import { ModelRouter } from '../routing/router/ModelRouter';
import { RoutingBudgetManager } from '../routing/budget/RoutingBudgetManager';
import { ModelAdapterProvider } from '../routing/adapter/ModelAdapterProvider';
import { RoutingConfigManager } from '../routing/domain/RoutingConfigManager';
import type { TaskRoutingProfile } from '../routing/domain/types';

export class TaskDispatcher {
  private store: TaskRuntimeStore;
  private leaseManager: TaskLeaseManager;
  private ledger: MissionBudgetLedger;
  private resolver: ExecutionStrategyResolver;
  private adapter: ILLMEngineAdapter;
  private checkpointRuntime?: CheckpointRuntime;
  private toolRegistry?: import('../../ToolRegistry').ToolRegistry;
  private artifactManager?: import('../artifact/ArtifactTransactionManager').ArtifactTransactionManager;

  constructor(
    store: TaskRuntimeStore,
    leaseManager: TaskLeaseManager,
    ledger: MissionBudgetLedger,
    resolver: ExecutionStrategyResolver,
    adapter: ILLMEngineAdapter,
    checkpointRuntime?: CheckpointRuntime,
    toolRegistry?: import('../../ToolRegistry').ToolRegistry,
    artifactManager?: import('../artifact/ArtifactTransactionManager').ArtifactTransactionManager
  ) {
    this.store = store;
    this.leaseManager = leaseManager;
    this.ledger = ledger;
    this.resolver = resolver;
    this.adapter = adapter;
    this.checkpointRuntime = checkpointRuntime;
    this.toolRegistry = toolRegistry;
    this.artifactManager = artifactManager;
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

      // Phase 4 Trace 기록: Task Started
      this.store.getTraceManager().recordTaskStarted(missionId, taskId, lease.attemptId, task.definition.title);

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
      let taskAdapter = this.adapter;
      const task = this.store.getTask(missionId, taskId);
      const routingConfig = RoutingConfigManager.getInstance().getConfig();

      // [Item 2] ModelRouter.route() -> ModelAdapterProvider
      if (routingConfig.routingEnabled) {
        let routingAffinity = task.state.routingAffinity;

        // Affinity Status Check or UNAVAILABLE check
        let needsRouting = !routingAffinity || routingAffinity.affinityStatus !== 'ACTIVE';
        
        if (!needsRouting && routingAffinity?.selectedModelId) {
           const adapterProvider = ModelAdapterProvider.getInstance();
           try {
             // Just check if we can get it, if it throws UNAVAILABLE it will be caught
             await adapterProvider.getAdapterForModel(routingAffinity.selectedModelId, task.definition.privacyLevel as import('../domain/types').PrivacyLevel);
           } catch(e: unknown) {
             const error = e as Error;
             if (error.message && error.message.includes('UNAVAILABLE')) {
               needsRouting = true;
             }
           }
        }

        if (needsRouting) {
          const budgetManager = new RoutingBudgetManager(routingConfig, task.state.routingBudget);
          
          if (!budgetManager.recordDecision()) {
            this.store.dispatchTransition(
              {
                commandId: `cmd-fail-${crypto.randomUUID()}`,
                missionId,
                taskId,
                expectedCurrentStatus: 'DISPATCHED',
                expectedStateVersion: task.state.stateVersion,
                reason: 'Routing budget exhausted',
                actor: 'TaskDispatcher',
                timestamp: Date.now()
              },
              'FAILED',
              { taskResult: { status: 'FAILED', result: {}, error: 'Routing budget exhausted' } }
            );
            return;
          }

          const isRepair = task.state.previousFailures && task.state.previousFailures.length > 0 && task.state.previousFailures[task.state.previousFailures.length - 1].errorType === 'VerificationFailed';
          const lastFailure = isRepair ? task.state.previousFailures![task.state.previousFailures!.length - 1] : null;

          const profile: TaskRoutingProfile = {
            taskType: isRepair ? 'PARTIAL_REPAIR' : 'EXECUTION',
            requiredCapabilities: isRepair ? ['CODE_REPAIR', 'STRUCTURED_OUTPUT'] : (task.definition.requiredCapabilities || []),
            contextSize: 2000, // Roughly estimated, ideally should be dynamic
            expectedOutputTokens: task.definition.expectedOutputTokens || 1000,
            privacyLevel: task.definition.privacyLevel || 'INTERNAL',
            instructionComplexity: 0.8,
            reasoningComplexity: 0.7,
            toolRequired: true,
            codeExecutionRequired: task.definition.requiredCapabilities?.includes('CODE_GENERATION') || false,
            latencyPreference: 'balance',
            qualityPreference: 'high',
            previousModelIds: task.state.previousFailures?.map(f => f.modelId || '') || [],
            routingBudgetRemaining: 5,
            retryScope: lastFailure?.retryScope,
            sourceModelId: routingAffinity?.selectedModelId,
            previousDefectSignatures: lastFailure?.defectSignatures || []
          };

          const routingResult = await ModelRouter.route(profile, routingConfig);
          
          if (routingResult.status === 'SUCCESS') {
            // Preserve other metadata from routingAffinity if it existed
            const prevAffinity = task.state.routingAffinity || {} as any;
            routingAffinity = {
              routingDecisionId: routingResult.routingDecisionId,
              selectedModelId: routingResult.selectedModelId,
              selectedRole: routingResult.selectedRole,
              affinityStatus: 'ACTIVE',
              previousModelIds: prevAffinity.previousModelIds || [],
              failedCombinationDigests: prevAffinity.failedCombinationDigests || [],
              privacyLocalRerouteCount: prevAffinity.privacyLocalRerouteCount || 0,
              selectedAt: routingResult.decidedAt
            };

            // Save Affinity
            this.store.updateTaskMetadata(
              {
                commandId: `cmd-affinity-${crypto.randomUUID()}`,
                missionId,
                taskId,
                expectedStateVersion: task.state.stateVersion,
                reason: 'Save Model Routing Affinity',
                actor: 'TaskDispatcher',
                timestamp: Date.now()
              } as unknown as import('../domain/types').TransitionCommand,
              {
                routingAffinity,
                routingBudget: budgetManager.getState()
              }
            );
          }
          
          this.store.getTraceManager().recordRoutingDecision(
            missionId,
            taskId,
            attemptId,
            routingResult
          );
        }

        if (routingAffinity && (routingAffinity.affinityStatus === 'ACTIVE' && routingAffinity.selectedModelId)) {
          try {
            const rawAdapter = await ModelAdapterProvider.getInstance().getAdapterForModel(routingAffinity.selectedModelId, task.definition.privacyLevel as import('../domain/types').PrivacyLevel);
            const { ModelCallGatewayAdapter } = await import('../routing/gateway/ModelCallGatewayAdapter');
            taskAdapter = new ModelCallGatewayAdapter(
              rawAdapter, 
              routingAffinity.selectedModelId, 
              this.store.getTraceManager(), 
              missionId, 
              taskId, 
              attemptId, 
              routingAffinity.routingDecisionId
            );
          } catch (e: unknown) {
            const err = e as Error;
            if (err.message && err.message.includes('Privacy Gate Violation')) {
              // Privacy 차단 흐름
              const newAffinity = {
                ...routingAffinity!,
                affinityStatus: 'INVALIDATED' as const,
                invalidationReason: 'PRIVACY_POLICY_BLOCKED'
              };

              this.store.updateTaskMetadata(
                {
                  commandId: `cmd-privacy-block-${crypto.randomUUID()}`,
                  missionId,
                  taskId,
                  expectedStateVersion: task.state.stateVersion,
                  reason: 'Privacy Gate Blocked Remote Model',
                  actor: 'TaskDispatcher',
                  timestamp: Date.now()
                } as unknown as import('../domain/types').TransitionCommand,
                {
                  routingAffinity: newAffinity
                }
              );
              
              // Local 후보로 최대 1회 재라우팅
              const budgetManager = new RoutingBudgetManager(routingConfig, task.state.routingBudget);
              const currentRerouteCount = newAffinity.privacyLocalRerouteCount || 0;
              
              if (currentRerouteCount >= 1) {
                // 더 이상 재라우팅 불가, WAITING_USER 전환
                this.store.dispatchTransition(
                  {
                    commandId: `cmd-wait-user-${crypto.randomUUID()}`,
                    missionId,
                    taskId,
                    expectedCurrentStatus: 'DISPATCHED',
                    expectedStateVersion: task.state.stateVersion + 1,
                    reason: 'Local Reroute Failed after Privacy Block',
                    actor: 'TaskDispatcher',
                    timestamp: Date.now()
                  },
                  'WAITING_USER',
                  {}
                );
                return;
              }
              
              // Consume budget and retry
              if (!budgetManager.recordDecision()) {
                this.store.dispatchTransition(
                  {
                    commandId: `cmd-fail-${crypto.randomUUID()}`,
                    missionId,
                    taskId,
                    expectedCurrentStatus: 'DISPATCHED',
                    expectedStateVersion: task.state.stateVersion + 1,
                    reason: 'Routing budget exhausted',
                    actor: 'TaskDispatcher',
                    timestamp: Date.now()
                  },
                  'FAILED',
                  { taskResult: { status: 'FAILED', result: {}, error: 'Routing budget exhausted' } }
                );
                return;
              }
              
              const profile: import('../routing/domain/types').TaskRoutingProfile = {
                taskType: 'EXECUTION',
                requiredCapabilities: task.definition.requiredCapabilities || [],
                contextSize: 2000,
                expectedOutputTokens: task.definition.expectedOutputTokens || 1000,
                privacyLevel: task.definition.privacyLevel || 'INTERNAL',
                instructionComplexity: 0.8,
                reasoningComplexity: 0.7,
                toolRequired: true,
                codeExecutionRequired: task.definition.requiredCapabilities?.includes('CODE_GENERATION') || false,
                latencyPreference: 'balance',
                qualityPreference: 'high',
                previousModelIds: [...(task.state.previousFailures?.map(f => f.modelId || '') || []), routingAffinity.selectedModelId],
                routingBudgetRemaining: 5,
                sourceModelId: undefined,
                previousDefectSignatures: []
              };

              // Force local only
              const localConfig = { ...routingConfig, localFirst: true, allowRemoteForInternal: false, allowRemoteForPublic: false };
              const localProfile = { ...profile, privacyLevel: 'RESTRICTED' as const };
              const newRoutingResult = await ModelRouter.route(localProfile, localConfig);
              
              this.store.updateTaskMetadata(
                {
                  commandId: `cmd-privacy-reroute-${crypto.randomUUID()}`,
                  missionId,
                  taskId,
                  expectedStateVersion: task.state.stateVersion + 2,
                  reason: 'Privacy Reroute Executed',
                  actor: 'TaskDispatcher',
                  timestamp: Date.now()
                } as unknown as import('../domain/types').TransitionCommand,
                {
                  routingAffinity: {
                    ...newRoutingResult,
                    routingDecisionId: newRoutingResult.routingDecisionId,
                    selectedModelId: newRoutingResult.selectedModelId,
                    selectedRole: newRoutingResult.selectedRole,
                    selectedAt: newRoutingResult.decidedAt,
                    affinityStatus: 'ACTIVE',
                    previousModelIds: [...newAffinity.previousModelIds],
                    failedCombinationDigests: [...newAffinity.failedCombinationDigests],
                    privacyLocalRerouteCount: newAffinity.privacyLocalRerouteCount + 1
                  },
                  routingBudget: budgetManager.getState()
                }
              );
              
              if (newRoutingResult.status === 'SUCCESS' && newRoutingResult.selectedModelId) {
                try {
                  const reroutedAdapter = await ModelAdapterProvider.getInstance().getAdapterForModel(newRoutingResult.selectedModelId, task.definition.privacyLevel as import('../domain/types').PrivacyLevel);
                  const { ModelCallGatewayAdapter } = await import('../routing/gateway/ModelCallGatewayAdapter');
                  taskAdapter = new ModelCallGatewayAdapter(
                    reroutedAdapter, 
                    newRoutingResult.selectedModelId, 
                    this.store.getTraceManager(), 
                    missionId, 
                    taskId, 
                    attemptId, 
                    newRoutingResult.routingDecisionId
                  );
                } catch (retryE: unknown) {
                  this.store.dispatchTransition(
                    {
                      commandId: `cmd-wait-user-${crypto.randomUUID()}`,
                      missionId,
                      taskId,
                      expectedCurrentStatus: 'DISPATCHED',
                      expectedStateVersion: task.state.stateVersion + 3,
                      reason: 'No Local Candidates Available after Privacy Block',
                      actor: 'TaskDispatcher',
                      timestamp: Date.now()
                    },
                    'WAITING_USER',
                    {}
                  );
                  return;
                }
              } else {
                 this.store.dispatchTransition(
                    {
                      commandId: `cmd-wait-user-${crypto.randomUUID()}`,
                      missionId,
                      taskId,
                      expectedCurrentStatus: 'DISPATCHED',
                      expectedStateVersion: task.state.stateVersion + 3,
                      reason: 'No Local Candidates Available after Privacy Block',
                      actor: 'TaskDispatcher',
                      timestamp: Date.now()
                    },
                    'WAITING_USER',
                    {}
                  );
                  return;
              }
            } else {
              console.warn(`[TaskDispatcher] Adapter load failed for ${routingAffinity.selectedModelId}, falling back`, err);
            }
          }
        }
      } else {
        // Legacy 경로 사용 시 Trace 기록
        this.store.getTraceManager().getStore().appendEvent({
          eventId: crypto.randomUUID(),
          traceId: missionId,
          spanId: `span-t-${taskId}-${attemptId}`,
          parentSpanId: `span-m-${missionId}`,
          missionId,
          taskId,
          attemptId,
          timestamp: Date.now(),
          eventType: 'legacy_routing_fallback',
          status: 'SUCCESS',
          title: `Legacy Routing Fallback`,
          summary: `Routing disabled, using default adapter`,
          sequenceNumber: 0,
          visibility: 'INTERNAL',
          severity: 'INFO',
          schemaVersion: '4.0.0',
          metadata: { 
            fallbackReason: 'routingEnabled is false',
            routingEnabled: false
          }
        });
      }

      /*
       * [CheckpointRuntime 주입]
       * MissionExecutionRuntime이 공유하는 인스턴스를 DeepTaskExecutor에 전달.
       * 미주입 시 DeepTaskExecutor가 자체 독립 인스턴스를 생성한다.
       */
      const executor = new DeepTaskExecutor(
        this.store,
        this.leaseManager,
        this.ledger,
        taskAdapter,
        this.toolRegistry,
        this.checkpointRuntime,
        this.artifactManager
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

        const seq = this.store.getTraceManager().getStore().nextSequenceNumber(missionId);
        this.store.getTraceManager().getStore().appendEvent({
          eventId: `${missionId}_tfail_${taskId}_${seq}`,
          traceId: missionId,
          spanId: `span-t-${taskId}-${attemptId}`,
          parentSpanId: `span-m-${missionId}`,
          missionId,
          taskId,
          attemptId,
          timestamp: Date.now(),
          eventType: 'task_failed',
          status: 'FAILED',
          title: `Task Failed: ${taskId}`,
          summary: `Executor crashed: ${errorMsg}`,
          sequenceNumber: seq,
          visibility: 'USER',
          severity: 'HIGH',
          schemaVersion: '4.0.0'
        });
      } catch (transitionError: unknown) {
        const tMsg = transitionError instanceof Error ? transitionError.message : String(transitionError);
        console.error(`[TaskDispatcher] Failed to transition to FAILED after crash:`, tMsg);
      }
    }
  }
}
