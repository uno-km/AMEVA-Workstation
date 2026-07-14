/**
 * @file orchestrator/task-runtime/__tests__/TaskRuntime.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task Runtime의 도메인 룰, 불변 조건, StateMachine, Store, Adapter 통합 단위 테스트
 * @run npx tsx __tests__/TaskRuntime.test.ts
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { TaskStateMachine } from '../state/TaskStateMachine';
import { LegacyTaskPlanAdapter } from '../compatibility/LegacyTaskPlanAdapter';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import type { TaskEntity, TransitionCommand } from '../domain/types';

// ---------------------------------------------------------
// 1. Adapter Tests
// ---------------------------------------------------------
test('Adapter: 정상 Plan 변환 및 누락/중복 ID 처리', () => {
  const payloads = [
    { title: 'Task 1', status: 'pending' },
    { id: 't2', title: 'Task 2', status: 'in_progress' },
    { id: 't2', title: 'Task 3', status: 'done' } // 중복 ID
  ];
  
  const result = LegacyTaskPlanAdapter.importFromLegacy(payloads);
  
  assert.equal(result.importedTasks.length, 3);
  assert.ok(result.importedTasks[0].definition.id.startsWith('task_auto_'));
  assert.equal(result.importedTasks[1].definition.id, 't2');
  assert.ok(result.importedTasks[2].definition.id.startsWith('task_auto_dup_')); // 중복 해결
  
  // 상태 매핑 검증
  assert.equal(result.importedTasks[0].state.status, 'PENDING');
  assert.equal(result.importedTasks[1].state.status, 'RUNNING');
  assert.equal(result.importedTasks[2].state.status, 'VERIFYING'); // done -> VERIFYING 보수적 매핑
});

// ---------------------------------------------------------
// 2. State Machine & Invariants Tests
// ---------------------------------------------------------
const createDummyEntity = (status: TaskEntity['state']['status'] = 'PENDING'): TaskEntity => ({
  definition: { id: 'task_1', title: 'T1', objective: 'Obj1', dependencies: [] },
  state: { status, stateVersion: 1, retries: 0, attempts: {}, createdAt: Date.now() }
});

const createCommand = (taskId: string, expectedCurrentStatus: any, expectedStateVersion: number): TransitionCommand => ({
  commandId: crypto.randomUUID(),
  missionId: 'm1',
  taskId,
  expectedCurrentStatus,
  expectedStateVersion,
  reason: 'Test command',
  actor: 'tester',
  timestamp: Date.now()
});

test('StateMachine: 정상 전이 (PENDING -> READY -> RUNNING)', () => {
  let entity = createDummyEntity('PENDING');
  
  // PENDING -> READY
  let cmd = createCommand('task_1', 'PENDING', 1);
  entity = TaskStateMachine.transition(entity, 'READY', cmd);
  assert.equal(entity.state.status, 'READY');
  assert.equal(entity.state.stateVersion, 2);

  // READY -> RUNNING (attempt 주입)
  cmd = createCommand('task_1', 'READY', 2);
  const shadowAttemptId = 'att_1';
  entity = TaskStateMachine.transition(entity, 'RUNNING', cmd, {
    activeAttemptId: shadowAttemptId,
    attempts: { [shadowAttemptId]: { attemptId: shadowAttemptId, taskId: 'task_1', sequence: 1, status: 'RUNNING', reasoningTurns: 0, toolCallCount: 0, recoveryCount: 0 } }
  });
  assert.equal(entity.state.status, 'RUNNING');
});

test('StateMachine: 불법 전이 방어 (PENDING -> COMPLETED)', () => {
  const entity = createDummyEntity('PENDING');
  const cmd = createCommand('task_1', 'PENDING', 1);
  
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'COMPLETED', cmd);
  }, /Illegal transition/);
});

test('StateMachine: 낙관적 락 방어 (오래된 stateVersion 거부)', () => {
  const entity = createDummyEntity('READY');
  // version 1이어야 하는데 0을 보냄
  const cmd = createCommand('task_1', 'READY', 0);
  
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'RUNNING', cmd, { activeAttemptId: 'att_1', attempts: { 'att_1': {} as any } });
  }, /State version mismatch/);
});

test('StateMachine: RUNNING 전이 시 Attempt 누락 거부', () => {
  const entity = createDummyEntity('READY');
  const cmd = createCommand('task_1', 'READY', 1);
  
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'RUNNING', cmd);
  }, /activeAttemptId is required to start a task/);
});

test('StateMachine: COMPLETED 전이 시 불변조건 검증', () => {
  let entity = createDummyEntity('VERIFYING');
  entity.state.activeAttemptId = 'att_1';
  
  const cmd = createCommand('task_1', 'VERIFYING', 1);
  
  // 1. Verification 누락
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'COMPLETED', cmd, {
      taskResult: { attemptId: 'att_1', taskId: 'task_1', createdAt: Date.now(), status: 'COMPLETED', summary: '', outputs: [], evidence: [] } as any
    });
  }, /MissingVerificationError/);

  // 2. Result 누락
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'COMPLETED', cmd, {
      verification: { verificationId: 'v1', taskId: 'task_1', attemptId: 'att_1', verdict: 'PASS', passedCriteria: [], failedCriteria: [], verifierType: 'semantic', createdAt: Date.now() }
    });
  }, /TaskResult is missing/);

  // 3. taskId 불일치 (Verification이 엉뚱한 태스크)
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'COMPLETED', cmd, {
      taskResult: { attemptId: 'att_1', createdAt: Date.now(), status: 'COMPLETED', summary: '', outputs: [], evidence: [] } as any,
      verification: { verificationId: 'v1', taskId: 'task_WRONG', attemptId: 'att_1', verdict: 'PASS', passedCriteria: [], failedCriteria: [], verifierType: 'semantic', createdAt: Date.now() }
    });
  }, /taskId mismatch/);

  // 4. attemptId 불일치 (과거 시도의 응답이 도착)
  assert.throws(() => {
    TaskStateMachine.transition(entity, 'COMPLETED', cmd, {
      taskResult: { attemptId: 'att_OLD', taskId: 'task_1', createdAt: Date.now(), status: 'COMPLETED', summary: '', outputs: [], evidence: [] } as any,
      verification: { verificationId: 'v1', taskId: 'task_1', attemptId: 'att_OLD', verdict: 'PASS', passedCriteria: [], failedCriteria: [], verifierType: 'semantic', createdAt: Date.now() }
    });
  }, /attemptId mismatch/);

  // 5. 정상 통과
  const entitySuccess = TaskStateMachine.transition(entity, 'COMPLETED', cmd, {
    taskResult: { attemptId: 'att_1', taskId: 'task_1', createdAt: Date.now(), status: 'COMPLETED', summary: '', outputs: [], evidence: [] } as any,
    verification: { verificationId: 'v1', taskId: 'task_1', attemptId: 'att_1', verdict: 'PASS', passedCriteria: [], failedCriteria: [], verifierType: 'semantic', createdAt: Date.now() }
  });
  
  assert.equal(entitySuccess.state.status, 'COMPLETED');
});

// ---------------------------------------------------------
// 3. Store & Event Log Tests
// ---------------------------------------------------------
test('Store & EventLog: 성공적인 전이 시 이벤트 기록', () => {
  const eventLog = new TaskEventLog();
  const store = new TaskRuntimeStore(eventLog);
  
  const entity = createDummyEntity('READY');
  store.registerTask(entity, 'm1');
  
  const cmd = createCommand('task_1', 'READY', 1);
  store.dispatchTransition(cmd, 'RUNNING', {
    activeAttemptId: 'att_1',
    attempts: { 'att_1': {} as any }
  });
  
  const events = eventLog.getEventsForTask('task_1');
  // 1: REGISTERED, 2: TASK_STARTED (RUNNING)
  assert.equal(events.length, 2);
  assert.equal(events[1].type, 'TASK_STARTED');
  assert.equal(events[1].fromStatus, 'READY');
  assert.equal(events[1].toStatus, 'RUNNING');
  assert.equal(events[1].stateVersion, 2);
});

test('Store & EventLog: 외부 배열 변조 방어 확인', () => {
  const eventLog = new TaskEventLog();
  const store = new TaskRuntimeStore(eventLog);
  const entity = createDummyEntity('READY');
  store.registerTask(entity, 'm1');

  const events = eventLog.getAllEvents() as any[];
  assert.throws(() => {
    events.push({} as any); // Object.freeze 로 인해 오류
  }, TypeError);
});

test('Store & EventLog: 거부된 전이 시 Rejection 이벤트 기록', () => {
  const eventLog = new TaskEventLog();
  const store = new TaskRuntimeStore(eventLog);
  
  const entity = createDummyEntity('READY');
  store.registerTask(entity, 'm1');
  
  // 고의적으로 틀린 버전을 보냄
  const cmd = createCommand('task_1', 'READY', 999);
  
  try {
    store.dispatchTransition(cmd, 'RUNNING', { activeAttemptId: 'a', attempts: { 'a': {} as any }});
    assert.fail('Should have thrown an error');
  } catch (e: any) {
    const events = eventLog.getEventsForTask('task_1');
    assert.equal(events.length, 2);
    assert.equal(events[1].type, 'TASK_STATE_TRANSITION_REJECTED');
    assert.ok(events[1].reason.includes('State version mismatch'));
  }
});

test('Store & EventLog: registerTasksAtomic 부분 등록 방어', () => {
  const eventLog = new TaskEventLog();
  const store = new TaskRuntimeStore(eventLog);
  
  const entity1 = createDummyEntity('PENDING');
  entity1.definition.id = 'task_atomic_1';
  
  const entity2 = createDummyEntity('PENDING');
  entity2.definition.id = 'task_atomic_2';

  // 먼저 task_atomic_2를 개별 등록해둔다.
  store.registerTask(entity2, 'm_atomic');
  assert.equal(store.getAllTasks('m_atomic').length, 1);
  const initialEventCount = eventLog.getAllEvents().length;

  // task_atomic_1과 task_atomic_2를 원자적으로 일괄 등록 시도
  const entity3 = createDummyEntity('PENDING');
  entity3.definition.id = 'task_atomic_1'; // 아직 없음
  const entity4 = createDummyEntity('PENDING');
  entity4.definition.id = 'task_atomic_2'; // 이미 있음 (충돌)

  assert.throws(() => {
    store.registerTasksAtomic([entity3, entity4], 'm_atomic');
  }, /Partial registration prevented/);

  // 확인 1: task_atomic_1은 Store에 등록되지 않았어야 함 (원자성 롤백 확인)
  assert.equal(store.getAllTasks('m_atomic').length, 1);
  
  // 확인 2: EventLog에 어떤 이벤트도 추가되지 않았어야 함
  assert.equal(eventLog.getAllEvents().length, initialEventCount);

  // 충돌 없는 상태로 다시 시도
  entity4.definition.id = 'task_atomic_3';
  store.registerTasksAtomic([entity3, entity4], 'm_atomic');
  assert.equal(store.getAllTasks('m_atomic').length, 3);
  assert.equal(eventLog.getAllEvents().length, initialEventCount + 2);
});
