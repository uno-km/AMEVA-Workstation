import { describe, it } from 'vitest';
import * as assert from 'node:assert';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import { RecoveryRequestStore } from '../verification/recovery/RecoveryRequestStore';
import { RecoveryCoordinator } from '../verification/recovery/RecoveryCoordinator';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import type { TaskVerificationResult } from '../verification/domain/VerificationTypes';
import type { TaskEntity } from '../domain/types';

describe('Phase 4 Recovery Pipeline', () => {
  it('should handle NEEDS_REPAIR verdict by transitioning task to RETRY_WAIT', () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const recoveryStore = new RecoveryRequestStore();
    const ledger = new MissionBudgetLedger(store);
    const coordinator = new RecoveryCoordinator(store, recoveryStore, ledger);

    const missionId = 'm-rec';
    const taskId = 't-fail';

    // Mock Task in VERIFYING state
    const task: TaskEntity = {
      definition: {
        id: taskId,
        title: 'Failing Task',
        objective: 'Test recovery',
        dependencies: [],
      },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        activeAttemptId: 'att-1',
        attempts: {
          'att-1': {
            attemptId: 'att-1',
            taskId,
            sequence: 0,
            status: 'VERIFYING',
            reasoningTurns: 1,
            toolCallCount: 0,
            recoveryCount: 0,
          }
        },
        retries: 0,
        createdAt: Date.now()
      }
    };
    
    store.initMission(missionId, {
      maxReasoningTurns: 100,
      consumedReasoningTurns: 0,
      reservedReasoningTurns: 0,
      maxDurationMs: 3600000,
      consumedDurationMs: 0,
      maxToolCalls: 100,
      consumedToolCalls: 0,
      maxRecoveries: 10,
      consumedRecoveries: 0,
    });
    
    store.registerTask(task, missionId);

    const verificationResult: TaskVerificationResult = {
      verificationId: 'v-1',
      verificationJobId: 'vjob-1',
      missionId,
      taskId,
      attemptId: 'att-1',
      executionId: 'exec-1',
      resultId: 'att-1',
      verdict: 'NEEDS_REPAIR',
      criterionResults: [],
      passedCriteria: [],
      failedCriteria: ['some_output_missing'],
      warnings: [],
      repairInstructions: 'Fix the output',
      verifierTypes: ['EXPECTED_OUTPUT_VERIFIER'],
      verifierVersions: [],
      createdAt: Date.now(),
      idempotencyKey: 'idem-1'
    };

    coordinator.handleVerificationFailure(verificationResult);

    const requests = recoveryStore.getRequestsForMission(missionId);
    assert.strictEqual(requests.length, 1, 'Should create 1 recovery request');
    assert.strictEqual(requests[0].status, 'RESOLVED', 'Request should be resolved immediately after dispatching retry');

    const updatedTask = store.getTask(missionId, taskId);
    assert.strictEqual(updatedTask.state.status, 'RETRY_WAIT', 'Task should be transitioned to RETRY_WAIT to trigger next execution');
    assert.strictEqual(updatedTask.state.retries, 1, 'Retry count should be incremented');
  });
});
