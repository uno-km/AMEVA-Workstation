import { describe, it, expect } from 'vitest';
import { TaskStateMachine } from '../../state/TaskStateMachine';
import type { TaskEntity } from '../../domain/types';

describe('Phase 3 Budget Persistence', () => {
  it('preserves budget counters during state transitions', () => {
    const task: TaskEntity = {
      definition: { id: 't1', title: 'T1', dependencies: [] },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        retries: 0,
        executionRetryCount: 1,
        maxExecutionRetries: 3,
        semanticCriticCallCount: 2,
        maxSemanticCriticCalls: 5,
        repairAttemptCount: 1,
        createdAt: Date.now(),
        attempts: {}
      }
    };

    const newState = TaskStateMachine.transition(task, 'RETRY_WAIT', {
      expectedCurrentStatus: 'VERIFYING',
      expectedStateVersion: 1,
      reason: 'budget retry',
      actor: 'test',
      timestamp: Date.now(),
      commandId: 'cmd1',
      missionId: 'm1',
      taskId: 't1'
    }, {
      executionRetryCount: 2 // Partial update
    });

    expect(newState.state.status).toBe('RETRY_WAIT');
    expect(newState.state.executionRetryCount).toBe(2);
    expect(newState.state.semanticCriticCallCount).toBe(2); // Preserved
    expect(newState.state.repairAttemptCount).toBe(1); // Preserved
  });
});
