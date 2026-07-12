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
    this.verificationRuntime = new VerificationRuntime(store, this.recoveryStore, this.ledger);
    
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

      // 5. 완료 여부 검사 로직 (Phase 3.5 -> 4.0 연동)
      const hasPendingOrReady = allTasks.some(t => t.state.status === 'PENDING' || t.state.status === 'READY' || t.state.status === 'RETRY_WAIT');
      const hasVerifying = allTasks.some(t => t.state.status === 'VERIFYING');

      // VERIFYING이 있으면 VerificationRuntime을 동기적으로 호출하여 신속 검증
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

      if (!hasPendingOrReady && this.activeExecutions.size === 0) {
        if (hasVerifying) {
          this.requestTick(2000); 
        } else {
          // Phase 5를 위한 완료 모드 대기
          console.log(`[MissionExecutionRuntime] Mission ${this.missionId} has no more work.`);
          this.pause(); 
        }
      } else {
        this.requestTick(hasVerifying ? 500 : 1000);
      }

    } catch (error) {
      console.error(`[MissionExecutionRuntime] Error during tick:`, error);
      this.requestTick(5000); 
    } finally {
      this.isTicking = false;
    }
  }
}

