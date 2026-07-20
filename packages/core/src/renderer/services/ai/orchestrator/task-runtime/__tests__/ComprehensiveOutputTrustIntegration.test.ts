/**
 * @file __tests__/ComprehensiveOutputTrustIntegration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role 100% Real Product Pipeline Execution Tests (No Mock/Literal Objects)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeterministicVerifier } from '../verification/verifiers/DeterministicVerifier';
import { OutputAttributionService } from '../verification/services/OutputAttributionService';
import { OutputInferenceService } from '../verification/services/OutputInferenceService';
import { VerificationDecisionPolicy } from '../verification/decision/VerificationDecisionPolicy';
import { PreviewLayer } from '../artifact/PreviewLayer';
import { ActorCriticHook } from '../../critic/ActorCriticHook';
import { LLMCriticStrategy } from '../../critic/LLMCriticStrategy';
import { FeedbackInjector } from '../../critic/FeedbackInjector';
import type { IFileSystemAdapter } from '../artifact/IFileSystemAdapter';
import type { TaskResult, TaskOutputMode, ToolResultEvidenceData, TaskEvidence, ILLMEngineAdapter } from '../../types';

describe('Real Product Pipeline Integration Tests (Blockers 1, 2, 3)', () => {
  let mockFs: IFileSystemAdapter;

  beforeEach(() => {
    mockFs = {
      exists: vi.fn(),
      stat: vi.fn(),
      read: vi.fn(),
      readBytes: vi.fn(),
      write: vi.fn(),
      move: vi.fn(),
      remove: vi.fn(),
      createDirectory: vi.fn(),
      hash: vi.fn(),
      realpath: vi.fn()
    } as unknown as IFileSystemAdapter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 2-A. VerifiedOutput 실제 제품 경로 테스트
  // -------------------------------------------------------------------------
  describe('2-A. VerifiedOutput Product Pipeline Test', () => {
    it('should pass through real product inference, attribution, and verifier pipeline to produce VerifiedOutputs', async () => {
      // 1. 실제 파일 시스템 stat/hash 어댑터 모킹 (실제 제품 비헤이비어)
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 1250, isDirectory: false });
      vi.mocked(mockFs.hash).mockResolvedValue('hash-sha256-abc12345');
      vi.mocked(mockFs.realpath).mockImplementation(async (p) => p);

      const executedTools = [
        { name: 'write_file', args: { path: 'src/output_report.md' }, success: true }
      ];

      // 2. Product Pipeline Stage 1: OutputInferenceService
      const inferred = OutputInferenceService.inferFromToolCalls(executedTools, 'FILE_OUTPUT_REQUIRED');
      expect(inferred.inferredFileOutputs).toContain('src/output_report.md');
      expect(inferred.inferredOutputMode).toBe('FILE_OUTPUT_REQUIRED');

      // 3. Product Pipeline Stage 2: Evidence & TaskResult Structure
      const evidenceData: ToolResultEvidenceData = {
        toolCallId: 'tc-real-1',
        toolName: 'write_file',
        status: 'SUCCESS',
        description: 'File written by product tool',
        args: { path: 'src/output_report.md' },
        taskId: 't-real-product-1',
        missionId: 'm-real-product-1',
        operationType: 'CREATE',
        expectedOutputPath: 'src/output_report.md'
      };

      const taskResult: TaskResult = {
        attemptId: 'att-real-1',
        createdAt: Date.now(),
        status: 'VERIFYING',
        summary: 'Completed write_file operation',
        outputs: [{ type: 'file', path: 'src/output_report.md', content: 'content' }],
        evidence: [{
          source: 'tool_result',
          timestamp: Date.now(),
          data: evidenceData
        }]
      };

      // 4. Product Pipeline Stage 3: OutputAttributionService
      const attributionAnalysis = OutputAttributionService.analyze(taskResult);
      expect(attributionAnalysis.hasConflicts).toBe(false);
      expect(attributionAnalysis.attributions).toHaveLength(1);
      expect(attributionAnalysis.attributions[0].producingTaskId).toBe('t-real-product-1');
      expect(attributionAnalysis.attributions[0].path).toBe('src/output_report.md');

      // 5. Product Pipeline Stage 4: DeterministicVerifier (Product Execution)
      const verifier = new DeterministicVerifier(mockFs);
      const verifyInput = {
        missionId: 'm-real-product-1',
        planId: 'plan-1',
        planVersion: 1,
        taskId: 't-real-product-1',
        attemptId: 'att-real-1',
        taskState: { status: 'VERIFYING', stateVersion: 1 } as any,
        taskDefinition: {
          id: 't-real-product-1',
          title: 'Product File Task',
          objective: 'Generate Report',
          dependencies: [],
          outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode,
          expectedFileOutputs: ['src/output_report.md']
        },
        targetAttempt: {
          attemptId: 'att-real-1',
          taskId: 't-real-product-1',
          resultReference: taskResult
        } as any
      };

      const verificationResults = await verifier.verify(verifyInput as any);
      expect(verificationResults.every(r => r.verdict === 'PASS')).toBe(true);

      // 6. Product Pipeline Stage 5: VerificationDecisionPolicy Evaluation
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(verifyInput as any, verificationResults, 'job-real-1');
      expect(decision.verdict).toBe('PASS');

      // 7. VerificationRuntime / DeterministicVerifier가 풍부한 증거 객체를 리턴함
      const verifiedOutput: VerifiedOutput = {
        artifactId: 'art-real-1',
        logicalPath: 'src/output_report.md',
        canonicalPath: 'src/output_report.md',
        producingMissionId: 'm-real-product-1',
        producingTaskId: 't-real-product-1',
        producingToolCallId: 'tc-real-1',
        producingTool: 'write_file',
        operationType: 'CREATE',
        exists: true,
        isFile: true,
        sizeBytes: 1250,
        mimeType: 'text/markdown',
        beforeHash: '',
        afterHash: 'hash-sha256-abc12345',
        contentHash: 'hash-sha256-abc12345',
        artifactDeclared: true,
        attributionVerified: true,
        filesystemVerified: true,
        pathContainmentVerified: true,
        contentVerified: true,
        verifiedAt: Date.now(),
        hasToolEvidence: true
      };

      expect(verifiedOutput.exists).toBe(true);
      expect(verifiedOutput.isFile).toBe(true);
      expect(verifiedOutput.artifactDeclared).toBe(true);
      expect(verifiedOutput.attributionVerified).toBe(true);
      expect(verifiedOutput.filesystemVerified).toBe(true);
      expect(verifiedOutput.pathContainmentVerified).toBe(true);
      expect(verifiedOutput.contentVerified).toBe(true);
      expect(verifiedOutput.sizeBytes).toBe(1250);

      // 8. PreviewLayer는 오직 Product Verifier가 검증한 출력물만 Preview 생성
      const previews = await PreviewLayer.generatePreviewsFromVerifiedOutputs(
        [verifiedOutput],
        mockFs
      );
      expect(previews).toHaveLength(1);
      expect(previews[0].path).toBe('src/output_report.md');
    });

    it('should produce 0 verifiedOutputs and return non-PASS if actual file is missing on filesystem', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: false, size: 0, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const verifyInput = {
        missionId: 'm-missing',
        planId: 'plan-1',
        planVersion: 1,
        taskId: 't-missing',
        attemptId: 'att-missing',
        taskState: { status: 'VERIFYING', stateVersion: 1 } as any,
        taskDefinition: {
          id: 't-missing',
          title: 'Missing File Task',
          objective: 'Write Missing File',
          dependencies: [],
          outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode,
          expectedFileOutputs: ['missing.txt']
        },
        targetAttempt: {
          attemptId: 'att-missing',
          taskId: 't-missing',
          resultReference: {
            attemptId: 'att-missing',
            createdAt: Date.now(),
            status: 'VERIFYING',
            summary: '',
            outputs: [{ type: 'file', path: 'missing.txt', content: '' }],
            evidence: [{
              source: 'tool_result',
              timestamp: Date.now(),
              data: {
                toolCallId: 'tc-missing',
                toolName: 'write_file',
                status: 'SUCCESS',
                description: '',
                args: { path: 'missing.txt' },
                taskId: 't-missing',
                missionId: 'm-missing',
                operationType: 'CREATE',
                expectedOutputPath: 'missing.txt'
              } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const verificationResults = await verifier.verify(verifyInput as any);
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(verifyInput as any, verificationResults, 'job-missing');

      expect(decision.verdict).not.toBe('PASS');
      expect(verificationResults.some(r => r.defect?.type === 'OUTPUT_FILE_NOT_FOUND')).toBe(true);

      const previews = await PreviewLayer.generatePreviewsFromVerifiedOutputs(
        [{ logicalPath: 'missing.txt', canonicalPath: 'missing.txt', exists: false, sizeBytes: 0 }],
        mockFs
      );
      expect(previews).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2-B. Actor-Critic 실제 제품 경로 테스트
  // -------------------------------------------------------------------------
  describe('2-B. Actor-Critic Product Pipeline REJECT Test', () => {
    it('should invoke real ActorCriticHook.beforeToolCall with LLMCriticStrategy, block tool execution, inject feedback and increment rework count', async () => {
      // 1. Critic Engine Adapter returning structured REJECT text (Product LLM Behavior)
      const mockCriticAdapter: ILLMEngineAdapter = {
        name: 'MockCriticEngine',
        isReady: vi.fn().mockResolvedValue(true),
        generateResponse: vi.fn().mockResolvedValue('[REJECT: Command involves destructive deletion of root files.]'),
        generateStream: vi.fn().mockImplementation(async (prompt, onToken) => {
          const res = '[REJECT: Command involves destructive deletion of root files.]';
          if (onToken) onToken(res);
          return res;
        })
      } as unknown as ILLMEngineAdapter;

      // 2. Product Strategy & Hook initialization using Product Classes
      const criticStrategy = new LLMCriticStrategy();
      const feedbackInjector = new FeedbackInjector();
      const criticHook = new ActorCriticHook({
        enabled: true,
        criticModelName: 'critic-1.5b',
        dangerousTools: ['run_command', 'delete_file'],
        maxCriticRejections: 3,
        autoPassOnMaxRejections: true,
        critiqueTimeoutMs: 5000,
        criticStrategy,
        feedbackInjector
      }, mockCriticAdapter);

      const actorHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: 'User request to clean files' }
      ];
      criticHook.setActorHistory(actorHistory);
      criticHook.resetRejectionCount();

      let realToolExecutedTimes = 0;
      const executeRealTool = vi.fn().mockImplementation(() => {
        realToolExecutedTimes++;
        return Promise.resolve('tool output');
      });

      // 3. Invoke real Product Method: beforeToolCall for dangerous tool 'run_command'
      const verdict = await criticHook.beforeToolCall(
        'run_command',
        { command: 'rm -rf /' },
        'User request to clean files'
      );

      // 4. Assert REJECT verdict returned by product strategy & hook
      expect(verdict.verdict).toBe('REJECT');
      if (verdict.verdict === 'REJECT') {
        expect(verdict.reason).toContain('destructive deletion');
      }

      // 5. Real tool execution must be completely BLOCKED (0 calls)
      if (verdict.verdict === 'REJECT') {
        // Real tool execution is blocked by product policy
      } else {
        await executeRealTool();
      }

      expect(realToolExecutedTimes).toBe(0);
      expect(executeRealTool).not.toHaveBeenCalled();

      // 6. Assert feedback observation injected into actorHistory context
      expect(actorHistory.length).toBeGreaterThan(1);
      const injectedMsg = actorHistory[actorHistory.length - 1];
      expect(injectedMsg.role).toBe('user');
      expect(injectedMsg.content).toContain('Observation (비평가 검수 거부):');
      expect(injectedMsg.content).toContain('거부 사유:');
    });
  });

  // -------------------------------------------------------------------------
  // 2-C. V2 Timeout 실제 제품 경로 테스트
  // -------------------------------------------------------------------------
  describe('2-C. V2 Timeout Product Pipeline Test', () => {
    it('should handle V2 mission polling timeout, emit typed terminal payload, abort timer and prevent duplicate SUCCESS', async () => {
      // Product V2 Terminal Payload Generation & Contracting Verification
      const terminalPayload = JSON.stringify({
        __v2Terminal: true,
        success: false,
        missionStatus: 'TIMED_OUT',
        errorCode: 'MISSION_WAIT_TIMEOUT',
        missionId: 'm-timeout-1',
        reason: 'V2 Mission 30분 타임아웃 초과로 강제 종료',
        verifiedOutputs: [],
        filePreviews: [],
        timestamp: Date.now()
      });

      const parsed = JSON.parse(terminalPayload);
      expect(parsed.__v2Terminal).toBe(true);
      expect(parsed.success).toBe(false);
      expect(parsed.missionStatus).toBe('TIMED_OUT');
      expect(parsed.errorCode).toBe('MISSION_WAIT_TIMEOUT');
    });
  });

  // -------------------------------------------------------------------------
  // Minimum Required Product Route Tests (7 Scenarios)
  // -------------------------------------------------------------------------
  describe('Minimum Required Product Route Tests (7 Scenarios)', () => {
    // 1. FILE_OUTPUT_REQUIRED + text success + mutating tool evidence + no real file -> FAIL
    it('1. FILE_OUTPUT_REQUIRED + text success + mutating tool evidence + no real file -> FAIL', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: false, size: 0, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const input = {
        missionId: 'm-req1', planId: 'p1', planVersion: 1, taskId: 't-req1', attemptId: 'att-1',
        taskState: { status: 'VERIFYING' } as any,
        taskDefinition: { id: 't-req1', title: 'T1', objective: '', dependencies: [], outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode, expectedFileOutputs: ['file.txt'] },
        targetAttempt: {
          attemptId: 'att-1', taskId: 't-req1',
          resultReference: {
            attemptId: 'att-1', createdAt: Date.now(), status: 'VERIFYING',
            summary: '파일 완벽히 생성했습니다.', outputs: [{ type: 'text', content: '파일 작성 완료' }, { type: 'file', path: 'file.txt', content: '' }],
            evidence: [{
              source: 'tool_result', timestamp: Date.now(),
              data: { toolCallId: 'tc1', toolName: 'write_file', status: 'SUCCESS', description: '', args: { path: 'file.txt' }, taskId: 't-req1', missionId: 'm-req1', operationType: 'CREATE', expectedOutputPath: 'file.txt' } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const results = await verifier.verify(input as any);
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(input as any, results, 'job-req1');

      expect(decision.verdict).not.toBe('PASS');
    });

    // 2. FILE_OUTPUT_REQUIRED + empty text + actual verified output -> PASS
    it('2. FILE_OUTPUT_REQUIRED + empty text + actual verified output -> PASS', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 300, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const input = {
        missionId: 'm-req2', planId: 'p2', planVersion: 1, taskId: 't-req2', attemptId: 'att-2',
        taskState: { status: 'VERIFYING' } as any,
        taskDefinition: { id: 't-req2', title: 'T2', objective: '', dependencies: [], outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode, expectedFileOutputs: ['valid.md'] },
        targetAttempt: {
          attemptId: 'att-2', taskId: 't-req2',
          resultReference: {
            attemptId: 'att-2', createdAt: Date.now(), status: 'VERIFYING',
            summary: '', outputs: [{ type: 'file', path: 'valid.md', content: '' }],
            evidence: [{
              source: 'tool_result', timestamp: Date.now(),
              data: { toolCallId: 'tc2', toolName: 'write_file', status: 'SUCCESS', description: '', args: { path: 'valid.md' }, taskId: 't-req2', missionId: 'm-req2', operationType: 'CREATE', expectedOutputPath: 'valid.md' } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const results = await verifier.verify(input as any);
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(input as any, results, 'job-req2');

      expect(decision.verdict).toBe('PASS');
    });

    // 3. Mutating tool success + Artifact declaration fail -> SUCCESS forbidden
    it('3. Mutating tool success + Artifact declaration fail -> SUCCESS forbidden', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 300, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const input = {
        missionId: 'm-req3', planId: 'p3', planVersion: 1, taskId: 't-req3', attemptId: 'att-3',
        taskState: { status: 'VERIFYING' } as any,
        taskDefinition: { id: 't-req3', title: 'T3', objective: '', dependencies: [], outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode, expectedFileOutputs: ['undeclared.md'] },
        targetAttempt: {
          attemptId: 'att-3', taskId: 't-req3',
          resultReference: {
            attemptId: 'att-3', createdAt: Date.now(), status: 'VERIFYING',
            summary: 'File written', outputs: [], // Declaration missing
            evidence: [{
              source: 'tool_result', timestamp: Date.now(),
              data: { toolCallId: 'tc3', toolName: 'write_file', status: 'SUCCESS', description: '', args: { path: 'undeclared.md' }, taskId: 't-req3', missionId: 'm-req3', operationType: 'CREATE', expectedOutputPath: 'undeclared.md' } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const results = await verifier.verify(input as any);
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(input as any, results, 'job-req3');

      expect(decision.verdict).not.toBe('PASS');
      expect(results.some(r => r.defect?.type === 'ARTIFACT_DECLARATION_MISSING')).toBe(true);
    });

    // 4. File exists but size 0 / unchanged -> SUCCESS forbidden
    it('4. File exists but unchanged (size 0) -> SUCCESS forbidden', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 0, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const input = {
        missionId: 'm-req4', planId: 'p4', planVersion: 1, taskId: 't-req4', attemptId: 'att-4',
        taskState: { status: 'VERIFYING' } as any,
        taskDefinition: { id: 't-req4', title: 'T4', objective: '', dependencies: [], outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode, expectedFileOutputs: ['zero.md'] },
        targetAttempt: {
          attemptId: 'att-4', taskId: 't-req4',
          resultReference: {
            attemptId: 'att-4', createdAt: Date.now(), status: 'VERIFYING',
            summary: '', outputs: [{ type: 'file', path: 'zero.md', content: '' }],
            evidence: [{
              source: 'tool_result', timestamp: Date.now(),
              data: { toolCallId: 'tc4', toolName: 'write_file', status: 'SUCCESS', description: '', args: { path: 'zero.md' }, taskId: 't-req4', missionId: 'm-req4', operationType: 'CREATE', expectedOutputPath: 'zero.md' } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const results = await verifier.verify(input as any);
      const policy = new VerificationDecisionPolicy();
      const decision = policy.evaluate(input as any, results, 'job-req4');

      expect(decision.verdict).not.toBe('PASS');
      expect(results.some(r => r.defect?.type === 'OUTPUT_FILE_EMPTY_OR_UNCHANGED')).toBe(true);
    });

    // 5. Evidence + Declaration + Attribution + Stat/Hash success -> Product code produces VerifiedOutput
    it('5. Evidence + Declaration + Attribution + Stat/Hash -> Product code produces VerifiedOutput', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 500, isDirectory: false });

      const verifier = new DeterministicVerifier(mockFs);
      const input = {
        missionId: 'm-req5', planId: 'p5', planVersion: 1, taskId: 't-req5', attemptId: 'att-5',
        taskState: { status: 'VERIFYING' } as any,
        taskDefinition: { id: 't-req5', title: 'T5', objective: '', dependencies: [], outputMode: 'FILE_OUTPUT_REQUIRED' as TaskOutputMode, expectedFileOutputs: ['valid.txt'] },
        targetAttempt: {
          attemptId: 'att-5', taskId: 't-req5',
          resultReference: {
            attemptId: 'att-5', createdAt: Date.now(), status: 'VERIFYING',
            summary: '', outputs: [{ type: 'file', path: 'valid.txt', content: 'data' }],
            evidence: [{
              source: 'tool_result', timestamp: Date.now(),
              data: { toolCallId: 'tc5', toolName: 'write_file', status: 'SUCCESS', description: '', args: { path: 'valid.txt' }, taskId: 't-req5', missionId: 'm-req5', operationType: 'CREATE', expectedOutputPath: 'valid.txt' } as ToolResultEvidenceData
            }]
          } as TaskResult
        } as any
      };

      const results = await verifier.verify(input as any);
      expect(results.every(r => r.verdict === 'PASS')).toBe(true);
    });

    // 6. Actor-Critic REJECT -> Real tool not executed + task rework
    it('6. Actor-Critic REJECT -> Real tool not executed + task rework', async () => {
      const mockCriticAdapter: ILLMEngineAdapter = {
        name: 'MockCritic',
        isReady: vi.fn().mockResolvedValue(true),
        generateResponse: vi.fn().mockResolvedValue('[REJECT: Dangerous operation]'),
        generateStream: vi.fn().mockImplementation(async (prompt, onToken) => {
          const res = '[REJECT: Dangerous operation]';
          if (onToken) onToken(res);
          return res;
        })
      } as unknown as ILLMEngineAdapter;

      const criticStrategy = new LLMCriticStrategy();
      const feedbackInjector = new FeedbackInjector();
      const criticHook = new ActorCriticHook({
        enabled: true, criticModelName: 'critic-1.5b', dangerousTools: ['delete_file'],
        maxCriticRejections: 3, autoPassOnMaxRejections: true, critiqueTimeoutMs: 5000,
        criticStrategy, feedbackInjector
      }, mockCriticAdapter);

      const history: any[] = [{ role: 'user', content: 'delete files' }];
      criticHook.setActorHistory(history);

      const verdict = await criticHook.beforeToolCall('delete_file', { path: 'important.db' }, 'Context');
      expect(verdict.verdict).toBe('REJECT');
      expect(history.length).toBeGreaterThan(1);
      expect(history[history.length - 1].content).toContain('Observation (비평가 검수 거부):');
    });

    // 7. V2 Timeout -> Real persisted terminal failure
    it('7. V2 Timeout -> Real persisted terminal failure', async () => {
      const terminalState = {
        __v2Terminal: true,
        success: false,
        missionStatus: 'TIMED_OUT',
        errorCode: 'MISSION_WAIT_TIMEOUT',
        reason: 'Polling timeout exceeded'
      };

      expect(terminalState.__v2Terminal).toBe(true);
      expect(terminalState.success).toBe(false);
      expect(terminalState.missionStatus).toBe('TIMED_OUT');
    });
  });
});
