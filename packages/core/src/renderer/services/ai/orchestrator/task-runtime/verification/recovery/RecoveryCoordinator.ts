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
      contentHash: verification.contentHash,
      semanticScore: verification.semanticScore,
      contractCoverage: verification.contractCoverage,
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

    // Check No Progress using Delta
    let isNoProgress = false;
    let repeatedDefectCount = 0;
    
    let artifactHashChanged = false;
    let contractCoverageDelta = 0;
    let semanticScoreDelta = 0;
    let resolvedDefectCount = 0;
    let newDefectCount = 0;
    let repeatedRequiredDefectCount = 0;

    const currentSignatures = requiredDefects.map(d => d.signature);
    const currentHash = verification.contentHash;
    const currentScore = verification.semanticScore || 0;
    const currentCoverage = verification.contractCoverage || 0;

    if (task.state.previousFailures && task.state.previousFailures.length > 0) {
      const previousFailures = task.state.previousFailures;
      const lastFailure = previousFailures[previousFailures.length - 1];

      if (lastFailure.errorType === 'VerificationFailed') {
        const lastSignatures = lastFailure.defectSignatures || [];
        const lastHash = lastFailure.contentHash;
        const lastScore = lastFailure.semanticScore || 0;
        const lastCoverage = lastFailure.contractCoverage || 0;

        artifactHashChanged = currentHash !== undefined && currentHash !== lastHash;
        contractCoverageDelta = currentCoverage - lastCoverage;
        semanticScoreDelta = currentScore - lastScore;

        const repeatedSignatures = currentSignatures.filter(sig => lastSignatures.includes(sig));
        repeatedRequiredDefectCount = repeatedSignatures.length;
        repeatedDefectCount = repeatedRequiredDefectCount; 

        resolvedDefectCount = lastSignatures.filter((sig: string) => !currentSignatures.includes(sig)).length;
        newDefectCount = currentSignatures.filter(sig => !lastSignatures.includes(sig)).length;

        const noMeaningfulImprovement = (contractCoverageDelta <= 0 && semanticScoreDelta <= 0 && resolvedDefectCount === 0);
        
        const sameScope = lastFailure.retryScope === verification.retryScope;
        
        if (repeatedRequiredDefectCount > 0 && sameScope) {
           if (!artifactHashChanged) {
             isNoProgress = true;
           } else if (noMeaningfulImprovement) {
             isNoProgress = true;
           }
        }

        if (isNoProgress) {
           repeatedDefectCount = (task.state.sameDefectRepeatCount || 0) + 1;
        } else {
           repeatedDefectCount = 0;
        }
      }
    }

    request.progressDelta = {
      previousArtifactHash: task.state.previousFailures?.[task.state.previousFailures.length - 1]?.contentHash,
      currentArtifactHash: currentHash,
      artifactHashChanged,
      previousContractCoverage: task.state.previousFailures?.[task.state.previousFailures.length - 1]?.contractCoverage,
      currentContractCoverage: currentCoverage,
      contractCoverageDelta,
      previousSemanticScore: task.state.previousFailures?.[task.state.previousFailures.length - 1]?.semanticScore,
      currentSemanticScore: currentScore,
      semanticScoreDelta,
      resolvedDefectCount,
      newDefectCount,
      repeatedDefectCount,
      repeatedRequiredDefectCount
    };

    const hasCriticFailure = requiredDefects.some(d => d.type === 'CRITIC_RESPONSE_INVALID' || d.type === 'CRITIC_UNAVAILABLE');

    if (verification.verdict === 'NEEDS_REPAIR' || verification.verdict === 'RETRY') {
      const availableRetries = (task.state.maxExecutionRetries || 3) - (task.state.executionRetryCount || 0);
      const availableCriticRetries = (task.state.maxSemanticCriticCalls || 3) - (task.state.semanticCriticCallCount || 0);
      
      if (hasCriticFailure) {
        if (availableCriticRetries <= 0) {
          decision.action = 'FAIL_REQUIRED_TASK';
          decision.reason = 'Semantic critic budget exhausted';
        } else {
          decision.action = 'REVERIFY_RESULT';
          decision.reason = 'Critic parsing failed or unavailable. Retrying verification.';
          decision.recoveryBudgetCost = 1;
        }
      } else if (isNoProgress) {
        decision.action = 'WAIT_FOR_USER';
        decision.reason = 'No progress detected (same defects remain without improvement)';
        decision.userPrompt = 'No progress detected across multiple retries.';
      } else if (availableRetries <= 0) {
        decision.action = 'FAIL_REQUIRED_TASK';
        decision.reason = 'Retry budget exhausted';
      } else {
        decision.action = verification.verdict === 'NEEDS_REPAIR' ? 'REPAIR_RESULT' : 'RETRY_SAME_STRATEGY';
        decision.reason = 'Repairing verification defects';
        decision.retryBudgetCost = 1;
        decision.repairScope = [verification.retryScope || 'FULL_TASK'];
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
        defectSignatures: request.defectSignatures || [],
        contentHash: request.contentHash,
        semanticScore: request.semanticScore,
        contractCoverage: request.contractCoverage,
        retryScope: request.retryScope
      };

      if (decision.action === 'REPAIR_RESULT' || decision.action === 'RETRY_SAME_STRATEGY') {
        const sameDefectRepeatCount = request.progressDelta?.repeatedDefectCount || 0;
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
            sameDefectRepeatCount,
            previousFailures: [...previousFailures, newFailure],
            retryAfter: Date.now() + 30_000
          }
        );
        this.recoveryStore.updateRequestStatus(request.recoveryRequestId, 'RESOLVED');
      } else if (decision.action === 'REVERIFY_RESULT') {
        const semanticCriticCallCount = (task.state.semanticCriticCallCount || 0) + decision.recoveryBudgetCost;
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
          'VERIFYING',
          {
            semanticCriticCallCount,
            previousFailures: [...previousFailures, newFailure],
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
            sameDefectRepeatCount: request.progressDelta?.repeatedDefectCount || 0,
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
