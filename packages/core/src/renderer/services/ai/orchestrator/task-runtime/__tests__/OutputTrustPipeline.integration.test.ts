/**
 * @file orchestrator/task-runtime/__tests__/OutputTrustPipeline.integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeterministicVerifier } from '../verification/verifiers/DeterministicVerifier';
import { OutputAttributionService } from '../verification/services/OutputAttributionService';
import { PreviewLayer } from '../artifact/PreviewLayer';
import type { IFileSystemAdapter } from '../artifact/IFileSystemAdapter';
import type { TaskResult, TaskOutputMode, ToolResultEvidenceData, TaskEvidence } from '../domain/types';

describe('Output Trust Pipeline Integration', () => {
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
      createDirectory: vi.fn()
    } as unknown as IFileSystemAdapter;
  });

  const createAttempt = (outputs: any[], evidence: TaskEvidence[]) => ({
    resultReference: {
      attemptId: 'att_1',
      createdAt: 100,
      status: 'VERIFYING',
      summary: '',
      outputs,
      evidence
    } as TaskResult
  });

  const createInput = (mode: TaskOutputMode, expectedOutputs: string[], outputs: any[], evidence: TaskEvidence[]) => ({
    taskId: 't1',
    taskState: { status: 'VERIFYING' } as any,
    taskDefinition: {
      id: 't1',
      title: 'T1',
      objective: '',
      dependencies: [],
      outputMode: mode,
      expectedFileOutputs: expectedOutputs
    },
    targetAttempt: createAttempt(outputs, evidence) as any
  });

  describe('Attribution & Evidence (Requirements A, B, C, D, E, F)', () => {
    it('[E] Evidence + Artifact + Real File -> PASS', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 100, isDirectory: false });
      const verifier = new DeterministicVerifier(mockFs);
      
      const evidence: TaskEvidence[] = [{
        source: 'tool_result',
        timestamp: 123,
        data: {
          toolCallId: 'tc1',
          toolName: 'append_file',
          status: 'SUCCESS',
          description: '',
          args: { path: 'test.md' },
          taskId: 't1',
          missionId: 'm1',
          operationType: 'APPEND',
          expectedOutputPath: 'test.md'
        } as ToolResultEvidenceData
      }];

      const outputs = [{ type: 'file', path: 'test.md', content: 'hello' }];

      const input = createInput('FILE_OUTPUT_REQUIRED', ['test.md'], outputs, evidence);
      const results = await verifier.verify(input as any);
      expect(results.filter(r => r.verdict === 'FAIL')).toHaveLength(0);
    });

    it('[C] Evidence exists, but Artifact not declared -> FAIL', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 100, isDirectory: false });
      const verifier = new DeterministicVerifier(mockFs);
      
      const evidence: TaskEvidence[] = [{
        source: 'tool_result',
        timestamp: 123,
        data: {
          toolCallId: 'tc1',
          toolName: 'append_file',
          status: 'SUCCESS',
          description: '',
          args: { path: 'test.md' },
          taskId: 't1',
          missionId: 'm1',
          operationType: 'APPEND',
          expectedOutputPath: 'test.md'
        } as ToolResultEvidenceData
      }];

      // Missing outputs definition for 'test.md'
      const outputs: any[] = []; 

      const input = createInput('FILE_OUTPUT_REQUIRED', ['test.md'], outputs, evidence);
      const results = await verifier.verify(input as any);
      const fails = results.filter(r => r.verdict === 'FAIL');
      expect(fails.length).toBeGreaterThan(0);
      expect(fails[0].defect?.type).toBe('ARTIFACT_DECLARATION_MISSING');
    });

    it('[D] Artifact exists, but Real File missing -> FAIL', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: false, size: 0, isDirectory: false });
      const verifier = new DeterministicVerifier(mockFs);
      
      const evidence: TaskEvidence[] = [{
        source: 'tool_result',
        timestamp: 123,
        data: {
          toolCallId: 'tc1',
          toolName: 'append_file',
          status: 'SUCCESS',
          description: '',
          args: { path: 'test.md' },
          taskId: 't1',
          missionId: 'm1',
          operationType: 'APPEND',
          expectedOutputPath: 'test.md'
        } as ToolResultEvidenceData
      }];

      const outputs = [{ type: 'file', path: 'test.md', content: '' }];

      const input = createInput('FILE_OUTPUT_REQUIRED', ['test.md'], outputs, evidence);
      const results = await verifier.verify(input as any);
      const fails = results.filter(r => r.verdict === 'FAIL');
      expect(fails.length).toBeGreaterThan(0);
      expect(fails[0].defect?.type).toBe('OUTPUT_FILE_NOT_FOUND');
    });

    it('[F] Empty file created (size 0) -> FAIL', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 0, isDirectory: false });
      const verifier = new DeterministicVerifier(mockFs);
      
      const evidence: TaskEvidence[] = [{
        source: 'tool_result',
        timestamp: 123,
        data: {
          toolCallId: 'tc1',
          toolName: 'append_file',
          status: 'SUCCESS',
          description: '',
          args: { path: 'test.md' },
          taskId: 't1',
          missionId: 'm1',
          operationType: 'APPEND',
          expectedOutputPath: 'test.md'
        } as ToolResultEvidenceData
      }];

      const outputs = [{ type: 'file', path: 'test.md', content: '' }];

      const input = createInput('FILE_OUTPUT_REQUIRED', ['test.md'], outputs, evidence);
      const results = await verifier.verify(input as any);
      const fails = results.filter(r => r.verdict === 'FAIL');
      expect(fails.length).toBeGreaterThan(0);
      expect(fails[0].defect?.type).toBe('OUTPUT_FILE_EMPTY_OR_UNCHANGED');
    });
  });

  describe('PreviewLayer (Requirements G, H)', () => {
    it('[G] Large file -> Preview truncation', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 5000, isDirectory: false });
      const largeContent = 'a'.repeat(4000);
      vi.mocked(mockFs.read).mockResolvedValue(largeContent);

      const preview = await PreviewLayer.generatePreview('big.txt', mockFs, 3000);
      
      expect(preview.exists).toBe(true);
      expect(preview.isBinary).toBe(false);
      expect(preview.isTruncated).toBe(true);
      expect(preview.preview.length).toBeGreaterThan(3000);
      expect(preview.preview).toContain('... (파일 크기가 커서 3000자까지만 표시됩니다.');
    });

    it('[H] Binary file -> Raw content blocked', async () => {
      vi.mocked(mockFs.stat).mockResolvedValue({ exists: true, size: 1024, isDirectory: false });
      
      const preview = await PreviewLayer.generatePreview('image.png', mockFs, 3000);
      
      expect(preview.exists).toBe(true);
      expect(preview.isBinary).toBe(true);
      expect(preview.isTruncated).toBe(true);
      expect(preview.preview).toContain('바이너리 파일은 미리보기를 지원하지 않습니다');
      expect(mockFs.read).not.toHaveBeenCalled();
    });
  });
});
