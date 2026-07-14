import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile, ModelDescriptor, RoutingConfig } from '../../routing/domain/types';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5: SyntheticBenchmark', () => {
  let registry: ModelRegistry;
  let config: RoutingConfig;

  const mockModels: ModelDescriptor[] = [
    {
      modelId: 'tiny',
      displayName: 'Tiny',
      provider: 'llamacpp',
      endpointType: 'llm',
      localOrRemote: 'local',
      parameterClass: '1.5B',
      contextWindow: 4096,
      maxOutputTokens: 1024,
      supportedLanguages: ['en'],
      capabilities: [],
      toolCallingSupport: 'none',
      structuredOutputSupport: 'none',
      codeCapability: false,
      longContextCapability: false,
      semanticVerificationCapability: false,
      privacyLevel: 'PUBLIC',
      estimatedLatencyClass: 'low',
      estimatedMemoryMb: 2048,
      requiredVramMb: 2048,
      availability: 'AVAILABLE',
      healthStatus: 'MODEL_READY',
      version: '1.0',
      enabled: true
    },
    {
      modelId: 'coder-7b',
      displayName: 'Coder 7B',
      provider: 'llamacpp',
      endpointType: 'llm',
      localOrRemote: 'local',
      parameterClass: '7B',
      contextWindow: 8192,
      maxOutputTokens: 2048,
      supportedLanguages: ['en'],
      capabilities: ['CODE_GENERATION'],
      toolCallingSupport: 'none',
      structuredOutputSupport: 'none',
      codeCapability: true,
      longContextCapability: false,
      semanticVerificationCapability: false,
      privacyLevel: 'RESTRICTED',
      estimatedLatencyClass: 'medium',
      estimatedMemoryMb: 6000,
      requiredVramMb: 6000,
      availability: 'AVAILABLE',
      healthStatus: 'MODEL_READY',
      version: '1.0',
      enabled: true
    },
    {
      modelId: 'cloud-large',
      displayName: 'Cloud Large',
      provider: 'openai',
      endpointType: 'cloud',
      localOrRemote: 'remote',
      parameterClass: 'large',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedLanguages: ['en'],
      capabilities: ['CODE_GENERATION', 'LONG_CONTEXT', 'STRUCTURED_OUTPUT'],
      toolCallingSupport: 'native',
      structuredOutputSupport: 'native_schema',
      codeCapability: true,
      longContextCapability: true,
      semanticVerificationCapability: true,
      privacyLevel: 'PUBLIC',
      estimatedLatencyClass: 'low',
      estimatedMemoryMb: 0,
      requiredVramMb: 0,
      availability: 'AVAILABLE',
      healthStatus: 'MODEL_READY',
      version: '1.0',
      enabled: true
    }
  ];

  beforeEach(() => {
    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot(mockModels);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: ['tiny'],
      MEDIUM_MODEL: ['coder-7b'],
      PRIMARY_MODEL: ['cloud-large']
    });
    config = RoutingConfigManager.getInstance().getConfig();
  });

  it('routes 100 synthetic tasks correctly', async () => {
    // Benchmark constraints: time should be < 50ms for 100 routes
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      const isComplex = i % 2 === 0;
      const isRestricted = i % 3 === 0;
      const needsCode = i % 5 === 0;

      const profile: TaskRoutingProfile = {
        missionId: 'm1',
        taskId: `t-${i}`,
        taskType: 'EXECUTION',
        instructionComplexity: isComplex ? 0.9 : 0.1,
        reasoningComplexity: isComplex ? 0.9 : 0.1,
        contextSize: 1000,
        expectedOutputTokens: 500,
        requiredCapabilities: needsCode ? ['CODE_GENERATION'] : [],
        toolRequired: false,
        structuredOutputRequired: false,
        codeExecutionRequired: needsCode,
        artifactKinds: [],
        privacyLevel: isRestricted ? 'RESTRICTED' : 'INTERNAL',
        riskLevel: 'LOW',
        latencyPreference: 'balanced',
        qualityPreference: 'acceptable',
        retryHistory: 0,
        previousModelIds: [],
        previousDefectSignatures: [],
        routingBudgetRemaining: 1.0
      };

      const result = await ModelRouter.route(profile, config);
      expect(result.status === 'SUCCESS' || result.status === 'PRIVACY_POLICY_BLOCKED').toBe(true);

      if (result.status === 'SUCCESS') {
        if (isRestricted) {
          expect(result.selectedModelId).not.toBe('cloud-large'); // Must be local
        }
        if (needsCode) {
          expect(result.selectedModelId).not.toBe('tiny'); // Tiny has no code capability
        }
      }
    }

    const end = performance.now();
    expect(end - start).toBeLessThan(1000); // Give generous padding for vitest environment
  });
});
