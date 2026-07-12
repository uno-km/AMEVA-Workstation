/**
 * @file orchestrator/task-runtime/mission/MissionExecutionRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role Mission 단위 실행 오케스트레이터 — Scheduling, Dispatch, Verification, Recovery, UserAssist, Checkpoint, Persistence 통합
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: Mission을 생성하고 start() 호출
 * - V2RuntimeFeatureFlag: V2 경로에서만 이 클래스가 사용됨
 *
 * [통합 컴포넌트 — Item 2: UserAssistRuntime ↔ MissionExecutionRuntime]
 * - UserAssistRuntime: WAITING_USER 상태 Task에 대해 Request 생성 및 응답 수신
 * - WAITING_USER Task는 tick에서 hasPendingOrReady 집계에 포함하지 않음 (사용자 응답 대기 중)
 * - UserAssistRuntime.respondToRequest() 호출 → READY 또는 CANCELLED 전이 → tick 재개
 *
 * [통합 컴포넌트 — Item 1: CheckpointRuntime]
 * - CheckpointRuntime: TaskDispatcher에 주입하여 DeepTaskExecutor에 전달
 *
 * [통합 컴포넌트 — Item 3: RuntimeRestoreCoordinator]
 * - RuntimeRestoreCoordinator: 앱 재시작 후 saveMissionState() 호출
 * - Mission 상태 변경 이벤트마다 영속화 (RUNNING, PAUSED, WAITING_USER, etc.)
 *
 * [정책]
 * - WAITING_USER Task가 있어도 Mission을 종료하지 않음 (사용자 응답 대기)
 * - WAITING_USER Task가 24시간 만료되면 Recovery 정책에 따라 FAILED 또는 CANCELLED 처리
 * - WAITING_USER Task에 대한 UserAssistRequest가 없으면 즉시 생성
 */

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
import { UserAssistRuntime } from '../assist/UserAssistRuntime';
import { CheckpointRuntime } from '../checkpoint/CheckpointRuntime';
import {
  RuntimeRestoreCoordinator,
} from '../persistence/RuntimeRestoreCoordinator';
import {
  InMemoryRuntimePersistenceAdapter,
  type IRuntimePersistenceAdapter,
} from '../persistence/RuntimePersistenceAdapter';

/*
 * [도메인 종속 지역 상수]
 */
/** WAITING_USER Task 만료 대기 시간 (24시간) */
const WAITING_USER_EXPIRY_MS = 24 * 60 * 60 * 1000;
/** WAITING_USER 상태일 때 tick 주기 (자주 확인 불필요) */
const WAITING_USER_TICK_MS = 30_000; // 30초

export class MissionExecutionRuntime {
  /*
   * [핵심 내부 서브시스템]
   */
  private ledger: MissionBudgetLedger;
  private leaseManager: TaskLeaseManager;
  private scheduler: TaskScheduler;
  private dispatcher: TaskDispatcher;
  private verificationRuntime: VerificationRuntime;
  private recoveryStore: RecoveryRequestStore;

  /*
   * [통합 컴포넌트]
   */
  private userAssistRuntime: UserAssistRuntime;
  private checkpointRuntime: CheckpointRuntime;
  private restoreCoordinator: RuntimeRestoreCoordinator;

  /*
   * [실행 제어 상태]
   */
  private abortController: AbortController = new AbortController();
  private isRunning: boolean = false;
  private isTicking: boolean = false;
  private isVerifying: boolean = false;
  private timerId?: ReturnType<typeof setTimeout>;
  private activeExecutions: Map<string, ExecutionHandle> = new Map();

  /*
   * [WAITING_USER 추적]
   * taskId → UserAssistRequest 생성 시각 (만료 감지용)
   */
  private waitingUserCreatedAt: Map<string, number> = new Map();

  private store: TaskRuntimeStore;
  private missionId: string;

  constructor(
    store: TaskRuntimeStore,
    adapter: ILLMEngineAdapter,
    missionId: string,
    initialBudget: number = 10000,
    /*
     * [DI — IRuntimePersistenceAdapter]
     * 영속화 어댑터를 주입하여 테스트에서 InMemory 폴백 사용 가능.
     * 프로덕션에서는 IndexedDBRuntimePersistenceAdapter 주입.
     */
    persistence?: IRuntimePersistenceAdapter
  ) {
    this.store = store;
    this.missionId = missionId;
    this.ledger = new MissionBudgetLedger(store);
    this.leaseManager = new TaskLeaseManager(store);
    this.recoveryStore = new RecoveryRequestStore();
    this.scheduler = new TaskScheduler(store, this.ledger, this.recoveryStore);
    this.verificationRuntime = new VerificationRuntime(
      store, this.recoveryStore, this.ledger, adapter
    );

    const catalog = new CapabilityCatalog();
    const resolver = new ExecutionStrategyResolver(catalog);
    this.checkpointRuntime = new CheckpointRuntime();
    this.userAssistRuntime = new UserAssistRuntime(store);
    this.dispatcher = new TaskDispatcher(
      store, this.leaseManager, this.ledger, resolver, adapter,
      this.checkpointRuntime // CheckpointRuntime 주입
    );

    /*
     * [Persistence 초기화]
     * 주입이 없으면 InMemory Adapter (테스트/Fallback).
     */
    const persistenceAdapter = persistence ?? new InMemoryRuntimePersistenceAdapter();
    this.restoreCoordinator = new RuntimeRestoreCoordinator(persistenceAdapter);
  }

  // ─── 공개 API ───────────────────────────────────────────────────────────

  /**
   * Mission 실행을 시작한다.
   * 중복 start() 호출은 무시된다.
   */
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

    // [Item 3] Mission 상태 영속화
    this.persistMissionState('RUNNING');

    this.requestTick();
  }

  /**
   * Mission을 일시 중단한다.
   */
  public pause(): void {
    this.isRunning = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.store.updateMissionState(this.missionId, { status: 'PAUSED', pausedAt: Date.now() });

    // [Item 3] 상태 영속화
    this.persistMissionState('PAUSED');

    // [Item 5] Mission 종료 직후 비중요 이벤트 압축
    const removedCount = this.store.compactEventLogForMission(this.missionId);
    if (removedCount > 0) {
      console.debug(`[MissionExecutionRuntime] EventLog compacted: ${removedCount} events removed for mission ${this.missionId}.`);
    }
  }

  /**
   * Mission을 취소한다.
   */
  public cancel(reason: string): void {
    this.isRunning = false;
    if (this.timerId) clearTimeout(this.timerId);

    this.abortController.abort(reason);

    for (const handle of this.activeExecutions.values()) {
      handle.abortController.abort(reason);
    }

    this.store.updateMissionState(this.missionId, {
      status: 'CANCELLED',
      cancellationReason: reason
    });

    // [Item 3] 상태 영속화
    this.persistMissionState('CANCELLED');

    // [Item 5] 취소 직후 비중요 이벤트 압축
    const removedCount = this.store.compactEventLogForMission(this.missionId);
    if (removedCount > 0) {
      console.debug(`[MissionExecutionRuntime] EventLog compacted on cancel: ${removedCount} events removed.`);
    }

    // [Item 2] UserAssist 정리
    this.userAssistRuntime.dispose();
  }

  /**
   * UserAssistRuntime을 반환한다.
   * UI Layer에서 Request 목록을 구독하고 응답을 제출할 때 사용.
   */
  public getUserAssistRuntime(): UserAssistRuntime {
    return this.userAssistRuntime;
  }

  /**
   * CheckpointRuntime을 반환한다.
   * 외부에서 Resume 요청 시 사용.
   */
  public getCheckpointRuntime(): CheckpointRuntime {
    return this.checkpointRuntime;
  }

  // ─── 내부 tick 루프 ────────────────────────────────────────────────────

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

      // 2. 스케줄링 패스 (PENDING → READY 승격 및 예산 할당)
      const { newlyReadyCount, deadlockType } = this.scheduler.runSchedulingPass(this.missionId);

      // 3. 데드락 처리
      if (deadlockType === 'TRUE_DEADLOCK' || deadlockType === 'INTERNAL_ERROR') {
        console.error(`[MissionExecutionRuntime] Fatal Deadlock detected: ${deadlockType}`);
        this.store.updateMissionState(this.missionId, {
          status: 'FAILED',
          cancellationReason: deadlockType
        });
        this.cancel(`Deadlock detected: ${deadlockType}`);
        this.isTicking = false;
        return;
      } else if (deadlockType !== null) {
        console.debug(`[MissionExecutionRuntime] Scheduling blocked by: ${deadlockType}`);
      }

      // 4. 새로 준비된 Task를 Dispatch
      let allTasks = this.store.getAllTasks(this.missionId);
      const readyTasks = allTasks.filter(t => t.state.status === 'READY');

      for (const task of readyTasks) {
        const handle = this.dispatcher.dispatchTask(
          this.missionId,
          task.definition.id,
          this.abortController.signal
        );
        if (handle) {
          this.activeExecutions.set(handle.executionId, handle);

          handle.promise.then(() => {
            handle.status = 'COMPLETED';
            this.activeExecutions.delete(handle.executionId);
            this.requestTick(100); // 완료 직후 즉시 다음 tick
          }).catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[MissionExecutionRuntime] Unhandled executor rejection:`, errMsg);
            handle.status = 'FAILED';
            this.activeExecutions.delete(handle.executionId);
          });
        }
      }

      // 5. 완료 여부 집계
      allTasks = this.store.getAllTasks(this.missionId);
      const hasPendingOrReady = allTasks.some(t =>
        t.state.status === 'PENDING' || t.state.status === 'READY' || t.state.status === 'RETRY_WAIT'
      );
      const hasVerifying = allTasks.some(t => t.state.status === 'VERIFYING');
      const hasRunning = allTasks.some(t => t.state.status === 'RUNNING');

      /*
       * [Critical 0-B Fix — RETRY_WAIT → READY]
       * State Machine ALLOWED_TRANSITIONS: RETRY_WAIT: ['READY', 'FAILED', 'WAITING_USER', 'CANCELLED']
       * RETRY_WAIT → PENDING은 허용되지 않음. 올바른 전이는 RETRY_WAIT → READY.
       */
      const retryWaitTasks = allTasks.filter(t => t.state.status === 'RETRY_WAIT');
      for (const task of retryWaitTasks) {
        const retryAfter = task.state.retryAfter ?? 0;
        if (retryAfter > 0 && Date.now() >= retryAfter) {
          try {
            this.store.dispatchTransition(
              {
                commandId: `cmd-retry-resume-${crypto.randomUUID()}`,
                missionId: this.missionId,
                taskId: task.definition.id,
                expectedCurrentStatus: 'RETRY_WAIT',
                expectedStateVersion: task.state.stateVersion,
                reason: `Retry wait expired at ${new Date(retryAfter).toISOString()}.`,
                actor: 'MissionExecutionRuntime',
                timestamp: Date.now()
              },
              'READY',
              { retryAfter: undefined }
            );
          } catch (transitionErr: unknown) {
            const msg = transitionErr instanceof Error ? transitionErr.message : String(transitionErr);
            console.warn(`[MissionExecutionRuntime] RETRY_WAIT→READY 실패 (Task ${task.definition.id}):`, msg);
          }
        }
      }

      // 6. [Item 2] WAITING_USER Task 처리
      const waitingUserTasks = allTasks.filter(t => t.state.status === 'WAITING_USER');
      const hasWaitingUser = waitingUserTasks.length > 0;

      for (const task of waitingUserTasks) {
        // UserAssistRequest 없으면 즉시 생성
        const existingRequest = this.userAssistRuntime.getPendingRequest(task.definition.id);
        if (!existingRequest) {
          const createdAt = this.waitingUserCreatedAt.get(task.definition.id) ?? Date.now();
          this.waitingUserCreatedAt.set(task.definition.id, createdAt);

          this.userAssistRuntime.createRequest({
            missionId: this.missionId,
            taskId: task.definition.id,
            attemptId: task.state.activeAttemptId ?? 'unknown',
            title: `Task 실행 실패: ${task.definition.title ?? task.definition.id}`,
            summary: `Task "${task.definition.id}"가 자동 복구에 실패하여 사용자 개입이 필요합니다.`,
            failureReason: task.state.lastFailure?.message ?? '알 수 없는 오류',
            completedWork: task.state.taskResult?.outputs
              ? JSON.stringify(task.state.taskResult.outputs).slice(0, 200)
              : '(없음)',
            missingWork: task.definition.acceptanceCriteria?.join('\n') ?? '(명세 없음)',
            availableCheckpointId: this.checkpointRuntime.getLatestCheckpoint(task.definition.id)?.checkpointId,
            recoveryAttempts: Object.keys(task.state.attempts).length,
            isTaskRequired: task.definition.required !== false
          });

          // [Item 3] WAITING_USER 상태 영속화
          this.persistMissionState('WAITING_USER');
        }

        // WAITING_USER 만료 감지 (24시간)
        const waitStart = this.waitingUserCreatedAt.get(task.definition.id) ?? Date.now();
        if (Date.now() - waitStart > 86400000) {
          console.warn(`[MissionExecutionRuntime] WAITING_USER Task ${task.definition.id} expired after 24h. Transitioning to FAILED.`);
          try {
            this.store.dispatchTransition(
              {
                commandId: `cmd-ua-expire-${crypto.randomUUID()}`,
                missionId: this.missionId,
                taskId: task.definition.id,
                expectedCurrentStatus: 'WAITING_USER',
                expectedStateVersion: task.state.stateVersion,
                reason: 'User assist request expired after 24 hours with no response.',
                actor: 'MissionExecutionRuntime',
                timestamp: Date.now()
              },
              'FAILED'
            );
          } catch (expireErr: unknown) {
            const msg = expireErr instanceof Error ? expireErr.message : String(expireErr);
            console.error(`[MissionExecutionRuntime] WAITING_USER 만료 전이 실패:`, msg);
          }
          this.waitingUserCreatedAt.delete(task.definition.id);
        }
      }

      // 7. Verification 처리
      if (hasVerifying && !this.isVerifying) {
        this.isVerifying = true;
        this.verificationRuntime.processVerifyingTasks(this.missionId)
          .then(results => {
            if (results.length > 0) {
              console.log(`[MissionExecutionRuntime] Processed ${results.length} verifications.`);
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

      // 8. 종료/tick 주기 결정
      if (
        !hasPendingOrReady &&
        !hasVerifying &&
        !hasRunning &&
        !hasWaitingUser &&
        this.activeExecutions.size === 0
      ) {
        // 모든 작업 종료 — Mission 완료
        console.log(`[MissionExecutionRuntime] Mission ${this.missionId} has no more work.`);
        this.pause();
      } else if (hasWaitingUser) {
        // WAITING_USER 존재 — 30초 주기로 만료만 체크
        this.requestTick(30000);
      } else if (retryWaitTasks.length > 0) {
        // Recovery/Retry — 2초 주기
        this.requestTick(2000);
      } else if (hasVerifying) {
        // Verification — 500ms 주기
        this.requestTick(500);
      } else {
        // 일반 실행 — 1초 주기
        this.requestTick(1000);
      }

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[MissionExecutionRuntime] Error during tick:`, msg);
      this.requestTick(5000);
    } finally {
      this.isTicking = false;
    }
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────────

  /**
   * [Item 3] Mission 상태를 RuntimeRestoreCoordinator에 비동기 영속화.
   * 저장 실패는 경고만 남기고 Runtime을 중단하지 않는다 (Best-effort).
   */
  private persistMissionState(status: string): void {
    const allTasks = this.store.getAllTasks(this.missionId);
    const taskIds = allTasks.map(t => t.definition.id);
    this.restoreCoordinator.saveMissionState(this.missionId, {
      missionId: this.missionId,
      status,
      taskIds
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[MissionExecutionRuntime] Mission 상태 영속화 실패 (${this.missionId}):`, msg);
    });
  }
}
