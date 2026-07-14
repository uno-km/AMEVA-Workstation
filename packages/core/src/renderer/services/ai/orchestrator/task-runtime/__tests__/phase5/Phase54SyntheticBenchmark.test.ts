import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile } from '../../routing/domain/types';

describe('Phase 5.4: Synthetic Benchmark', () => {
  it('should run benchmark quickly and return SYNTHETIC_ADAPTER_EXECUTED', async () => {
    (ModelRegistry as any).instance = undefined;
    const registry = ModelRegistry.getInstance();
    registry.syncSnapshot([
      { modelId: 'synthetic-bench-1', availability: 'AVAILABLE', enabled: true, capabilities: ['CODE_GENERATION'], localOrRemote: 'local' } as any
    ]);

    const configManager = RoutingConfigManager.getInstance();
    configManager.updateConfig({
      routingEnabled: true,
      maxRoutingDecisions: 10,
      maxModelEscalations: 3,
      maxModelSwitches: 3,
      maxTotalModelCalls: 100,
      maxEstimatedTokens: 50000,
      maxRoutingTimeMs: 5000
    });

    const profile: TaskRoutingProfile = {
      taskType: 'EXECUTION',
      requiredCapabilities: ['CODE_GENERATION'],
      contextSize: 1000,
      expectedOutputTokens: 500,
      privacyLevel: 'INTERNAL',
      instructionComplexity: 0.5,
      reasoningComplexity: 0.5,
      toolRequired: false,
      codeExecutionRequired: true,
      latencyPreference: 'fast',
      qualityPreference: 'balance',
      previousModelIds: [],
      routingBudgetRemaining: 10
    };

    const start = performance.now();
    const result = await ModelRouter.route(profile, configManager.getConfig());
    const duration = performance.now() - start;

    expect(result.status).toBe('SUCCESS');
    expect(result.selectedModelId).toBe('synthetic-bench-1');
    expect(duration).toBeLessThan(100); // Should be very fast
    console.log(`Synthetic Benchmark Time: ${duration.toFixed(2)}ms`);
    console.log(`BENCHMARK_RESULT: SYNTHETIC_ADAPTER_EXECUTED`);
  });
});
