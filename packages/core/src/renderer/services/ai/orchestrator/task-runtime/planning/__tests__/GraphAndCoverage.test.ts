import { describe, it } from 'vitest';
import assert from 'node:assert';
import { PlanValidator } from '../validation/PlanValidator';
import type { TaskPlan, GoalSpec } from '../domain/PlanningTypes';

describe('GraphAndCoverage', () => {
  const validator = new PlanValidator();

  const dummyGoalSpec: GoalSpec = {
    goalId: 'g1',
    missionId: 'm1',
    objective: 'Test',
    userIntent: '',
    deliverables: [],
    constraints: [],
    acceptanceCriteria: [],
    assumptions: [],
    missingInformation: [],
    clarificationPolicy: 'ASSUME',
    sourceRequest: '',
    requirements: [
      { requirementId: 'R1', sourceText: 'req1', normalizedDescription: '', type: 'functional', required: true, priority: 1 }
    ],
    createdAt: Date.now(),
    schemaVersion: '1.0'
  };

  it('should reject ambiguous acceptance criteria', () => {
    const plan: TaskPlan = {
      planId: 'p1', missionId: 'm1', goalId: 'g1', version: 1, status: 'DRAFT', plannerSource: 'SYSTEM',
      tasks: [
        { id: 'T1', title: 'Task', objective: 'Obj', dependencies: [], expectedOutputs: ['out'], acceptanceCriteria: ['너무 잘 분석한다'], capabilityRequirements: ['web.search'], requirementIds: ['R1'] }
      ],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    const result = validator.validate(plan, dummyGoalSpec);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'AMBIGUOUS_CRITERIA'));
  });

  it('should detect isolated unreachable tasks', () => {
    const plan: TaskPlan = {
      planId: 'p2', missionId: 'm1', goalId: 'g1', version: 1, status: 'DRAFT', plannerSource: 'SYSTEM',
      tasks: [
        { id: 'T1', title: 'Task1', objective: 'Obj', dependencies: [], expectedOutputs: ['out'], acceptanceCriteria: ['Criteria is clear'], capabilityRequirements: ['web.search'], requirementIds: ['R1'] },
        { id: 'T2', title: 'Isolated', objective: 'Obj', dependencies: [], expectedOutputs: ['out'], acceptanceCriteria: ['Criteria is clear'], capabilityRequirements: ['web.search'] }
      ],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    const result = validator.validate(plan, dummyGoalSpec);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'ISOLATED_TASK'));
  });

  it('should reject if invalid capabilities are used', () => {
    const plan: TaskPlan = {
      planId: 'p3', missionId: 'm1', goalId: 'g1', version: 1, status: 'DRAFT', plannerSource: 'SYSTEM',
      tasks: [
        { id: 'T1', title: 'Task', objective: 'Obj', dependencies: [], expectedOutputs: ['out'], acceptanceCriteria: ['Criteria is clear'], capabilityRequirements: ['hack.server'], requirementIds: ['R1'] }
      ],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    const result = validator.validate(plan, dummyGoalSpec);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'INVALID_CAPABILITY'));
  });
});
