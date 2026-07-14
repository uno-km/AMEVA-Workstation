import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { RuntimeRestoreCoordinator } from '../../persistence/RuntimeRestoreCoordinator';
import { InMemoryRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';
import { MissionExecutionRuntime } from '../../mission/MissionExecutionRuntime';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { TaskEventLog } from '../../events/TaskEventLog';
import { V2RuntimeFeatureFlag } from '../../domain/V2RuntimeFeatureFlag';

describe('Phase 3.2: Budget Persistence Integration', () => {
  beforeAll(() => { V2RuntimeFeatureFlag.setMode('V2_ONLY'); });
  afterAll(() => { V2RuntimeFeatureFlag.setMode('LEGACY_ONLY'); });

  it('should save and restore taskBudgets (sameDefectRepeatCount) on restart', async () => {
    const adapter = new InMemoryRuntimePersistenceAdapter();
    const coordinator = new RuntimeRestoreCoordinator(adapter);

    const store = new TaskRuntimeStore(new TaskEventLog());
    const missionId = 'm-budget';
    const taskId = 't-budget';

    store.initMission(missionId, {} as any);
    store.registerTask({
      definition: { id: taskId, title: 't', type: 'CODE', status: 'PENDING', requirements: [] },
      state: {
        status: 'PAUSED',
        stateVersion: 1,
        retries: 0,
        sameDefectRepeatCount: 2,
        executionRetryCount: 3,
        semanticCriticCallCount: 1,
        repairAttemptCount: 1,
        maxExecutionRetries: 5,
        maxSemanticCriticCalls: 3,
      }
    } as any, missionId);

    // This calls saveMissionState with taskBudgets internally
    await coordinator.saveMissionState(missionId, missionId, 'PAUSED', [taskId], {
      [taskId]: store.getTask(missionId, taskId).state.budget || {
        sameDefectRepeatCount: 2,
        executionRetryCount: 3,
        semanticCriticCallCount: 1,
        repairAttemptCount: 1,
      }
    });

    const incomplete = await coordinator.detectIncompleteMissions();
    assert.equal(incomplete.length, 1);
    
    const restoredInfo = incomplete[0];
    assert.equal(restoredInfo.missionId, missionId);
    assert.equal(restoredInfo.status, 'PAUSED');
    
    const restoredBudget = restoredInfo.taskBudgets?.[taskId];
    assert.ok(restoredBudget !== undefined);
    assert.equal(restoredBudget.sameDefectRepeatCount, 2);
    assert.equal(restoredBudget.executionRetryCount, 3);
  });
});
