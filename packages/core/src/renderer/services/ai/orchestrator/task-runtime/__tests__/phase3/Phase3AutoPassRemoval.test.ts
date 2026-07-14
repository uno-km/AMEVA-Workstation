import { describe, it, expect, vi } from 'vitest';
import { SemanticVerifier } from '../../verification/verifiers/SemanticVerifier';
import type { ILLMEngineAdapter } from '../../../../types';

describe('Phase 3.1 Semantic Verifier Auto-PASS Removal & Repair', () => {
  it('1. Rejects plain text PASS and maps to UNCERTAIN', async () => {
    const mockAdapter: ILLMEngineAdapter = {
      isReady: () => true,
      generateStream: vi.fn().mockImplementation(async (prompt, onToken) => {
        return 'PASS'; // Simulating bad LLM behavior
      }),
      getEngineInfo: vi.fn() as any
    };

    const verifier = new SemanticVerifier(mockAdapter);

    const input = {
      missionId: 'm1',
      taskDefinition: {
        id: 't1',
        title: 'T1',
        acceptanceCriteria: ['Requirement A']
      },
      taskState: {
        taskResult: {
          summary: 'Done'
        }
      }
    } as any;

    const results = await verifier.verify(input);
    expect(results).toHaveLength(1);
    
    // Auto-PASS block means it shouldn't be PASS
    expect(results[0].verdict).toBe('UNCERTAIN');
    expect(results[0].defect?.type).toBe('CRITIC_RESPONSE_INVALID');
    // Because it fails twice (retry), llmCallCount should be 2
    expect(results[0].llmCallCount).toBe(2);
  });

  it('2. Successfully applies deterministic local JSON repair without extra LLM calls', async () => {
    let callCount = 0;
    const mockAdapter: ILLMEngineAdapter = {
      isReady: () => true,
      generateStream: vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulating LLM returning JSON with a trailing comma which JSON.parse rejects natively
        return `{
          "verdict": "FAIL",
          "reason": "Test",
          "confidence": 0.5,
          "defects": [],
        }`; 
      }),
      getEngineInfo: vi.fn() as any
    };

    const verifier = new SemanticVerifier(mockAdapter);

    const input = {
      missionId: 'm1',
      taskDefinition: {
        id: 't1',
        title: 'T1',
        acceptanceCriteria: ['Requirement A']
      },
      taskState: { taskResult: { summary: 'Done' } }
    } as any;

    const results = await verifier.verify(input);
    expect(results).toHaveLength(1);
    
    // It should successfully parse the fixed JSON and return FAIL
    expect(results[0].verdict).toBe('FAIL');
    
    // It should have only called LLM once because local repair succeeded
    expect(results[0].llmCallCount).toBe(1);
    expect(callCount).toBe(1);
  });
});
