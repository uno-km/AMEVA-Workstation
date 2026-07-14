import { describe, it } from 'vitest';
import assert from 'node:assert';
import { PlanActivationService } from '../activation/PlanActivationService';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { TaskEventLog } from '../../events/TaskEventLog';
import type { TaskPlan } from '../domain/PlanningTypes';

describe('ActivationAndBudget', () => {
  const eventLog = new TaskEventLog();
  const store = new TaskRuntimeStore(eventLog);
  const service = new PlanActivationService(store);

  it('should reject activation of non-APPROVED plans', () => {
    const plan: TaskPlan = {
      planId: 'p1', missionId: 'm1', goalId: 'g1', version: 1, status: 'DRAFT', plannerSource: 'SYSTEM',
      tasks: [{ id: 'T1', title: 'Task1', objective: 'Obj', dependencies: [] }],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    
    assert.throws(() => service.activate(plan), /Must be APPROVED/);
  });

  it('should reject double activation', () => {
    const plan: TaskPlan = {
      planId: 'p2', missionId: 'm1', goalId: 'g1', version: 1, status: 'APPROVED', plannerSource: 'SYSTEM',
      tasks: [{ id: 'T2', title: 'Task2', objective: 'Obj', dependencies: [] }],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    
    service.activate(plan);
    assert.strictEqual(plan.status, 'ACTIVE');
    
    // Double activation should throw
    assert.throws(() => service.activate(plan), /Double activation is prohibited/);
  });

  it('should rollback and reject on atomic registration failure (ID collision)', () => {
    const plan1: TaskPlan = {
      planId: 'p3', missionId: 'm2', goalId: 'g1', version: 1, status: 'APPROVED', plannerSource: 'SYSTEM',
      tasks: [{ id: 'T3', title: 'Task3', objective: 'Obj', dependencies: [] }],
      createdAt: Date.now(), schemaVersion: '1.0'
    };
    service.activate(plan1);

    const plan2WithCollision: TaskPlan = {
      planId: 'p4', missionId: 'm2', goalId: 'g2', version: 1, status: 'APPROVED', plannerSource: 'SYSTEM',
      tasks: [
        { id: 'T4', title: 'Task4', objective: 'Obj', dependencies: [] },
        { id: 'T3', title: 'Task3 Collision', objective: 'Obj', dependencies: [] } // Collision
      ],
      createdAt: Date.now(), schemaVersion: '1.0'
    };

    assert.throws(() => service.activate(plan2WithCollision), /Atomic registration failed/);
    
    // Ensure T4 wasn't partially registered
    assert.throws(() => store.getTask('m2', 'T4'), /not found/);
  });
});
