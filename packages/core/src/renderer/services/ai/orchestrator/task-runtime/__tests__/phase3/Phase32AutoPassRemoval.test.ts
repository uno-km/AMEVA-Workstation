import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { RecoveryCoordinator } from '../../verification/recovery/RecoveryCoordinator';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { RecoveryRequestStore } from '../../verification/recovery/RecoveryRequestStore';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';
import { TaskEventLog } from '../../events/TaskEventLog';
import { V2RuntimeFeatureFlag } from '../../domain/V2RuntimeFeatureFlag';

describe('Phase 3.2: Auto-PASS Removal', () => {
  beforeAll(() => { V2RuntimeFeatureFlag.setMode('V2_ONLY'); });
  afterAll(() => { V2RuntimeFeatureFlag.setMode('LEGACY_ONLY'); });

  it('should not map budget exhaustion to PASS but to FAIL_REQUIRED_TASK', () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const recoveryStore = new RecoveryRequestStore();
    const ledger = new MissionBudgetLedger(store);
    const coordinator = new RecoveryCoordinator(store, recoveryStore, ledger);

    const missionId = 'm-autopass';
    const taskId = 't-autopass';

    store.initMission(missionId, {} as any);
    store.registerTask({
      definition: { id: taskId, title: 't', type: 'CODE', status: 'PENDING', requirements: [] },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        retries: 0,
        maxExecutionRetries: 3,
        executionRetryCount: 3, // Exhausted
        maxSemanticCriticCalls: 3,
        semanticCriticCallCount: 0,
      }
    } as any, missionId);

    coordinator.handleVerificationFailure({
      planId: 'p1',
      planVersion: 1,
      missionId,
      taskId,
      attemptId: 'a1',
      verdict: 'NEEDS_REPAIR',
      retryScope: 'SECTION',
      defects: [{ signature: 'err', type: 'LINT', message: 'e', required: true }],
      failedCriteria: []
    });

    const task = store.getTask(missionId, taskId);
    assert.equal(task.state.status, 'FAILED');
    assert.ok(task.state.previousFailures?.some(f => f.message.includes('Retry budget exhausted')));
  });
});
