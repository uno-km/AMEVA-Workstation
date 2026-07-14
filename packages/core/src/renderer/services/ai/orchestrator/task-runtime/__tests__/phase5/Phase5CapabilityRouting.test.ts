import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile, ModelDescriptor, RoutingConfig } from '../../routing/domain/types';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5: CapabilityRouting', () => {
  let registry: ModelRegistry;
  let config: RoutingConfig;

  const mockSmallModel: ModelDescriptor = {
    modelId: 'small-1.5b',
    displayName: 'Small 1.5B',
    provider: 'llamacpp',
    endpointType: 'llm',
    localOrRemote: 'local',
    parameterClass: '1.5B',
    contextWindow: 4096,
    maxOutputTokens: 1024,
    supportedLanguages: ['en'],
    capabilities: ['CLASSIFICATION'],
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
  };

  const mockCoderModel: ModelDescriptor = {
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
  };

  beforeEach(() => {
    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot([mockSmallModel, mockCoderModel]);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: ['small-1.5b'],
      MEDIUM_MODEL: ['coder-7b'],
      PRIMARY_MODEL: ['coder-7b']
    });
    config = RoutingConfigManager.getInstance().getConfig();
  });

  it('rejects models missing required capabilities', async () => {
    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.1,
      reasoningComplexity: 0.1,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: ['CODE_GENERATION'],
      toolRequired: false,
      structuredOutputRequired: false,
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
    expect(result.selectedModelId).toBe('coder-7b');
    expect(result.rejectedCandidates.some(r => r.modelId === 'small-1.5b' && r.reason.includes('capabilities'))).toBe(true);
  });

  it('returns CAPABILITY_UNAVAILABLE if no model satisfies requirements', async () => {
    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.5,
      reasoningComplexity: 0.5,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: ['LONG_CONTEXT'], // none have this
      toolRequired: false,
      structuredOutputRequired: false,
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
    expect(result.status).toBe('CAPABILITY_UNAVAILABLE');
    expect(result.selectedModelId).toBe('');
  });
});
