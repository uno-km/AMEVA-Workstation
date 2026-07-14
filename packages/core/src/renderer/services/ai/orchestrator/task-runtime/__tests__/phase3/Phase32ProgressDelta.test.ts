import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { RecoveryCoordinator } from '../../verification/recovery/RecoveryCoordinator';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { RecoveryRequestStore } from '../../verification/recovery/RecoveryRequestStore';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';
import { TaskEventLog } from '../../events/TaskEventLog';
import { V2RuntimeFeatureFlag } from '../../domain/V2RuntimeFeatureFlag';
import type { TaskEntity } from '../../domain/types';

describe('Phase 3.2: Progress Delta & NO_PROGRESS detection', () => {
  beforeAll(() => { V2RuntimeFeatureFlag.setMode('V2_ONLY'); });
  afterAll(() => { V2RuntimeFeatureFlag.setMode('LEGACY_ONLY'); });

  it('should detect NO_PROGRESS when same defects remain and hash is unchanged', () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const recoveryStore = new RecoveryRequestStore();
    const ledger = new MissionBudgetLedger(store);
    const coordinator = new RecoveryCoordinator(store, recoveryStore, ledger);

    const missionId = 'm-delta';
    const taskId = 't-delta';

    store.initMission(missionId, {} as any);
    
    const task: TaskEntity = {
      definition: { id: taskId, title: 'test', type: 'CODE', status: 'PENDING', requirements: [] },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        retries: 0,
        sameDefectRepeatCount: 1,
        maxExecutionRetries: 5,
        executionRetryCount: 0,
        maxSemanticCriticCalls: 3,
        previousFailures: [{
           errorType: 'VerificationFailed',
           message: 'prev',
           timestamp: Date.now(),
           defectSignatures: ['err1'],
           contentHash: 'hashA',
           semanticScore: 0.5,
           contractCoverage: 0.5,
           retryScope: 'SECTION'
        }]
      }
    };

    store.registerTask(task, missionId);

    coordinator.handleVerificationFailure({
      planId: 'p1',
      planVersion: 1,
      missionId,
      taskId,
      attemptId: 'a2',
      verdict: 'NEEDS_REPAIR',
      retryScope: 'SECTION',
      defects: [{ signature: 'err1', type: 'LINT', message: 'err', required: true }],
      failedCriteria: [],
      contentHash: 'hashA', // Unchanged
      semanticScore: 0.5,
      contractCoverage: 0.5,
      repairInstructions: 'fix it'
    });

    const requests = recoveryStore.getActiveRequestsForTask(taskId);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].progressDelta?.isNoProgress, undefined); // We didn't expose it directly but repeatedDefectCount updated
    assert.equal(requests[0].progressDelta?.repeatedDefectCount, 2); // (1 + 1)

    const updatedTask = store.getTask(missionId, taskId);
    assert.equal(updatedTask.state.sameDefectRepeatCount, 2);
    // Because repeatedDefectCount >= 2, action should be WAIT_FOR_USER
    assert.equal(updatedTask.state.status, 'WAITING_USER');
  });
});
