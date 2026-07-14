/**
 * @file orchestrator/task-runtime/planning/__tests__/PlanningPipeline.test.ts
 * @system AMEVA OS Desktop Workstation
 */

import { test } from 'vitest';
import * as assert from 'node:assert/strict';

import { GoalInterpreter } from '../goal/GoalInterpreter';
import { GoalValidator } from '../goal/GoalValidator';
import { StrictPlanParser } from '../planner/StrictPlanParser';
import { PlanNormalizer } from '../planner/PlanNormalizer';
import { TaskGraph } from '../graph/TaskGraph';
import { PlanValidator } from '../validation/PlanValidator';
import { PlanActivationService } from '../activation/PlanActivationService';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { TaskEventLog } from '../../events/TaskEventLog';

test('Pipeline 1: Goal Interpreter creates valid spec', async () => {
  const interpreter = new GoalInterpreter({} as any);
  const validator = new GoalValidator();
  
  const spec = await interpreter.interpret('m1', '치즈 보고서 작성');
  const result = validator.validate(spec);
  
  assert.equal(result.valid, true);
  assert.equal(spec.deliverables.length > 0, true);
});

test('Pipeline 2: StrictPlanParser defends against adversarial inputs', () => {
  const parser = new StrictPlanParser();
  
  // 1. 코드펜스
  const r1 = parser.parse('```json\n[{"id":"1"}]\n```');
  assert.equal(r1.success, true);
  assert.equal(r1.parsedData[0].id, '1');

  // 2. Prototype Pollution
  const r2 = parser.parse('{"__proto__": {"admin": true}}');
  assert.equal(r2.success, false);
  assert.ok(r2.parseErrors[0].includes('Prototype pollution'));
});

test('Pipeline 3: Graph Detects Cycle', () => {
  const normalizer = new PlanNormalizer();
  const rawTasks = [
    { id: 'a', dependencies: ['b'] },
    { id: 'b', dependencies: ['c'] },
    { id: 'c', dependencies: ['a'] }
  ];
  const plan = normalizer.normalize(rawTasks, 'm1', 'g1');
  const graph = new TaskGraph(plan.tasks);
  
  const cycle = graph.detectCycle();
  assert.ok(cycle !== null);
  assert.ok(cycle.length >= 3);
});

test('Pipeline 4: Requirement Coverage & Missing Fields Validator', () => {
  const normalizer = new PlanNormalizer();
  const validator = new PlanValidator();

  const spec = {
    goalId: 'g1', missionId: 'm1', objective: 'obj', userIntent: 'intent',
    deliverables: ['d1'], constraints: [], acceptanceCriteria: [], assumptions: [],
    missingInformation: [], clarificationPolicy: 'ASSUME' as const, sourceRequest: 'req',
    requirements: [{ requirementId: 'req-1', sourceText: 'req1', normalizedDescription: 'req1', type: 'functional' as const, required: true, priority: 1 }],
    createdAt: 1, schemaVersion: '1'
  };

  const rawTasks = [
    { id: 't1', dependencies: [], requirementIds: ['req-1'] }
  ]; // expectedOutputs 없음

  const plan = normalizer.normalize(rawTasks, 'm1', 'g1');
  const valResult = validator.validate(plan, spec);

  assert.equal(valResult.valid, false); // expectedOutputs가 없어서 에러
  assert.ok(valResult.errors.some(e => e.code === 'MISSING_OUTPUT'));
  assert.ok(valResult.errors.some(e => e.code === 'MISSING_CRITERIA'));
});

test('Pipeline 5: Atomic Activation & Rollback Check', () => {
  const log = new TaskEventLog();
  const store = new TaskRuntimeStore(log);
  const service = new PlanActivationService(store);
  
  const normalizer = new PlanNormalizer();
  const rawTasks = [{ id: 't1', dependencies: [] }];
  const plan = normalizer.normalize(rawTasks, 'm1', 'g1');
  
  // DRAFT 상태이므로 거부되어야 함
  assert.throws(() => service.activate(plan), /Must be APPROVED/);
  
  plan.status = 'APPROVED';
  service.activate(plan); // 성공
  assert.equal(plan.status, 'ACTIVE');
  assert.equal(store.getAllTasks('m1').length, 1);
  
  // 다시 활성화 시도 (ID 충돌로 원자적 거부)
  const plan2 = normalizer.normalize(rawTasks, 'm1', 'g2');
  plan2.status = 'APPROVED';
  assert.throws(() => service.activate(plan2), /already exists/);
  
  assert.equal(store.getAllTasks('m1').length, 1); // 변화 없음
});
