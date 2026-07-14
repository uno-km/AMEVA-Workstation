import { describe, it, expect, vi } from 'vitest';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { TaskEventLog } from '../../events/TaskEventLog';
import { RecoveryRequestStore } from '../../verification/recovery/RecoveryRequestStore';
import { RecoveryCoordinator } from '../../verification/recovery/RecoveryCoordinator';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';
import type { TaskVerificationResult } from '../../verification/domain/VerificationTypes';

describe('Phase 3 Retry Convergence Integration', () => {
  it('detects no progress when same defects occur without hash/score changes', () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const recoveryStore = new RecoveryRequestStore();
    const ledger = new MissionBudgetLedger(store);
    const coordinator = new RecoveryCoordinator(store, recoveryStore, ledger);

    const missionId = 'm1';
    const taskId = 't1';

    store.initMission(missionId, {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 10000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 10, consumedRecoveries: 0
    });

    store.registerTask({
      definition: { id: taskId, title: 'T1', dependencies: [] },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        activeAttemptId: 'a1',
        attempts: { 'a1': { attemptId: 'a1', taskId, status: 'VERIFYING', reasoningTurns: 0, toolCallCount: 0, recoveryCount: 0, sequence: 0 } },
        retries: 0,
        sameDefectRepeatCount: 1,
        createdAt: Date.now(),
        // Setup past failures with SAME score and hash
        previousFailures: [
          {
            errorType: 'VerificationFailed',
            message: 'First fail',
            timestamp: Date.now() - 1000,
            contentHash: 'hash1',
            semanticScore: 0.5,
            retryScope: 'SECTION',
            defectSignatures: ['SEMANTIC:SEMANTIC_INCONSISTENCY:unknown:c1']
          },
          {
            errorType: 'VerificationFailed',
            message: 'Second fail',
            timestamp: Date.now() - 500,
            contentHash: 'hash1',
            semanticScore: 0.5,
            retryScope: 'SECTION',
            defectSignatures: ['SEMANTIC:SEMANTIC_INCONSISTENCY:unknown:c1']
          }
        ]
      }
    } as any, missionId);

    const result: TaskVerificationResult = {
      verificationId: 'v1', verificationJobId: 'vj1', missionId, taskId, attemptId: 'a1', executionId: 'e1', resultId: 'r1',
      verdict: 'NEEDS_REPAIR',
      retryScope: 'SECTION',
      criterionResults: [], passedCriteria: [], failedCriteria: ['c1'], warnings: [],
      repairInstructions: 'fix', verifierTypes: [], verifierVersions: [], createdAt: Date.now(), idempotencyKey: 'id1',
      contentHash: 'hash1',
      semanticScore: 0.5,
      defects: [
        {
          defectId: 'd1', stage: 'SEMANTIC', type: 'SEMANTIC_INCONSISTENCY', severity: 'MEDIUM',
          required: true, message: 'fail', signature: 'SEMANTIC:SEMANTIC_INCONSISTENCY:unknown:c1'
        }
      ]
    };

    coordinator.handleVerificationFailure(result);

    const requests = recoveryStore.getRequestsForMission(missionId);
    expect(requests.length).toBe(1);

    const updatedTask = store.getTask(missionId, taskId);
    
    // Should transition to WAITING_USER because NO_PROGRESS detected
    expect(updatedTask.state.status).toBe('WAITING_USER');
  });
});
