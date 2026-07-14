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

  public handleVerificationFailure(verification: TaskVerificationResult): void {
    const { verdict, missionId, taskId, attemptId, repairInstructions, failedCriteria, defects, retryScope } = verification;
    
    if (verdict === 'PASS') {
      return;
    }

    const task = this.store.getTask(missionId, taskId);

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
      defectSignatures: defects?.map(d => d.signature),
      retryScope,
      repairInstructions,
      status: 'PENDING',
      retryCount: task.state.retries,
      recoveryCount: task.state.repairAttemptCount || 0,
      createdAt: Date.now()
    };
    
    this.recoveryStore.addRequest(request);

    const decision = this.createDecision(request, verification);

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

    const task = this.store.getTask(request.missionId, request.taskId);
    const requiredDefects = verification.defects?.filter(d => d.required) || [];
    const optionalDefects = verification.defects?.filter(d => !d.required) || [];

    // Check No Progress
    let isNoProgress = false;
    let repeatedDefectCount = 0;
    const currentSignatures = requiredDefects.map(d => d.signature);
    
    if (task.state.previousFailures && task.state.previousFailures.length > 0) {
      const lastFailure = task.state.previousFailures[task.state.previousFailures.length - 1];
      if (lastFailure.type === 'VerificationFailed' && lastFailure.defectSignatures) {
        // Compare signatures
        const prevSignatures: string[] = lastFailure.defectSignatures;
        repeatedDefectCount = currentSignatures.filter(s => prevSignatures.includes(s)).length;
        
        if (repeatedDefectCount > 0 && currentSignatures.length >= prevSignatures.length) {
          isNoProgress = true; // Same or more defects, and at least one is repeated
        }
      }
    }

    if (verification.verdict === 'NEEDS_REPAIR' || verification.verdict === 'RETRY') {
      const availableRetries = (task.state.maxExecutionRetries || 3) - (task.state.executionRetryCount || 0);
      
      if (isNoProgress && repeatedDefectCount >= 2) {
        decision.action = 'WAIT_FOR_USER';
        decision.reason = 'NO_PROGRESS detected with repeated required defects.';
        decision.userPrompt = 'The same defects are occurring. Please intervene.';
      } else if (availableRetries > 0) {
        decision.action = verification.verdict === 'NEEDS_REPAIR' ? 'REPAIR_RESULT' : 'RETRY_SAME_STRATEGY';
        decision.reason = 'Budget allows retry';
        decision.retryBudgetCost = 1;
        decision.repairScope = [verification.retryScope || 'FULL_TASK'];
      } else {
        decision.action = 'FAIL_REQUIRED_TASK';
        decision.reason = 'Retry budget exhausted';
      }
    } else if (verification.verdict === 'BLOCKED' || verification.verdict === 'NEEDS_USER' || verification.verdict === 'WAITING_USER') {
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

      const task = this.store.getTask(decision.missionId, decision.taskId);
      const executionRetryCount = (task.state.executionRetryCount || 0) + decision.retryBudgetCost;
      const previousFailures = task.state.previousFailures || [];
      const newFailure = {
        errorType: 'VerificationFailed',
        message: decision.reason,
        timestamp: Date.now(),
        defectSignatures: request.defectSignatures || []
      };

      if (decision.action === 'REPAIR_RESULT' || decision.action === 'RETRY_SAME_STRATEGY') {
        this.store.dispatchTransition(
          {
            commandId: `cmd-rec-${crypto.randomUUID()}`,
            missionId: decision.missionId,
            taskId: decision.taskId,
            expectedCurrentStatus: 'VERIFYING',
            expectedStateVersion: task.state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now(),
            metadata: { decision }
          },
          'RETRY_WAIT',
          {
            retries: request.retryCount + 1,
            executionRetryCount,
            previousFailures: [...previousFailures, newFailure],
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
            expectedStateVersion: task.state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now()
          },
          'WAITING_USER',
          {
            executionRetryCount,
            previousFailures: [...previousFailures, newFailure],
          }
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'WAITING_USER');
      } 
      else { 
        this.store.dispatchTransition(
          {
            commandId: `cmd-rec-${crypto.randomUUID()}`,
            missionId: decision.missionId,
            taskId: decision.taskId,
            expectedCurrentStatus: 'VERIFYING',
            expectedStateVersion: task.state.stateVersion,
            reason: decision.reason,
            actor: 'RecoveryCoordinator',
            timestamp: Date.now()
          },
          'FAILED',
          { 
            lastFailure: newFailure,
            executionRetryCount,
            previousFailures: [...previousFailures, newFailure],
          }
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'FAILED');
      }
    } catch (e: any) {
      console.error(`[RecoveryCoordinator] Failed to execute decision for task ${decision.taskId}:`, e);
      this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'FAILED', e.message);
    }
  }
}
