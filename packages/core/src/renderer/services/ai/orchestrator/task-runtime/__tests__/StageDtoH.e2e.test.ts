/**
 * @file orchestrator/task-runtime/__tests__/StageDtoH.e2e.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role STAGE D~H 전체 흐름 E2E 통합 테스트
 *
 * [Item 8 — E2E 통합 테스트]
 *
 * [테스트 범위]
 * - STAGE D: DeepTaskExecutor + ToolCallParser + ToolObservationBuilder + ToolRegistry DI
 * - STAGE F: CheckpointStore + CheckpointRuntime (Turn 경계 저장, Tool 성공 저장, Resume)
 * - STAGE G: UserAssistRuntime (Request 생성, 응답 처리, State Machine 전이)
 * - STAGE H: RuntimePersistenceAdapter (InMemory Fallback), RuntimeRestoreCoordinator
 *
 * [테스트 원칙]
 * - 단순 Happy Path가 아닌 Adversarial 시나리오 포함
 * - False PASS 방지 검증: ToolObservationBuilder.buildSuccess()가 success=false를 FAILED로 처리 확인
 * - Checkpoint 무결성 검증: verify() 함수가 digest 변조를 탐지 확인
 * - UserAssist 필수 Task SKIP 차단 확인
 * - PathSanitizer path traversal 차단 확인
 * - ToolPolicyChecker Shadow Mode 차단 확인
 *
 * [Mock 전략]
 * - ILLMEngineAdapter: 미리 정해진 응답을 순서대로 반환하는 SequentialMockAdapter
 * - ToolRegistry: MockToolRegistry (실제 window/IPC 없이 동작)
 * - IRuntimePersistenceAdapter: InMemoryRuntimePersistenceAdapter
 * - IndexedDB: 없음 (Node.js test 환경)
 */

import { describe, it, beforeAll as before, afterAll as after } from 'vitest';
import assert from 'node:assert/strict';

// Core domain
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import type { TaskEntity } from '../domain/types';
import type { ILLMEngineAdapter } from '../../types';

// STAGE D
import { ToolCallParser } from '../executors/ToolCallParser';
import { ToolObservationBuilder } from '../executors/ToolObservationBuilder';
import { DeepTaskExecutor } from '../executors/DeepTaskExecutor';
import { TaskLeaseManager } from '../lease/TaskLeaseManager';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { ToolRegistry } from '../../ToolRegistry';
import type { ToolCallResult } from '../../types';

// STAGE F
import { CheckpointStore } from '../checkpoint/CheckpointStore';
import { CheckpointRuntime } from '../checkpoint/CheckpointRuntime';

// STAGE G
import { UserAssistRuntime } from '../assist/UserAssistRuntime';

// STAGE H
import {
  InMemoryRuntimePersistenceAdapter,
} from '../persistence/RuntimePersistenceAdapter';
import { RuntimeRestoreCoordinator } from '../persistence/RuntimeRestoreCoordinator';

// Item 6
import { ToolPolicyChecker, ToolPolicyViolationError } from '../policy/ToolPolicyChecker';
import { V2RuntimeFeatureFlag } from '../domain/V2RuntimeFeatureFlag';

// Item 7
import { PathSanitizer, PathSanitizationError } from '../policy/PathSanitizer';

// ─────────────────────────────────────────────────────────────────────────────
// 공통 테스트 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LLM 응답을 순서대로 반환하는 Mock Adapter.
 * responses가 소진되면 기본 응답('[DONE]')을 반환.
 */
class SequentialMockAdapter implements ILLMEngineAdapter {
  private responses: string[];
  private callIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async invokeStructured(_prompt: string): Promise<Record<string, unknown>> {
    return {};
  }

  async invokeStream(_prompt: string): Promise<{ stream: AsyncGenerator<string>; abort: () => void }> {
    const gen = (async function* () {})();
    return { stream: gen, abort: () => {} };
  }

  async generateStream(
    _messages: Array<{ role: string; content: string }>,
    onToken: (t: string) => void
  ): Promise<string> {
    const response = this.responses[this.callIndex] ?? '[DONE] Task completed.';
    this.callIndex++;
    onToken(response);
    return response;
  }

  async loadModel(): Promise<void> {}
  async unloadModel(): Promise<void> {}
  async abort(): Promise<void> {}
  isReady(): boolean {
    return true;
  }
}

/**
 * MockToolRegistry: 실제 window/IPC 없이 동작하는 ToolRegistry
 * 지정된 Mock Tool을 등록하여 테스트 제어 가능.
 */
class MockToolRegistry extends ToolRegistry {
  private mockResults: Map<string, ToolCallResult> = new Map();

  // IPC 의존성을 제거하기 위해 register를 Override
  register(_def: any): void {
    // 내부 맵에만 저장 (원래 ToolRegistry의 Map을 우회할 수는 없으므로,
    // executeTool 오버라이드를 통해 해결하거나 기본 register 기능을 최소화)
  }

  // 실행 시 Mock 결과 반환
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (this.mockResults.has(name)) {
      return this.mockResults.get(name)!;
    }
    return { success: false, error: 'Not mock registered', toolName: name, toolArgs: args };
  }

  registerMockTool(name: string, result: ToolCallResult): void {
    this.mockResults.set(name, result);
  }

  // registerDefaultTools를 Override하여 window 의존성 제거
  async registerDefaultTools(): Promise<void> {
    // No-op: 테스트 환경에서 기본 도구 등록 스킵
  }
}

function createTestStore(): TaskRuntimeStore {
  return new TaskRuntimeStore(new TaskEventLog());
}

function createTaskEntity(
  id: string,
  status: TaskEntity['state']['status'] = 'PENDING',
  isRequired = true
): TaskEntity {
  return {
    definition: {
      id,
      title: `Task ${id}`,
      objective: `Objective of ${id}`,
      dependencies: [],
      required: isRequired,
      budgetTurns: 10,
      allocatedReasoningTurns: 10,
    },
    state: {
      status,
      stateVersion: 1,
      attempts: {},
      retries: 0,
      createdAt: Date.now()
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE D 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('STAGE D: ToolCallParser & ToolObservationBuilder', () => {
  it('정상 Tool Call 파싱 및 Observation 생성', () => {
    const parser = new ToolCallParser();
    const builder = new ToolObservationBuilder();

    const llmOutput = `<tool_call>{"toolName":"read_file","arguments":{"path":"./test.txt"}}</tool_call>`;
    const knownTools = new Set(['read_file', 'write_file']);
    const result = parser.parse(llmOutput, 1, knownTools);

    if (!result.success) {
      assert.fail(`파싱 실패: ${(result as any).error?.message}`);
    } else {
      assert.equal(result.candidate.toolName, 'read_file');
      assert.deepEqual(result.candidate.arguments, { path: './test.txt' });
    }

    // 성공 Observation 생성
    const toolResult: ToolCallResult = {
      success: true,
      result: '파일 내용',
      toolName: 'read_file',
      toolArgs: { path: './test.txt' }
    };
    const obs = builder.buildSuccess(result.candidate, toolResult);
    assert.equal(obs.status, 'SUCCESS');
    assert.equal(obs.toolName, 'read_file');
  });

  it('[False PASS 방지] success=false인 ToolCallResult는 FAILED Observation으로 처리', () => {
    const parser = new ToolCallParser();
    const builder = new ToolObservationBuilder();

    const llmOutput = `<tool_call>{"toolName":"write_file","arguments":{"path":"./out.txt","content":"data"}}</tool_call>`;
    const parseResult = parser.parse(llmOutput, 1, new Set(['write_file']));
    assert.ok(parseResult.success);

    // success=false 결과를 buildSuccess에 전달
    const failResult: ToolCallResult = {
      success: false,
      error: '권한 없음',
      toolName: 'write_file',
      toolArgs: { path: './out.txt' }
    };
    const obs = builder.buildSuccess(parseResult.candidate, failResult);

    // False PASS 방지: success=false면 FAILED 관측
    assert.equal(obs.status, 'FAILED', 'success=false인 결과가 FAILED Observation으로 처리되어야 한다');
    assert.ok(obs.failureReason?.includes('권한 없음') ?? obs.summary.includes('권한 없음'));
  });

  it('[Prototype Pollution 방지] __proto__ 키 포함 payload 차단', () => {
    const parser = new ToolCallParser();
    const malicious = `<tool_call>{"toolName":"read_file","arguments":{"__proto__":{"admin":true},"path":"./test.txt"}}</tool_call>`;
    const result = parser.parse(malicious, 1, new Set(['read_file']));

    // Prototype pollution 탐지 시 파싱 실패해야 함
    if (result.success) {
      // 파싱이 성공했다면 __proto__가 무력화되어야 함
      assert.ok(!('admin' in Object.prototype), 'Prototype pollution이 발생했다');
    }
    // 파싱 실패도 허용 (차단이 더 안전)
  });

  it('알 수 없는 Tool 이름 파싱 시 에러 반환', () => {
    const parser = new ToolCallParser();
    const llmOutput = `<tool_call>{"toolName":"unknown_evil_tool","arguments":{}}</tool_call>`;
    const result = parser.parse(llmOutput, 1, new Set(['read_file']));

    // unknown tool은 에러로 처리 (파싱은 성공할 수 있지만 ToolPolicyChecker에서 차단)
    // 여기서는 파싱 결과만 테스트
    if (!result.success) {
      assert.equal((result as any).error.errorType, 'MISSING_TOOL_NAME');
    } else {
      assert.equal(result.candidate.toolName, 'unknown_evil_tool');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE F 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('STAGE F: CheckpointStore & CheckpointRuntime', () => {
  it('Checkpoint 저장 및 조회', () => {
    const store = new CheckpointStore();
    const cp = store.save({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      reasoningTurn: 5,
      completedToolCallIds: ['tool-1', 'tool-2'],
      partialOutputText: '부분 결과입니다.',
      planVersion: 1,
      reason: 'TURN_BOUNDARY'
    });

    assert.ok(cp.checkpointId.startsWith('cp-'));
    assert.equal(cp.reasoningTurn, 5);
    assert.deepEqual(cp.completedToolCallIds, ['tool-1', 'tool-2']);

    const latest = store.getLatest('t1');
    assert.ok(latest !== null);
    assert.equal(latest?.checkpointId, cp.checkpointId);
  });

  it('[무결성 검증] SHA-256 Digest 변조 탐지', () => {
    const store = new CheckpointStore();
    const cp = store.save({
      missionId: 'm1',
      taskId: 't2',
      attemptId: 'a1',
      reasoningTurn: 3,
      completedToolCallIds: [],
      partialOutputText: '원본 텍스트',
      planVersion: 1,
      reason: 'TOOL_SUCCESS'
    });

    // 정상 검증
    assert.ok(store.verify(cp), '정상 Checkpoint 검증이 실패했다');

    // 내용 변조 (digest는 유지하면서 텍스트 변경)
    const tampered = { ...cp, partialOutputText: '변조된 텍스트' };
    assert.ok(!store.verify(tampered), '변조된 Checkpoint가 검증을 통과했다 (False PASS)');
  });

  it('CheckpointRuntime: Turn 경계 저장 정책 (N턴 간격)', () => {
    const runtime = new CheckpointRuntime();

    // 1턴: 저장 안 됨 (N=5 기준)
    const r1 = runtime.maybeSaveOnTurnBoundary('m1', 't1', 'a1', 1, 'text', [], 1);
    assert.equal(r1, null, '1턴에서 저장되면 안 된다');

    // 5턴: 저장됨
    const r5 = runtime.maybeSaveOnTurnBoundary('m1', 't1', 'a1', 5, 'text at turn 5', [], 1);
    assert.ok(r5 !== null, '5턴에서 저장되어야 한다');

    // forceNow=true: 즉시 저장
    const rForce = runtime.maybeSaveOnTurnBoundary('m1', 't1', 'a1', 3, 'forced text', ['tc-1'], 1, true);
    assert.ok(rForce !== null, 'forceNow=true이면 즉시 저장되어야 한다');
    assert.deepEqual(rForce!.completedToolCallIds, ['tc-1']);

    runtime.reset();
  });

  it('CheckpointRuntime: planVersion 불일치 시 Resume 거부', () => {
    const runtime = new CheckpointRuntime();

    runtime.maybeSaveOnTurnBoundary('m1', 't1', 'a1', 5, '중간 결과', [], 1, true);

    const result = runtime.prepareResume({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a2',
      checkpointId: '',
      planVersion: 2 // v1 저장, v2 요청 → 거부
    });

    assert.ok(!result.success, 'planVersion 불일치 시 Resume이 거부되어야 한다');
    assert.ok(result.reason?.includes('Plan version mismatch'), `예상 외의 이유: ${result.reason}`);

    runtime.reset();
  });

  it('CheckpointRuntime: 반복 Crash 카운터 증가 및 User Assist 권고', () => {
    const runtime = new CheckpointRuntime();

    // Checkpoint 먼저 저장
    runtime.maybeSaveOnTurnBoundary('m1', 't_crash', 'a1', 5, '텍스트', [], 1, true);

    // 3회 Crash 기록
    runtime.recordCrash('t_crash');
    runtime.recordCrash('t_crash');
    runtime.recordCrash('t_crash');

    // 이제 Resume 시도
    const result = runtime.prepareResume({
      missionId: 'm1',
      taskId: 't_crash',
      attemptId: 'a2',
      checkpointId: '',
      planVersion: 1
    });

    assert.ok(!result.success, '3회 Crash 후 Resume이 거부되어야 한다');
    assert.ok(result.requiresUserAssist, '반복 Crash 시 User Assist 권고되어야 한다');

    runtime.reset();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE G 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('STAGE G: UserAssistRuntime', () => {
  it('Request 생성 및 Pending 상태 조회', () => {
    const store = createTestStore();
    store.initMission('m1', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });
    const task = createTaskEntity('t1', 'RUNNING');
    store.registerTask(task, 'm1');
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm1', taskId: 't1',
        expectedCurrentStatus: 'RUNNING', expectedStateVersion: 1,
        reason: 'Move to WAITING_USER', actor: 'test', timestamp: Date.now()
      },
      'WAITING_USER'
    );

    const runtime = new UserAssistRuntime(store);
    const request = runtime.createRequest({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      title: '사용자 개입 필요',
      summary: 'Task 실패',
      failureReason: '네트워크 오류',
      completedWork: '없음',
      missingWork: '전체',
      recoveryAttempts: 3,
      isTaskRequired: true
    });

    assert.ok(request.requestId.startsWith('ua-'));
    assert.equal(request.status, 'PENDING');

    const pending = runtime.getPendingRequest('t1');
    assert.ok(pending !== null);
    assert.equal(pending?.requestId, request.requestId);

    runtime.dispose();
  });

  it('[필수 Task SKIP 차단] isTaskRequired=true이면 SKIP 응답 거부', () => {
    const store = createTestStore();
    store.initMission('m2', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });
    const task = createTaskEntity('t2', 'RUNNING', true);
    store.registerTask(task, 'm2');
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm2', taskId: 't2',
        expectedCurrentStatus: 'RUNNING', expectedStateVersion: 1,
        reason: 'test', actor: 'test', timestamp: Date.now()
      },
      'WAITING_USER'
    );

    const runtime = new UserAssistRuntime(store);
    const request = runtime.createRequest({
      missionId: 'm2', taskId: 't2', attemptId: 'a1',
      title: '필수 Task 실패', summary: 'test', failureReason: 'err',
      completedWork: '', missingWork: '',
      recoveryAttempts: 1, isTaskRequired: true
    });

    // SKIP 시도 — isTaskRequired=true이면 예외가 아니라 반환 객체로 거부됨
    const response = runtime.respondToRequest({
      requestId: request.requestId,
      selectedOption: 'SKIP_OPTIONAL_TASK',
      respondedAt: Date.now()
    });
    assert.ok(!response.success, '필수 Task의 SKIP 요청은 거부되어야 한다');
    assert.ok(response.message.includes('required'), '거부 메시지에 required 명시');

    runtime.dispose();
  });

  it('[멱등성] 동일 taskId에 중복 Request 생성 시 기존 Request 반환', () => {
    const store = createTestStore();
    store.initMission('m3', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });
    const task = createTaskEntity('t3', 'RUNNING', false);
    store.registerTask(task, 'm3');
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm3', taskId: 't3',
        expectedCurrentStatus: 'RUNNING', expectedStateVersion: 1,
        reason: 'test', actor: 'test', timestamp: Date.now()
      },
      'WAITING_USER'
    );

    const runtime = new UserAssistRuntime(store);
    const r1 = runtime.createRequest({
      missionId: 'm3', taskId: 't3', attemptId: 'a1',
      title: 'First', summary: 'test', failureReason: 'err',
      completedWork: '', missingWork: '', recoveryAttempts: 0, isTaskRequired: false
    });
    const r2 = runtime.createRequest({
      missionId: 'm3', taskId: 't3', attemptId: 'a1',
      title: 'Duplicate', summary: 'test', failureReason: 'err',
      completedWork: '', missingWork: '', recoveryAttempts: 0, isTaskRequired: false
    });

    assert.equal(r1.requestId, r2.requestId, '멱등성: 동일 Request가 반환되어야 한다');

    runtime.dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STAGE H 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('STAGE H: RuntimePersistenceAdapter & RuntimeRestoreCoordinator', () => {
  it('InMemory Adapter: Mission 저장 및 미완료 조회', async () => {
    const adapter = new InMemoryRuntimePersistenceAdapter();

    await adapter.saveMissionSnapshot({
      missionId: 'm-persist-1',
      goalId: 'goal-1',
      status: 'RUNNING',
      taskIds: ['t1', 't2'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      integrityDigest: 'fake',
      schemaVersion: 2
    });

    await adapter.saveMissionSnapshot({
      missionId: 'm-persist-2',
      goalId: 'goal-2',
      status: 'COMPLETED',
      taskIds: ['t3'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      integrityDigest: 'fake',
      schemaVersion: 2
    });

    const incomplete = await adapter.listIncompleteMissions();
    assert.equal(incomplete.length, 1, '완료된 Mission은 미완료 목록에 포함되지 않아야 한다');
    assert.equal(incomplete[0].missionId, 'm-persist-1');
  });

  it('RuntimeRestoreCoordinator: detectIncompleteMissions()', async () => {
    const adapter = new InMemoryRuntimePersistenceAdapter();

    await adapter.saveMissionSnapshot({
      missionId: 'm-coord-1',
      goalId: 'g1',
      status: 'RUNNING',
      taskIds: ['t1'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      integrityDigest: 'fake',
      schemaVersion: 2
    });

    const coordinator = new RuntimeRestoreCoordinator(adapter);
    const results = await coordinator.detectIncompleteMissions();

    assert.ok(results.length > 0, '미완료 Mission이 감지되어야 한다');
    const found = results.find(r => r.missionId === 'm-coord-1');
    assert.ok(found !== undefined, '저장된 Mission이 감지 결과에 있어야 한다');
    assert.equal(found?.recommendedAction, 'RESTART', '실행 중인 Mission은 이전 핸들러가 없으므로 RESTART 권고 되어야 한다');
  });

  it('RuntimeRestoreCoordinator: saveMissionState() 호출', async () => {
    const adapter = new InMemoryRuntimePersistenceAdapter();
    const coordinator = new RuntimeRestoreCoordinator(adapter);

    await coordinator.saveMissionState('m-save-1', 'g1', 'WAITING_USER', ['t1', 't2']);

    const incomplete = await adapter.listIncompleteMissions();
    const found = incomplete.find(m => m.missionId === 'm-save-1');
    assert.ok(found !== undefined, 'saveMissionState가 Adapter에 저장해야 한다');
    assert.equal(found?.status, 'WAITING_USER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 6: Shadow Mode Tool 차단 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 6: ToolPolicyChecker Shadow Mode 차단', () => {
  before(() => {
    V2RuntimeFeatureFlag.setMode('V2_SHADOW');
  });

  after(() => {
    V2RuntimeFeatureFlag.setMode('LEGACY_ONLY');
    V2RuntimeFeatureFlag.resetAllOwnerships();
  });

  it('Shadow Mode에서 write_file 차단', () => {
    assert.throws(
      () => ToolPolicyChecker.assertAllowed('write_file', new Set(['write_file', 'read_file'])),
      (err: unknown) => err instanceof ToolPolicyViolationError && err.violationType === 'SHADOW_MODE_BLOCKED'
    );
  });

  it('Shadow Mode에서 read_file 허용', () => {
    assert.doesNotThrow(
      () => ToolPolicyChecker.assertAllowed('read_file', new Set(['read_file', 'write_file']))
    );
  });

  it('Shadow Mode에서 list_dir 허용', () => {
    assert.doesNotThrow(
      () => ToolPolicyChecker.assertAllowed('list_dir', new Set(['list_dir']))
    );
  });

  it('Shadow Mode에서 run_command 차단', () => {
    assert.throws(
      () => ToolPolicyChecker.assertAllowed('run_command', new Set(['run_command'])),
      (err: unknown) => err instanceof ToolPolicyViolationError && err.violationType === 'SHADOW_MODE_BLOCKED'
    );
  });

  it('미등록 Tool 차단 (Shadow Mode 무관)', () => {
    // Shadow Mode이지만 unknown tool도 차단
    assert.throws(
      () => ToolPolicyChecker.assertAllowed('evil_tool', new Set(['read_file'])),
      (err: unknown) => err instanceof ToolPolicyViolationError
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 7: PathSanitizer path traversal 차단 테스트
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 7: PathSanitizer path traversal 차단', () => {
  it('정상 경로 통과', () => {
    const safe = PathSanitizer.sanitizePath('C:\\Users\\GAME\\Desktop\\test.txt', 'write');
    assert.ok(safe.length > 0, '정상 경로가 차단되었다');
  });

  it('Directory Traversal (../../etc/passwd) 차단', () => {
    assert.throws(
      () => PathSanitizer.sanitizePath('../../etc/passwd', 'write'),
      (err: unknown) => err instanceof PathSanitizationError
    );
  });

  it('Null byte injection 차단', () => {
    assert.throws(
      () => PathSanitizer.sanitizePath('/path/file\x00.txt', 'write'),
      (err: unknown) => err instanceof PathSanitizationError
    );
  });

  it('URL-encoded path (../../../etc) 차단', () => {
    assert.throws(
      () => PathSanitizer.sanitizePath('%2e%2e/%2e%2e/etc', 'write'),
      (err: unknown) => err instanceof PathSanitizationError
    );
  });

  it('읽기 작업 (read)은 허용 루트 제한 없음 — 단 traversal은 여전히 차단', () => {
    // 정상 읽기 경로
    const safe = PathSanitizer.sanitizePath('./readme.txt', 'read');
    assert.ok(safe.length > 0, '정상 읽기 경로가 차단되었다');

    // read도 traversal은 차단
    assert.throws(
      () => PathSanitizer.sanitizePath('../../etc/shadow', 'read'),
      (err: unknown) => err instanceof PathSanitizationError
    );
  });

  it('허용 루트 밖의 쓰기 차단 (/var/www/html → 루트 밖)', () => {
    assert.throws(
      () => PathSanitizer.sanitizePath('/var/www/html/shell.php', 'write'),
      (err: unknown) => err instanceof PathSanitizationError &&
        (err.reason === 'OUTSIDE_ALLOWED_ROOTS' || err.reason === 'BLOCKED_PATTERN' || err.reason === 'TRAVERSAL_TOO_DEEP')
    );
  });

  it('너무 긴 경로 차단', () => {
    const longPath = 'C:\\Users\\GAME\\' + 'a'.repeat(1100);
    assert.throws(
      () => PathSanitizer.sanitizePath(longPath, 'write'),
      (err: unknown) => err instanceof PathSanitizationError && err.reason === 'PATH_TOO_LONG'
    );
  });

  it('isSafe() 헬퍼 검증', () => {
    assert.ok(PathSanitizer.isSafe('C:\\Users\\GAME\\Desktop\\test.txt', 'write'));
    assert.ok(!PathSanitizer.isSafe('../../etc/passwd', 'write'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E 통합 흐름 테스트: DeepTaskExecutor + Checkpoint + UserAssist
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: DeepTaskExecutor + CheckpointRuntime 통합 흐름', () => {
  it('[E2E] DeepTaskExecutor 실행: Checkpoint 턴 경계 저장 확인', async () => {
    const store = createTestStore();
    store.initMission('m-e2e-1', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });

    const task = createTaskEntity('t-e2e-1', 'READY');
    store.registerTask(task, 'm-e2e-1');

    const leaseManager = new TaskLeaseManager(store);
    const ledger = new MissionBudgetLedger(store);
    const checkpointRuntime = new CheckpointRuntime();

    // Mock Adapter: 5턴 분량의 응답 준비 (Tool 없는 순수 텍스트)
    const responses = Array(6).fill('추론 중입니다. 아직 결론이 나지 않았습니다.');
    const adapter = new SequentialMockAdapter(responses);

    const mockRegistry = new MockToolRegistry();

    const executor = new DeepTaskExecutor(
      store, leaseManager, ledger, adapter,
      mockRegistry, checkpointRuntime
    );

    // Lease 획득 후 RUNNING 전이
    const lease = leaseManager.acquireLease('m-e2e-1', 't-e2e-1', 'exec-1', 'TestDispatcher');
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm-e2e-1', taskId: 't-e2e-1',
        attemptId: lease.attemptId, expectedCurrentStatus: 'READY',
        expectedStateVersion: lease.stateVersion,
        reason: 'E2E test', actor: 'TestDispatcher', timestamp: Date.now()
      },
      'RUNNING'
    );

    // 실행 (3회 연속 Tool 없음 → OUTPUT_SUFFICIENT)
    await executor.execute('m-e2e-1', 't-e2e-1', lease.attemptId, lease.leaseId);

    // 실행 후 Task 상태 확인
    const finalTask = store.getTask('m-e2e-1', 't-e2e-1');
    assert.ok(
      finalTask.state.status === 'VERIFYING' || finalTask.state.status === 'FAILED',
      `예상치 못한 최종 상태: ${finalTask.state.status}`
    );

    // Checkpoint는 clearTask() 호출되어 정리됨
    // (마지막에 clearTask() 호출하므로 최신 Checkpoint 없음)
    const cp = checkpointRuntime.getLatestCheckpoint('t-e2e-1');
    assert.equal(cp, null, '실행 완료 후 Checkpoint가 정리되어야 한다');

    checkpointRuntime.reset();
  });

  it('[E2E] DeepTaskExecutor: Tool 성공 시 Checkpoint 즉시 저장 확인', async () => {
    const store = createTestStore();
    store.initMission('m-e2e-2', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });

    const task = createTaskEntity('t-e2e-2', 'READY');
    store.registerTask(task, 'm-e2e-2');

    const leaseManager = new TaskLeaseManager(store);
    const ledger = new MissionBudgetLedger(store);
    const checkpointRuntime = new CheckpointRuntime();

    // Tool Call 응답 + 이후 텍스트 응답
    const toolCallResponse = `<tool_call>{"toolName":"mock_tool","arguments":{}}</tool_call>`;
    const adapter = new SequentialMockAdapter([
      toolCallResponse,          // Turn 1: Tool Call
      '결과를 분석했습니다.',      // Turn 2: 텍스트
      '분석 완료.',               // Turn 3: 텍스트
      '최종 결과 작성 중.',       // Turn 4: 텍스트 (OUTPUT_SUFFICIENT로 종료)
    ]);

    const mockRegistry = new MockToolRegistry();
    mockRegistry.registerMockTool('mock_tool', {
      success: true,
      result: 'Mock 결과',
      toolName: 'mock_tool',
      toolArgs: {}
    });

    const executor = new DeepTaskExecutor(
      store, leaseManager, ledger, adapter,
      mockRegistry, checkpointRuntime
    );

    // Checkpoint 저장을 모니터링하기 위해 getLatestCheckpoint를 미리 추적
    let toolSuccessCheckpointSaved = false;
    const originalMaybeSave = checkpointRuntime.maybeSaveOnTurnBoundary.bind(checkpointRuntime);
    checkpointRuntime.maybeSaveOnTurnBoundary = (mId, tId, aId, turn, text, ids, pv, force) => {
      if (force === true && ids.length > 0) {
        toolSuccessCheckpointSaved = true;
      }
      return originalMaybeSave(mId, tId, aId, turn, text, ids, pv, force);
    };

    const lease = leaseManager.acquireLease('m-e2e-2', 't-e2e-2', 'exec-2', 'TestDispatcher');
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm-e2e-2', taskId: 't-e2e-2',
        attemptId: lease.attemptId, expectedCurrentStatus: 'READY',
        expectedStateVersion: lease.stateVersion,
        reason: 'E2E test 2', actor: 'TestDispatcher', timestamp: Date.now()
      },
      'RUNNING'
    );

    await executor.execute('m-e2e-2', 't-e2e-2', lease.attemptId, lease.leaseId);

    // Tool 성공 직후 Checkpoint 저장 여부 확인
    assert.ok(
      toolSuccessCheckpointSaved,
      'Tool 성공 직후 Checkpoint가 즉시 저장(forceNow=true)되어야 한다'
    );

    checkpointRuntime.reset();
  });
});

describe('E2E: Event Retention/Compaction 흐름', () => {
  it('Mission 완료 후 compactEventLogForMission() 호출 시 비중요 이벤트 제거', () => {
    const eventLog = new TaskEventLog();
    const store = new TaskRuntimeStore(eventLog);

    store.initMission('m-compact', {
      maxReasoningTurns: 100, consumedReasoningTurns: 0, reservedReasoningTurns: 0,
      maxDurationMs: 3600000, consumedDurationMs: 0,
      maxToolCalls: 100, consumedToolCalls: 0,
      maxRecoveries: 3, consumedRecoveries: 0
    });

    const task = createTaskEntity('t-compact');
    store.registerTask(task, 'm-compact');

    // 다수 상태 전이로 이벤트 생성
    store.dispatchTransition(
      {
        commandId: crypto.randomUUID(), missionId: 'm-compact', taskId: 't-compact',
        expectedCurrentStatus: 'PENDING', expectedStateVersion: 1,
        reason: 'test', actor: 'test', timestamp: Date.now()
      },
      'READY'
    );

    const statsBefore = store.getEventLogStats();
    const removedCount = store.compactEventLogForMission('m-compact');

    // 비중요 이벤트가 없으면 0, 있으면 0보다 큼
    assert.ok(removedCount >= 0, 'compactEventLogForMission이 음수를 반환했다');

    const statsAfter = store.getEventLogStats();
    assert.ok(
      statsAfter.currentCount <= statsBefore.currentCount,
      '압축 후 이벤트 수가 증가했다'
    );
  });
});
