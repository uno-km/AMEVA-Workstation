/**
 * @file orchestrator/task-runtime/__tests__/MissionCompletion.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role PHASE 5 - Mission Completion Review 통합 테스트
 */

import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';

import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionCompletionReviewInputBuilder } from '../completion/builder/MissionCompletionReviewInputBuilder';
import { RequiredTaskEvaluator } from '../completion/evaluators/RequiredTaskEvaluator';
import { OptionalTaskPolicyEvaluator } from '../completion/evaluators/OptionalTaskPolicyEvaluator';
import { GoalRequirementCoverageEvaluator } from '../completion/evaluators/GoalRequirementCoverageEvaluator';
import { DeliverableCoverageEvaluator } from '../completion/evaluators/DeliverableCoverageEvaluator';
import { FinalArtifactValidator } from '../completion/evaluators/FinalArtifactValidator';
import { GoalLevelVerifier } from '../completion/verifier/GoalLevelVerifier';
import { MissionOutcomeEvaluator } from '../completion/evaluators/MissionOutcomeEvaluator';
import { MissionCompletionRuntime } from '../completion/runtime/MissionCompletionRuntime';

import type { TaskDefinition, TaskEntity } from '../domain/types';

import { TaskEventLog } from '../events/TaskEventLog';

describe('MissionCompletionRuntime Integration', () => {
  let taskStore: TaskRuntimeStore;
  let eventLog: TaskEventLog;
  let completionRuntime: MissionCompletionRuntime;

  beforeEach(() => {
    eventLog = new TaskEventLog();
    taskStore = new TaskRuntimeStore(eventLog);
    const builder = new MissionCompletionReviewInputBuilder(taskStore);
    const reqEval = new RequiredTaskEvaluator();
    const optEval = new OptionalTaskPolicyEvaluator();
    const goalReqEval = new GoalRequirementCoverageEvaluator();
    const delivEval = new DeliverableCoverageEvaluator();
    const artifactVal = new FinalArtifactValidator();
    const goalVerifier = new GoalLevelVerifier();
    const outcomeEval = new MissionOutcomeEvaluator();

    completionRuntime = new MissionCompletionRuntime(
      taskStore,
      builder,
      reqEval,
      optEval,
      goalReqEval,
      delivEval,
      artifactVal,
      goalVerifier,
      outcomeEval
    );
  });

  const createMockTaskEntity = (
    id: string, 
    priority: number, 
    status: any, 
    isPassed: boolean, 
    outputs: any[] = []
  ): TaskEntity => {
    return {
      definition: {
        id,
        title: `Task ${id}`,
        description: 'Mock',
        command: 'mock',
        priority,
        dependsOn: [],
        expectedOutputs: outputs.map(o => o.type),
        requirementIds: [`req-${id}`],
        capabilityRequirements: []
      },
      state: {
        status,
        stateVersion: 1,
        retries: 0,
        createdAt: Date.now(),
        attempts: {},
        taskResult: status === 'COMPLETED' ? {
          attemptId: `att-${id}`,
          taskId: id,
          status: 'SUCCESS',
          outputs,
          evidence: [],
          unresolvedIssues: [],
          metadata: {},
          timestamp: Date.now()
        } : undefined,
        verification: isPassed ? {
          verdict: 'PASS',
          confidence: 100,
          reasoning: 'Mock pass',
          timestamp: Date.now()
        } : undefined
      }
    };
  };

  it('should return SUCCESS when all required tasks are COMPLETED and PASSED', async () => {
    taskStore.initMission('m1', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    
    // t1 is required explicitly
    const task1 = createMockTaskEntity('t1', 1, 'COMPLETED', true, [{ type: 'doc1', content: 'hello' }]);
    task1.definition.required = true;
    const task2 = createMockTaskEntity('t2', 3, 'COMPLETED', true, [{ type: 'doc2', content: 'world' }]);
    task2.definition.required = true;
    
    taskStore.registerTask(task1, 'm1');
    taskStore.registerTask(task2, 'm1');

    const decision = await completionRuntime.executeCompletionReview('m1', 1);
    
    assert.strictEqual(decision.outcome, 'SUCCESS');
    assert.strictEqual(decision.completionConfidence.confidenceBand, 'HIGH');
    assert.strictEqual(decision.warnings.length, 0);
  });

  it('should treat priority 10 but required=true as a required task and fail if incomplete', async () => {
    taskStore.initMission('m5', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    const task1 = createMockTaskEntity('req_low_prio', 10, 'FAILED', false);
    task1.definition.required = true; // explicitly required despite low priority
    taskStore.registerTask(task1, 'm5');

    const decision = await completionRuntime.executeCompletionReview('m5', 1);
    
    assert.notStrictEqual(decision.outcome, 'SUCCESS');
    assert.notStrictEqual(decision.outcome, 'SUCCESS_WITH_WARNINGS');
  });

  it('should treat missing outputs with Placeholder string as missing deliverables', async () => {
    taskStore.initMission('m6', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    const task1 = createMockTaskEntity('fake_out', 1, 'COMPLETED', true, [{ type: 'req-fake_out', content: 'Placeholder data' }]);
    task1.definition.required = true;
    taskStore.registerTask(task1, 'm6');

    const decision = await completionRuntime.executeCompletionReview('m6', 1);
    
    assert.notStrictEqual(decision.outcome, 'SUCCESS'); // Should fail because of placeholder text
    assert.ok(decision.warnings.some(w => w.includes('누락 혹은 무효함')));
  });

  it('should return WAITING_USER if semantic evaluation is required but disabled', async () => {
    taskStore.initMission('m7', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    const task1 = createMockTaskEntity('semantic_task', 1, 'COMPLETED', true, [{ type: 'out', content: 'done' }]);
    task1.definition.required = true;
    task1.definition.capabilityRequirements = ['llm'];
    taskStore.registerTask(task1, 'm7');

    const decision = await completionRuntime.executeCompletionReview('m7', 1);
    
    assert.strictEqual(decision.outcome, 'WAITING_USER');
    assert.ok(decision.waitingUserTaskIds.length >= 0);
    assert.ok(decision.warnings.some(w => w.includes('수동 검토')));
  });

  it('should return the same decision via idempotency caching', async () => {
    taskStore.initMission('m8', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    const task1 = createMockTaskEntity('req1', 1, 'COMPLETED', true, [{ type: 'out', content: 'done' }]);
    task1.definition.required = true;
    taskStore.registerTask(task1, 'm8');

    const decision1 = await completionRuntime.executeCompletionReview('m8', 1, 'idemp-key-123');
    const decision2 = await completionRuntime.executeCompletionReview('m8', 1, 'idemp-key-123');

    assert.strictEqual(decision1, decision2);
  });

  it('should return SUCCESS_WITH_WARNINGS if optional tasks fail', async () => {
    taskStore.initMission('m2', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    
    const task1 = createMockTaskEntity('req1', 1, 'COMPLETED', true, [{ type: 'out1', content: 'ok' }]);
    task1.definition.required = true;
    const task2 = createMockTaskEntity('opt1', 10, 'FAILED', false);
    task2.definition.required = false;
    
    taskStore.registerTask(task1, 'm2');
    taskStore.registerTask(task2, 'm2');

    const decision = await completionRuntime.executeCompletionReview('m2', 1);
    
    assert.strictEqual(decision.outcome, 'SUCCESS_WITH_WARNINGS');
    assert.ok(decision.warnings.length > 0);
    assert.ok(decision.warnings.some(w => w.includes('optional tasks failed')));
  });

  it('should return PARTIAL_SUCCESS if a required task fails but some completed', async () => {
    taskStore.initMission('m3', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    
    const task1 = createMockTaskEntity('req1', 1, 'COMPLETED', true, [{ type: 'out1', content: 'ok' }]);
    task1.definition.required = true;
    const task2 = createMockTaskEntity('req2', 1, 'FAILED', false);
    task2.definition.required = true;
    
    taskStore.registerTask(task1, 'm3');
    taskStore.registerTask(task2, 'm3');

    const decision = await completionRuntime.executeCompletionReview('m3', 1);
    
    assert.strictEqual(decision.outcome, 'PARTIAL_SUCCESS');
  });

  it('should throw an error if another review is in progress for the same mission (Lock test)', async () => {
    taskStore.initMission('m4', { maxTotalCost: 100, remainingTotalCost: 100, usedTokens: 0, maxTurnCount: 10, currentTurnCount: 0 });
    
    const task1 = createMockTaskEntity('t1', 1, 'COMPLETED', true);
    taskStore.registerTask(task1, 'm4');

    // Hack: Manually hold lock to simulate concurrency
    (completionRuntime as any).activeLocks.add('m4-1');

    await assert.rejects(
      async () => { await completionRuntime.executeCompletionReview('m4', 1); },
      /already in progress/
    );
  });
});
