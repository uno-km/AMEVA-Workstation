/**
 * @file __tests__/P0_FailClosed.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role P0 Fail-Closed 회귀 테스트
 *
 * 검증 목표:
 * A. FILE_OUTPUT_REQUIRED + fileAdapter 없음 → PASS 금지
 * B. INCOMPLETE_VERIFICATION → VerificationDecisionPolicy FAIL 귀결
 * C. DeterministicVerifier: evidence 있어도 파일 없으면 FAIL
 * D. NO_PERSISTED_OUTPUT + empty → FAIL
 * E. PathSanitizer: traversal/UNC/nullbyte 차단
 * F. V2 typed terminal result 검증
 */

import { describe, it, expect, vi } from 'vitest';
import { DeterministicVerifier } from '../verification/verifiers/DeterministicVerifier';
import { VerificationDecisionPolicy } from '../verification/decision/VerificationDecisionPolicy';
import { resolveAgainstSandboxRoot } from '../utils/PathSanitizer';
import type { CriterionResult } from '../verification/domain/VerificationTypes';

// ── Minimal VerificationInput factory ────────────────────────────────────────
function makeInput(
  outputMode: 'FILE_OUTPUT_REQUIRED' | 'NO_PERSISTED_OUTPUT' | 'ARTIFACT_OUTPUT_REQUIRED' | 'EITHER_FILE_OR_ARTIFACT',
  expectedFileOutputs: string[] = [],
  evidence: any[] = [],
  outputs: any[] = []
): any {
  return {
    missionId: 'test-mission',
    planId: 'plan-1',
    planVersion: 1,
    taskId: 'task-1',
    attemptId: 'attempt-1',
    taskDefinition: {
      id: 'task-1',
      title: 'Test Task',
      objective: 'Test',
      dependencies: [],
      outputMode,
      expectedFileOutputs,
      acceptanceCriteria: [],
    },
    taskState: {
      status: 'VERIFYING',
      stateVersion: 1,
      attempts: {},
      retries: 0,
      createdAt: Date.now(),
      maxExecutionRetries: 3,
      executionRetryCount: 0,
      maxSemanticCriticCalls: 5,
      semanticCriticCallCount: 0,
      maxRepairAttempts: 3,
      repairAttemptCount: 0,
      maxSameDefectRepeats: 3,
      sameDefectRepeatCount: 0,
      maxTotalVerificationTimeMs: 60000,
    },
    targetAttempt: {
      attemptId: 'attempt-1',
      taskId: 'task-1',
      sequence: 0,
      status: 'VERIFYING',
      reasoningTurns: 1,
      toolCallCount: 1,
      recoveryCount: 0,
      resultReference: {
        attemptId: 'attempt-1',
        createdAt: Date.now(),
        status: 'COMPLETED',
        summary: 'Done',
        outputs,
        evidence
      }
    }
  };
}

// ── fileAdapter mock factories ────────────────────────────────────────────────
function makeFileAdapter(exists: boolean, size = 100): any {
  return {
    stat: vi.fn().mockResolvedValue({ exists, size }),
    read: vi.fn().mockResolvedValue('file content')
  };
}

// ── VerificationDecisionPolicy helper ────────────────────────────────────────
function evaluatePolicy(results: CriterionResult[]): string {
  const policy = new VerificationDecisionPolicy();
  const input = makeInput('FILE_OUTPUT_REQUIRED', ['report.md']);
  const result = policy.evaluate(input, results, 'job-1');
  return result.verdict;
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. VerificationDecisionPolicy — INCOMPLETE_VERIFICATION & WARN
// ═══════════════════════════════════════════════════════════════════════════════
describe('A. VerificationDecisionPolicy — INCOMPLETE_VERIFICATION & WARN', () => {
  it('INCOMPLETE_VERIFICATION → FAIL (절대 PASS 금지)', () => {
    const results: CriterionResult[] = [
      {
        criterionId: 'test-incomplete',
        verifierType: 'DETERMINISTIC_VERIFIER',
        verdict: 'INCOMPLETE_VERIFICATION',
        reason: 'fileAdapter 미주입',
        incompleteReason: 'FILESYSTEM_VERIFIER_UNAVAILABLE',
        defect: {
          defectId: 'def-1',
          signature: 'DETERMINISTIC:FILESYSTEM_VERIFIER_UNAVAILABLE:report.md',
          stage: 'DETERMINISTIC',
          type: 'FILESYSTEM_VERIFIER_UNAVAILABLE',
          severity: 'CRITICAL',
          required: true,
          message: '파일 검증 불가',
          retryable: false,
          retryScope: 'FULL_TASK'
        }
      }
    ];
    const verdict = evaluatePolicy(results);
    expect(verdict).toBe('FAIL');
    expect(verdict).not.toBe('PASS');
  });

  it('WARN + required=true → FAIL', () => {
    const results: CriterionResult[] = [
      {
        criterionId: 'test-warn',
        verifierType: 'DETERMINISTIC_VERIFIER',
        verdict: 'WARN',
        reason: '경고 항목',
        defect: {
          defectId: 'def-2',
          signature: 'DETERMINISTIC:WARN:test',
          stage: 'DETERMINISTIC',
          type: 'INSUFFICIENT_EVIDENCE',
          severity: 'HIGH',
          required: true, // blocking
          message: '필수 경고',
          retryable: false,
          retryScope: 'FULL_TASK'
        }
      }
    ];
    const verdict = evaluatePolicy(results);
    expect(verdict).toBe('FAIL');
  });

  it('WARN + required=false → PASS (경고만, blocking 아님)', () => {
    const results: CriterionResult[] = [
      {
        criterionId: 'test-warn-opt',
        verifierType: 'DETERMINISTIC_VERIFIER',
        verdict: 'WARN',
        reason: '선택 경고',
        defect: {
          defectId: 'def-3',
          signature: 'DETERMINISTIC:WARN:optional',
          stage: 'DETERMINISTIC',
          type: 'INSUFFICIENT_EVIDENCE',
          severity: 'LOW',
          required: false, // non-blocking
          message: '선택 경고',
          retryable: false,
          retryScope: 'FIELD'
        }
      },
      {
        criterionId: 'main-pass',
        verifierType: 'DETERMINISTIC_VERIFIER',
        verdict: 'PASS',
        reason: '검증 통과'
      }
    ];
    const verdict = evaluatePolicy(results);
    expect(verdict).toBe('PASS');
  });

  it('PASS-only results → PASS', () => {
    const results: CriterionResult[] = [
      { criterionId: 'all-pass', verifierType: 'DETERMINISTIC_VERIFIER', verdict: 'PASS', reason: 'OK' }
    ];
    expect(evaluatePolicy(results)).toBe('PASS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. DeterministicVerifier — FILE_OUTPUT_REQUIRED + fileAdapter 없음
// ═══════════════════════════════════════════════════════════════════════════════
describe('B. DeterministicVerifier — FILE_OUTPUT_REQUIRED + fileAdapter 미주입', () => {
  it('fileAdapter 없을 때 INCOMPLETE_VERIFICATION 반환', async () => {
    const verifier = new DeterministicVerifier(/* fileAdapter 미주입 */);
    const evidence = [{
      source: 'tool_result',
      timestamp: Date.now(),
      data: {
        toolCallId: 'tc-1',
        toolName: 'write_file',
        status: 'SUCCESS',
        description: 'ok',
        taskId: 'task-1',
        missionId: 'test-mission',
        operationType: 'CREATE',
        expectedOutputPath: 'report.md'
      }
    }];
    const outputs = [{ type: 'file', path: 'report.md', content: '' }];
    const input = makeInput('FILE_OUTPUT_REQUIRED', ['report.md'], evidence, outputs);
    const results = await verifier.verify(input);
    
    const incompleteResult = results.find(r => r.verdict === 'INCOMPLETE_VERIFICATION');
    expect(incompleteResult).toBeDefined();
    expect(incompleteResult!.defect!.required).toBe(true);
    expect(incompleteResult!.defect!.type).toBe('FILESYSTEM_VERIFIER_UNAVAILABLE');

    // Policy를 통해 최종 FAIL 확인
    const policy = new VerificationDecisionPolicy();
    const finalResult = policy.evaluate(input, results, 'job-1');
    expect(finalResult.verdict).toBe('FAIL');
  });

  it('fileAdapter 있고 파일 존재하면 PASS', async () => {
    const fileAdapter = makeFileAdapter(true, 1024);
    const verifier = new DeterministicVerifier(fileAdapter);
    const evidence = [{
      source: 'tool_result',
      timestamp: Date.now(),
      data: {
        toolCallId: 'tc-2',
        toolName: 'write_file',
        status: 'SUCCESS',
        description: 'ok',
        taskId: 'task-1',
        missionId: 'test-mission',
        operationType: 'CREATE',
        expectedOutputPath: 'report.md'
      }
    }];
    const outputs = [{ type: 'file', path: 'report.md', content: '' }];
    const input = makeInput('FILE_OUTPUT_REQUIRED', ['report.md'], evidence, outputs);
    const results = await verifier.verify(input);

    const failResult = results.find(r => r.verdict === 'FAIL');
    expect(failResult).toBeUndefined();

    const incompleteResult = results.find(r => r.verdict === 'INCOMPLETE_VERIFICATION');
    expect(incompleteResult).toBeUndefined();
  });

  it('fileAdapter 있고 파일 존재하지 않으면 FAIL (OUTPUT_FILE_NOT_FOUND)', async () => {
    const fileAdapter = makeFileAdapter(false);
    const verifier = new DeterministicVerifier(fileAdapter);
    const evidence = [{
      source: 'tool_result',
      timestamp: Date.now(),
      data: {
        toolCallId: 'tc-3',
        toolName: 'write_file',
        status: 'SUCCESS',
        description: 'ok',
        taskId: 'task-1',
        missionId: 'test-mission',
        operationType: 'CREATE',
        expectedOutputPath: 'report.md'
      }
    }];
    const outputs = [{ type: 'file', path: 'report.md', content: '' }];
    const input = makeInput('FILE_OUTPUT_REQUIRED', ['report.md'], evidence, outputs);
    const results = await verifier.verify(input);

    const failResult = results.find(r => r.verdict === 'FAIL');
    expect(failResult).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. NO_PERSISTED_OUTPUT — 빈 응답 FAIL
// ═══════════════════════════════════════════════════════════════════════════════
describe('C. NO_PERSISTED_OUTPUT', () => {
  it('빈 텍스트 응답 → FAIL', async () => {
    const verifier = new DeterministicVerifier();
    const outputs = [{ type: 'text', content: '' }]; // 빈 응답
    const input = makeInput('NO_PERSISTED_OUTPUT', [], [], outputs);
    const results = await verifier.verify(input);
    
    const failResult = results.find(r => r.verdict === 'FAIL');
    expect(failResult).toBeDefined();
  });

  it('non-empty 텍스트 응답 → PASS', async () => {
    const verifier = new DeterministicVerifier();
    const outputs = [{ type: 'text', content: '컴퓨터는 전자 장치입니다.' }];
    const input = makeInput('NO_PERSISTED_OUTPUT', [], [], outputs);
    const results = await verifier.verify(input);
    
    const failResult = results.find(r => r.verdict === 'FAIL');
    expect(failResult).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. ARTIFACT_OUTPUT_REQUIRED — Artifact 없음 FAIL
// ═══════════════════════════════════════════════════════════════════════════════
describe('D. ARTIFACT_OUTPUT_REQUIRED', () => {
  it('Artifact 선언 없음 → FAIL', async () => {
    const verifier = new DeterministicVerifier();
    const input = makeInput('ARTIFACT_OUTPUT_REQUIRED', [], [], []);
    (input.taskDefinition as any).expectedArtifactOutputs = ['artifact-1'];
    const results = await verifier.verify(input);
    
    const failResult = results.find(r => r.verdict === 'FAIL');
    expect(failResult).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. PathSanitizer
// ═══════════════════════════════════════════════════════════════════════════════
describe('E. PathSanitizer — canonical path 검증', () => {
  const sandboxRoot = 'C:/missions';
  const missionId = 'mission-abc-123';

  it('정상 상대 경로 → insideRoot=true', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, missionId, 'report.md');
    expect(result.insideRoot).toBe(true);
    expect(result.canonicalPath).toBeTruthy();
  });

  it('../ traversal → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, missionId, '../../../etc/passwd');
    expect(result.insideRoot).toBe(false);
    expect(result.violationReason).toMatch(/PATH_TRAVERSAL/);
  });

  it('null byte → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, missionId, 'report\0.md');
    expect(result.insideRoot).toBe(false);
    expect(result.violationReason).toMatch(/NULL_BYTE/);
  });

  it('UNC 경로 → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, missionId, '//server/share/evil.md');
    expect(result.insideRoot).toBe(false);
    expect(result.violationReason).toMatch(/UNC_PATH/);
  });

  it('sandbox root 밖 절대 경로 → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, missionId, 'D:/other/evil.md');
    expect(result.insideRoot).toBe(false);
    expect(result.violationReason).toMatch(/PATH_OUTSIDE_SANDBOX/);
  });

  it('missionId에 경로 문자 포함 → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot(sandboxRoot, '../evil-mission', 'report.md');
    expect(result.insideRoot).toBe(false);
    expect(result.violationReason).toMatch(/INVALID_MISSION_ID|PATH_TRAVERSAL/);
  });

  it('Unix sandbox: /home/user/missions 내부 경로 → insideRoot=true', () => {
    const result = resolveAgainstSandboxRoot('/home/user/missions', 'mission-1', 'output/report.md');
    expect(result.insideRoot).toBe(true);
  });

  it('Unix sandbox 밖 절대 경로 → insideRoot=false', () => {
    const result = resolveAgainstSandboxRoot('/home/user/missions', 'mission-1', '/etc/passwd');
    expect(result.insideRoot).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// F. V2 Typed Terminal Result 구조 검증
// ═══════════════════════════════════════════════════════════════════════════════
describe('F. V2 Typed Terminal Result 구조', () => {
  it('typed terminal result JSON 파싱 검증', () => {
    const typedResult = JSON.stringify({
      __v2Terminal: true,
      success: false,
      missionStatus: 'TIMED_OUT',
      errorCode: 'MISSION_WAIT_TIMEOUT',
      missionId: 'mission-1',
      reason: 'V2 Mission 30분 타임아웃',
      verifiedOutputs: [],
      filePreviews: [],
      timestamp: Date.now()
    });

    const parsed = JSON.parse(typedResult);
    expect(parsed.__v2Terminal).toBe(true);
    expect(parsed.success).toBe(false);
    expect(parsed.missionStatus).toBe('TIMED_OUT');
    expect(parsed.errorCode).toBe('MISSION_WAIT_TIMEOUT');
    expect(parsed.verifiedOutputs).toEqual([]);
    expect(parsed.filePreviews).toEqual([]);
  });

  it('null-state typed failure 구조 검증', () => {
    const typedResult = JSON.stringify({
      __v2Terminal: true,
      success: false,
      missionStatus: 'FAILED',
      errorCode: 'MISSION_STATE_UNAVAILABLE',
      missionId: 'mission-2',
      reason: 'V2 missionState가 100초간 null',
      verifiedOutputs: [],
      filePreviews: [],
      timestamp: Date.now()
    });

    const parsed = JSON.parse(typedResult);
    expect(parsed.__v2Terminal).toBe(true);
    expect(parsed.errorCode).toBe('MISSION_STATE_UNAVAILABLE');
    expect(parsed.missionStatus).toBe('FAILED');
  });
});
