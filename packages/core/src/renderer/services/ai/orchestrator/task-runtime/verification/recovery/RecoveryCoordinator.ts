/**
 * @file orchestrator/task-runtime/verification/recovery/RecoveryCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 결과(Verdict)를 바탕으로 구체적인 복구 전략(Recovery Decision)을 수립 및 실행
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { RecoveryRequestStore } from './RecoveryRequestStore';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';
import type { TaskVerificationResult } from '../domain/VerificationTypes';
import type { TaskRecoveryRequest, RecoveryDecision } from '../domain/RecoveryTypes';

export class RecoveryCoordinator {
  private store: TaskRuntimeStore;
  private recoveryStore: RecoveryRequestStore;
  private ledger: MissionBudgetLedger;
  constructor(
    store: TaskRuntimeStore,
    recoveryStore: RecoveryRequestStore,
    ledger: MissionBudgetLedger
  ) {
    this.store = store;
    this.recoveryStore = recoveryStore;
    this.ledger = ledger;
  }

  /**
   * Verification Verdict에 따라 초기 Recovery Request를 생성하고 Decision을 결정합니다.
   */
  public handleVerificationFailure(verification: TaskVerificationResult): void {
    const { verdict, missionId, taskId, attemptId, repairInstructions, failedCriteria } = verification;
    
    if (verdict === 'PASS') {
      // PASS는 Recovery 대상이 아님
      return;
    }

    const task = this.store.getTask(missionId, taskId);

    // 1. Recovery Request 생성
    const recoveryRequestId = `rec-${crypto.randomUUID()}`;
    const request: TaskRecoveryRequest = {
      recoveryRequestId,
      missionId,
      taskId,
      planId: verification.planId,
      planVersion: verification.planVersion,
      sourceAttemptId: attemptId,
      failureReason: `Verification failed with verdict: ${verdict}`,
      failedCriteria,
      repairInstructions,
      status: 'PENDING',
      retryCount: task.state.retries,
      recoveryCount: 0, // 해당 시도에서 연속으로 발생한 횟수 추적이 필요할 수 있으나 간략화
      createdAt: Date.now()
    };
    
    this.recoveryStore.addRequest(request);

    // 2. Recovery Decision 수립 (Recovery Ladder)
    // - Level 1: Repair (NEEDS_REPAIR)
    // - Level 2: Retry Same Strategy (RETRY)
    // - Level 3: Retry Different Strategy (여러 번 실패 시)
    // - Level 4: Fail / Blocked
    const decision = this.createDecision(request, verification);

    // 3. 결정에 따른 상태 변경 전파
    this.executeDecision(request, decision);
  }

  private createDecision(request: TaskRecoveryRequest, verification: TaskVerificationResult): RecoveryDecision {
    const decision: RecoveryDecision = {
      decisionId: `dec-${crypto.randomUUID()}`,
      recoveryRequestId: request.recoveryRequestId,
      missionId: request.missionId,
      taskId: request.taskId,
      sourceAttemptId: request.sourceAttemptId,
      action: 'FAIL_REQUIRED_TASK',
      reason: 'Default fallback',
      retryBudgetCost: 0,
      recoveryBudgetCost: 0,
      createdAt: Date.now()
    };

    if (verification.verdict === 'NEEDS_REPAIR') {
      decision.action = 'REPAIR_RESULT';
      decision.reason = 'Repair hints available from verification';
      decision.repairScope = request.failedCriteria;
      decision.recoveryBudgetCost = 1; 
    } else if (verification.verdict === 'RETRY') {
      // 만약 재시도 예산이 남아있다면
      const availableBudget = this.ledger.getAvailableBudget(request.missionId);
      if (availableBudget > 0 && request.retryCount < 3) {
        decision.action = 'RETRY_SAME_STRATEGY';
        decision.reason = 'Verifer requested retry, and budget allows it';
        decision.retryBudgetCost = 1;
      } else {
        decision.action = 'FAIL_REQUIRED_TASK';
        decision.reason = 'Retry limits or budget exhausted';
      }
    } else if (verification.verdict === 'BLOCKED' || verification.verdict === 'NEEDS_USER') {
      decision.action = 'WAIT_FOR_USER';
      decision.reason = 'Requires user intervention or missing capability';
      decision.userPrompt = verification.warnings.join('\n');
    } else {
      decision.action = 'FAIL_REQUIRED_TASK';
      decision.reason = 'Unrecoverable failure verdict';
    }

    return decision;
  }

  private executeDecision(request: TaskRecoveryRequest, decision: RecoveryDecision): void {
    try {
      this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'DIAGNOSING');

      // 예산 소진
      if (decision.recoveryBudgetCost > 0 || decision.retryBudgetCost > 0) {
        // [TODO] Ledger에 명시적 Recovery/Retry 비용 차감 (현재 Ledger API에 맞춤 필요)
        // this.ledger.consumeRecoveryBudget(request.missionId, decision.recoveryBudgetCost);
      }

      // 상태 전이
      if (decision.action === 'REPAIR_RESULT' || decision.action === 'RETRY_SAME_STRATEGY') {
        // 재시도를 위해 상태를 RETRY_WAIT으로 변경 (이후 Scheduler가 다시 READY로 승격)
        this.store.dispatchTransition(
          {
            commandId: `cmd-rec-${crypto.randomUUID()}`,
            missionId: decision.missionId,
            taskId: decision.taskId,
            expectedCurrentStatus: 'VERIFYING',
            expectedStateVersion: this.store.getTask(decision.missionId, decision.taskId).state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now(),
            metadata: { decision }
          },
          'RETRY_WAIT',
          {
            retries: request.retryCount + 1,
            /*
             * [STAGE E] retryAfter 설정 — Recovery 폐루프 완성
             * MissionExecutionRuntime.tick()이 이 값을 확인하여
             * 대기 만료 시 PENDING으로 전이하고 재실행을 트리거합니다.
             * 기본 재시도 대기 시간: 30초 (회복 예산 초과 방지)
             */
            retryAfter: Date.now() + 30_000
          }
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'RESOLVED');
      } 
      else if (decision.action === 'WAIT_FOR_USER') {
        this.store.dispatchTransition(
          {
            commandId: `cmd-rec-${crypto.randomUUID()}`,
            missionId: decision.missionId,
            taskId: decision.taskId,
            expectedCurrentStatus: 'VERIFYING',
            expectedStateVersion: this.store.getTask(decision.missionId, decision.taskId).state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now()
          },
          'WAITING_USER'
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'WAITING_USER');
      } 
      else { // FAIL_REQUIRED_TASK 등
        this.store.dispatchTransition(
          {
            commandId: `cmd-rec-${crypto.randomUUID()}`,
            missionId: decision.missionId,
            taskId: decision.taskId,
            expectedCurrentStatus: 'VERIFYING',
            expectedStateVersion: this.store.getTask(decision.missionId, decision.taskId).state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now()
          },
          'FAILED',
          { lastFailure: { errorType: 'VerificationFailed', message: decision.reason, timestamp: Date.now() } }
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'FAILED');
      }
    } catch (e: any) {
      console.error(`[RecoveryCoordinator] Failed to execute decision for task ${decision.taskId}:`, e);
      this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'FAILED', e.message);
    }
  }
}
