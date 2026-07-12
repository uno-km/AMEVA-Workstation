import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import { VerificationInputBuilder } from '../verification/runtime/VerificationInputBuilder';
import { TaskVerifierCoordinator } from '../verification/verifiers/TaskVerifierCoordinator';
import { VerificationDecisionPolicy } from '../verification/decision/VerificationDecisionPolicy';
import { TaskEntity } from '../domain/types';

describe('Phase 4 Verification Pipeline', () => {
  it('should successfully build input, coordinate verifiers, and return a verdict', async () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const missionId = 'm-verif';
    const taskId = 't-verif';
    const attemptId = 'att-1';

    // Mock Task in VERIFYING state
    const task: TaskEntity = {
      definition: {
        id: taskId,
        title: 'Verifiable Task',
        objective: 'Test verification',
        dependencies: [],
        expectedOutputs: ['keyword1']
      },
      state: {
        status: 'VERIFYING',
        stateVersion: 1,
        activeAttemptId: attemptId,
        attempts: {
          [attemptId]: {
            attemptId,
            taskId,
            sequence: 0,
            status: 'VERIFYING',
            reasoningTurns: 1,
            toolCallCount: 0,
            recoveryCount: 0,
            resultReference: {
              attemptId,
              createdAt: Date.now(),
              status: 'VERIFYING',
              summary: 'Done',
              outputs: [{ type: 'text', content: 'Here is keyword1 in output' }],
              evidence: []
            }
          }
        },
        retries: 0,
        createdAt: Date.now()
      }
    };
    
    store.registerTask(task, missionId);

    const builder = new VerificationInputBuilder(store);
    const input = builder.build(missionId, taskId);

    const coordinator = new TaskVerifierCoordinator();
    const criterionResults = await coordinator.runVerificationPipeline(input);
    
    assert.ok(criterionResults.length > 0);
    
    const policy = new VerificationDecisionPolicy();
    const finalResult = policy.evaluate(input, criterionResults, 'vjob-1');

    // Expected Output 'keyword1'이 포함되어 있고, 상태도 맞고, 의존성도 없으므로 PASS여야 함
    assert.strictEqual(finalResult.verdict, 'PASS');
    assert.ok(finalResult.passedCriteria.length > 0);
  });
});
