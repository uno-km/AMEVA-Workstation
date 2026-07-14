import { describe, it, expect, vi } from 'vitest';
import { TaskVerifierCoordinator } from '../../verification/verifiers/TaskVerifierCoordinator';
import type { ILLMEngineAdapter } from '../../../../types';
import type { IFileSystemAdapter } from '../../../artifact/IFileSystemAdapter';

describe('Phase 3 Verifier Pipeline Integration', () => {
  it('1. Deterministic failure skips Contract and Semantic layers', async () => {
    const mockAdapter: ILLMEngineAdapter = {
      isReady: () => true,
      generateStream: vi.fn(),
      getEngineInfo: vi.fn() as any
    };

    const mockFileAdapter: IFileSystemAdapter = {
      read: vi.fn(),
      write: vi.fn(),
      delete: vi.fn(),
      move: vi.fn(),
      copy: vi.fn(),
      exists: vi.fn().mockResolvedValue(false), // Deterministic failure! File doesn't exist
      stat: vi.fn(),
      list: vi.fn(),
      mkdir: vi.fn(),
      rmdir: vi.fn(),
      hash: vi.fn()
    };

    const coordinator = new TaskVerifierCoordinator(mockAdapter, mockFileAdapter);

    const input = {
      missionId: 'm1',
      planId: 'p1',
      planVersion: 1,
      taskId: 't1',
      attemptId: 'a1',
      taskDefinition: {
        id: 't1',
        title: 'Test Task',
        dependencies: [],
        expectedOutputs: ['output.txt'], // Requires file
        acceptanceCriteria: ['Must do XYZ']
      },
      taskState: {
        taskResult: {
          summary: 'Done',
          attemptId: 'a1',
          artifacts: ['output.txt']
        }
      },
      targetAttempt: {
        executionId: 'exec1',
        resultReference: { attemptId: 'a1' }
      }
    } as any;

    const contractSpy = vi.spyOn(coordinator['contractVerifiers'][0], 'verify');
    const semanticSpy = vi.spyOn(coordinator['semanticVerifiers'][0], 'verify');

    const results = await coordinator.runVerificationPipeline(input);

    // Verify deterministic failed
    expect(results.some(r => r.verdict === 'FAIL' && r.verifierType === 'DETERMINISTIC_VERIFIER')).toBe(true);

    // Verify contract and semantic were skipped (called 0 times)
    expect(contractSpy).not.toHaveBeenCalled();
    expect(semanticSpy).not.toHaveBeenCalled();
    expect(mockAdapter.generateStream).not.toHaveBeenCalled();
  });
});
