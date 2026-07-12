import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { TaskScheduler } from '../scheduling/TaskScheduler';
import { TaskDispatcher } from '../dispatch/TaskDispatcher';
import { CapabilityCatalog } from '../dispatch/CapabilityCatalog';
import { ExecutionStrategyResolver } from '../dispatch/ExecutionStrategyResolver';
import type { ILLMEngineAdapter } from '../../types';
import type { ExecutionHandle } from '../domain/ExecutionTypes';
import { VerificationRuntime } from '../verification/runtime/VerificationRuntime';
import { RecoveryRequestStore } from '../verification/recovery/RecoveryRequestStore';

export class MissionExecutionRuntime {
  private ledger: MissionBudgetLedger;
  private leaseManager: TaskLeaseManager;
  private scheduler: TaskScheduler;
  private dispatcher: TaskDispatcher;
  private verificationRuntime: VerificationRuntime;
  private recoveryStore: RecoveryRequestStore;
  
  private abortController: AbortController = new AbortController();
  private isRunning: boolean = false;
  private isTicking: boolean = false;
  private isVerifying: boolean = false;
  private timerId?: ReturnType<typeof setTimeout>;

  private activeExecutions: Map<string, ExecutionHandle> = new Map();

  constructor(
    private store: TaskRuntimeStore,
    private adapter: ILLMEngineAdapter,
    private missionId: string,
    private initialBudget: number = 10000
  ) {
    this.ledger = new MissionBudgetLedger(store);
    this.leaseManager = new TaskLeaseManager(store);
    this.recoveryStore = new RecoveryRequestStore();
    this.scheduler = new TaskScheduler(store, this.ledger, this.recoveryStore);
    this.verificationRuntime = new VerificationRuntime(store, this.recoveryStore, this.ledger, adapter); // [STAGE C] SemanticVerifier LLM 연결

    
    const catalog = new CapabilityCatalog();
    const resolver = new ExecutionStrategyResolver(catalog);
    this.dispatcher = new TaskDispatcher(store, this.leaseManager, this.ledger, resolver, adapter);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.store.initMission(this.missionId, {
      maxReasoningTurns: this.initialBudget,
      consumedReasoningTurns: 0,
      reservedReasoningTurns: 0,
      maxDurationMs: 3600000,
      consumedDurationMs: 0,
      maxToolCalls: 1000,
      consumedToolCalls: 0,
      maxRecoveries: 10,
      consumedRecoveries: 0,
    });
    this.store.updateMissionState(this.missionId, { status: 'RUNNING', startedAt: Date.now() });

    this.requestTick();
  }

  public pause(): void {
    this.isRunning = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.store.updateMissionState(this.missionId, { status: 'PAUSED', pausedAt: Date.now() });
  }

  public cancel(reason: string): void {
    this.isRunning = false;
    if (this.timerId) clearTimeout(this.timerId);
    
    this.abortController.abort(reason);

    for (const handle of this.activeExecutions.values()) {
      handle.abortController.abort(reason);
    }
    
    this.store.updateMissionState(this.missionId, { status: 'CANCELLED', cancellationReason: reason });
  }

  private requestTick(delayMs: number = 1000): void {
    if (!this.isRunning || this.abortController.signal.aborted) return;
    if (this.timerId) clearTimeout(this.timerId);
    
    this.timerId = setTimeout(() => {
      this.tick();
    }, delayMs);
  }

  private tick(): void {
    if (!this.isRunning || this.isTicking || this.abortController.signal.aborted) return;
    this.isTicking = true;

    try {
      // 1. 만료된 Lease 청소 (타임아웃 감지)
      const expiredTasks = this.leaseManager.sweepExpiredLeases();
      if (expiredTasks.length > 0) {
        console.warn(`[MissionExecutionRuntime] Swept expired leases for: ${expiredTasks.join(', ')}`);
      }

      // 2. 스케줄링 패스 (PENDING -> READY 승격 및 예산 할당)
      const { newlyReadyCount, deadlockType } = this.scheduler.runSchedulingPass(this.missionId);

      // 3. 데드락 처리
      if (deadlockType === 'TRUE_DEADLOCK' || deadlockType === 'INTERNAL_ERROR') {
        console.error(`[MissionExecutionRuntime] Fatal Deadlock detected: ${deadlockType}`);
        this.store.updateMissionState(this.missionId, { status: 'FAILED', cancellationReason: deadlockType });
        this.cancel(`Deadlock detected: ${deadlockType}`);
        this.isTicking = false;
        return;
      } else if (deadlockType !== null) {
        console.debug(`[MissionExecutionRuntime] Scheduling blocked by: ${deadlockType}`);
      }

      // 4. 새로 준비되었거나 기존에 READY 상태인 태스크들을 Dispatch
      const allTasks = this.store.getAllTasks(this.missionId);
      const readyTasks = allTasks.filter(t => t.state.status === 'READY');

      for (const task of readyTasks) {
        const handle = this.dispatcher.dispatchTask(this.missionId, task.definition.id, this.abortController.signal);
        if (handle) {
          this.activeExecutions.set(handle.executionId, handle);
          
          handle.promise.then(() => {
            handle.status = 'COMPLETED';
            this.activeExecutions.delete(handle.executionId);
          }).catch((err) => {
            console.error(`[MissionExecutionRuntime] Unhandled executor rejection:`, err);
            handle.status = 'FAILED';
            this.activeExecutions.delete(handle.executionId);
          });
        }
      }

      // 5. 완료 여부 검사 로직 (STAGE E — Recovery 폐루프 포함)
      const hasPendingOrReady = allTasks.some(t =>
        t.state.status === 'PENDING' || t.state.status === 'READY' || t.state.status === 'RETRY_WAIT'
      );
      const hasVerifying = allTasks.some(t => t.state.status === 'VERIFYING');
      const hasRecovering = allTasks.some(t => t.state.status === 'RECOVERING');

      /*
       * [STAGE E — RETRY_WAIT → READY 전이]
       * RETRY_WAIT 상태인 Task의 대기 시간이 만료되었으면 PENDING으로 되돌려
       * 다음 Scheduling Pass에서 READY가 될 수 있도록 합니다.
       * RecoveryCoordinator가 이미 retry 대기를 관리하므로 여기서는 만료 체크만 수행.
       */
      const retryWaitTasks = allTasks.filter(t => t.state.status === 'RETRY_WAIT');
      for (const task of retryWaitTasks) {
        const retryAfter = task.state.retryAfter ?? 0;
        if (retryAfter > 0 && Date.now() >= retryAfter) {
          // 대기 만료 → PENDING으로 재진입하여 Scheduler가 다시 READY로 승격
          this.store.dispatchTransition(
            {
              commandId: `cmd-retry-resume-${crypto.randomUUID()}`,
              missionId: this.missionId,
              taskId: task.definition.id,
              expectedCurrentStatus: 'RETRY_WAIT',
              expectedStateVersion: task.state.stateVersion,
              reason: `Retry wait expired at ${new Date(retryAfter).toISOString()}. Re-entering PENDING.`,
              actor: 'MissionExecutionRuntime',
              timestamp: Date.now()
            },
            'PENDING',
            {}
          );
        }
      }

      // VERIFYING이 있으면 VerificationRuntime을 비동기로 호출하여 신속 검증
      if (hasVerifying && !this.isVerifying) {
        this.isVerifying = true;
        this.verificationRuntime.processVerifyingTasks(this.missionId)
          .then(results => {
            if (results.length > 0) {
              console.log(`[MissionExecutionRuntime] Processed ${results.length} verifications.`);
              // 검증 결과 반영을 위해 루프 단축
              this.requestTick(100);
            }
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              console.error(`[MissionExecutionRuntime] Verification failed:`, err);
            }
          })
          .finally(() => {
            this.isVerifying = false;
          });
      }

      /*
       * [완료 판정 — STAGE E Recovery 상태 포함]
       * RECOVERING이 있으면 Recovery 중이므로 중단하지 않고 대기.
       * RETRY_WAIT이 있으면 만료를 기다려야 하므로 짧은 주기로 재폴링.
       */
      if (
        !hasPendingOrReady &&
        !hasVerifying &&
        !hasRecovering &&
        this.activeExecutions.size === 0
      ) {
        // 모든 작업 종료 — Mission 완료 처리
        console.log(`[MissionExecutionRuntime] Mission ${this.missionId} has no more work.`);
        this.pause();
      } else if (hasRecovering || retryWaitTasks.length > 0) {
        // Recovery 진행 중 또는 Retry 대기 — 2초 주기로 재확인
        this.requestTick(2000);
      } else if (hasVerifying) {
        // Verification 진행 중 — 500ms 주기
        this.requestTick(500);
      } else {
        // 일반 작업 중 — 1초 주기
        this.requestTick(1000);
      }

    } catch (error) {
      console.error(`[MissionExecutionRuntime] Error during tick:`, error);
      this.requestTick(5000); 
    } finally {
      this.isTicking = false;
    }
  }
}

