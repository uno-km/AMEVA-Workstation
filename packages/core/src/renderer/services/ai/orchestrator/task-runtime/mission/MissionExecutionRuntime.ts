/**
 * @file orchestrator/task-runtime/mission/MissionExecutionRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role V2(PHASE 3) 미션 실행의 전반적인 생명주기를 관장하는 최상위 런타임 매니저
 */

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { TaskScheduler } from '../scheduling/TaskScheduler';
import { TaskDispatcher } from '../dispatch/TaskDispatcher';
import { CapabilityCatalog } from '../dispatch/CapabilityCatalog';
import { ExecutionStrategyResolver } from '../dispatch/ExecutionStrategyResolver';
import type { ILLMEngineAdapter } from '../../types';

export class MissionExecutionRuntime {
  private ledger: MissionBudgetLedger;
  private leaseManager: TaskLeaseManager;
  private scheduler: TaskScheduler;
  private dispatcher: TaskDispatcher;
  
  private abortController: AbortController = new AbortController();
  private isRunning: boolean = false;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(
    private store: TaskRuntimeStore,
    private adapter: ILLMEngineAdapter,
    private missionId: string,
    private initialBudget: number = 10000 // PHASE 3 원칙: 미션 당 1만 턴 제한
  ) {
    this.ledger = new MissionBudgetLedger(store);
    this.leaseManager = new TaskLeaseManager(store);
    this.scheduler = new TaskScheduler(store, this.ledger);
    
    const catalog = new CapabilityCatalog();
    const resolver = new ExecutionStrategyResolver(catalog);
    this.dispatcher = new TaskDispatcher(store, this.leaseManager, this.ledger, resolver, adapter);
  }

  /**
   * 미션 실행 환경을 초기화하고 비동기 루프를 기동합니다.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Mission 상태 초기화
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

    // 스케줄링 틱 루프 기동 (예: 1000ms마다 한 번)
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * 미션 일시 정지 (스케줄링 루프 중단, 진행 중인 Task는 Abort 하지 않음)
   */
  public pause(): void {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.store.updateMissionState(this.missionId, { status: 'PAUSED', pausedAt: Date.now() });
  }

  /**
   * 미션 완전 취소 (진행 중인 모든 Task Abort)
   */
  public cancel(reason: string): void {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.abortController.abort(reason);
    this.store.updateMissionState(this.missionId, { status: 'CANCELLED', cancellationReason: reason });
  }

  /**
   * 내부 스케줄링 메인 루프 (1 tick)
   */
  private tick(): void {
    if (!this.isRunning || this.abortController.signal.aborted) return;

    try {
      // 1. 만료된 Lease 청소 (타임아웃 감지)
      const expiredTasks = this.leaseManager.sweepExpiredLeases();
      if (expiredTasks.length > 0) {
        console.warn(`[MissionExecutionRuntime] Swept expired leases for: ${expiredTasks.join(', ')}`);
        // 필요 시 FAILED 처리 또는 RETRY_WAIT 처리 가능
      }

      // 2. 스케줄링 패스 (PENDING -> READY 승격 및 예산 할당)
      const { newlyReadyCount, isDeadlocked } = this.scheduler.runSchedulingPass(this.missionId);

      // 3. 데드락 처리
      if (isDeadlocked) {
        console.error(`[MissionExecutionRuntime] Deadlock detected for mission ${this.missionId}.`);
        this.store.updateMissionState(this.missionId, { status: 'FAILED' });
        this.cancel('Deadlock detected in TaskScheduler');
        return;
      }

      // 4. 새로 준비되었거나 기존에 READY 상태인 태스크들을 Dispatch
      const allTasks = this.store.getAllTasks(this.missionId);
      const readyTasks = allTasks.filter(t => t.state.status === 'READY');

      for (const task of readyTasks) {
        // Dispatcher 내부에서 락 획득 시도 후 비동기 Executor를 실행함
        this.dispatcher.dispatchTask(this.missionId, task.definition.id, this.abortController.signal);
      }

      // 5. 완료 여부 검사
      const pendingOrRunning = allTasks.filter(t => 
        t.state.status !== 'COMPLETED' && 
        t.state.status !== 'FAILED' && 
        t.state.status !== 'CANCELLED' &&
        t.state.status !== 'SKIPPED'
      );

      if (pendingOrRunning.length === 0) {
        console.log(`[MissionExecutionRuntime] Mission ${this.missionId} finished.`);
        this.store.updateMissionState(this.missionId, { status: 'COMPLETED', completedAt: Date.now() });
        this.pause(); // 루프 종료
      }

    } catch (error) {
      console.error(`[MissionExecutionRuntime] Error during tick:`, error);
      // 루프 내 에러는 치명적일 수 있으므로 로깅만 하거나 임계치 이상 시 FAILED로 전이
    }
  }
}
