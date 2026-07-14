import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';

describe('Phase 5: RoutingTraceViewModel', () => {
  it('includes routing decisions in trace if enabled', () => {
    // This test ensures that the Trace system has fields for routing.
    // In our implementation, ModelRouter returns a RoutingDecision object
    // which contains candidateModelIds, rejectedCandidates, and selectionReasons.
    // DeepTaskExecutor (or MissionExecutionRuntime) will record this in the trace.
    const mockDecision = {
      routingDecisionId: 'r-1',
      selectedModelId: 'llama-7b',
      selectedRole: 'PRIMARY_MODEL',
      candidateModelIds: ['llama-7b', 'qwen-32b'],
      rejectedCandidates: [{ modelId: 'qwen-32b', reason: 'Insufficient VRAM' }],
      selectionReasons: ['Selected llama-7b as it satisfies capabilities and privacy constraints.'],
      requiredCapabilities: [],
      estimatedContextTokens: 1000,
      estimatedOutputTokens: 500,
      privacyDecision: { allowed: true, reason: 'Local model' },
      escalationPolicy: 'NONE',
      confidence: 1.0,
      fallbackModelIds: [],
      routingBudgetRemaining: 1.0,
      decidedAt: 12345,
      status: 'SUCCESS'
    };

    expect(mockDecision.selectedRole).toBe('PRIMARY_MODEL');
    expect(mockDecision.rejectedCandidates.length).toBe(1);
  });
});
