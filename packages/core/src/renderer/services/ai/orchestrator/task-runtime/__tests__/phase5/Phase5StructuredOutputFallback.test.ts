import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile, ModelDescriptor, RoutingConfig } from '../../routing/domain/types';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5: StructuredOutputFallback', () => {
  let registry: ModelRegistry;
  let config: RoutingConfig;

  const mockModel: ModelDescriptor = {
    modelId: 'llama-7b',
    displayName: 'Llama 7B',
    provider: 'llamacpp',
    endpointType: 'llm',
    localOrRemote: 'local',
    parameterClass: '7B',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportedLanguages: ['en'],
    capabilities: [],
    toolCallingSupport: 'prompt_only',
    structuredOutputSupport: 'prompt_only',
    codeCapability: false,
    longContextCapability: false,
    semanticVerificationCapability: false,
    privacyLevel: 'INTERNAL',
    estimatedLatencyClass: 'medium',
    estimatedMemoryMb: 4096,
    requiredVramMb: 4096,
    availability: 'AVAILABLE',
    healthStatus: 'MODEL_READY',
    version: '1.0',
    enabled: true
  };

  beforeEach(() => {
    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot([mockModel]);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: [],
      MEDIUM_MODEL: ['llama-7b'],
      PRIMARY_MODEL: ['llama-7b']
    });
    config = RoutingConfigManager.getInstance().getConfig();
  });

  it('selects model even if structuredOutputSupport is only prompt_only, as long as it has STRUCTURED_OUTPUT capability (or if not strictly enforced)', async () => {
    // Modify capability to include it
    mockModel.capabilities.push('STRUCTURED_OUTPUT');

    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.1,
      reasoningComplexity: 0.1,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: ['STRUCTURED_OUTPUT'],
      toolRequired: false,
      structuredOutputRequired: true,
      codeExecutionRequired: false,
      artifactKinds: [],
      privacyLevel: 'INTERNAL',
      riskLevel: 'LOW',
      latencyPreference: 'balanced',
      qualityPreference: 'acceptable',
      retryHistory: 0,
      previousModelIds: [],
      previousDefectSignatures: [],
      routingBudgetRemaining: 1.0
    };

    const result = await ModelRouter.route(profile, config);
    expect(result.status).toBe('SUCCESS');
    expect(result.selectedModelId).toBe('llama-7b');
  });
});
