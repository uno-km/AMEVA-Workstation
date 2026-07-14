import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile, ModelDescriptor, RoutingConfig } from '../../routing/domain/types';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5: PrivacyRouting', () => {
  let registry: ModelRegistry;
  let config: RoutingConfig;

  const mockLocalModel: ModelDescriptor = {
    modelId: 'local-7b',
    displayName: 'Local 7B',
    provider: 'llamacpp',
    endpointType: 'llm',
    localOrRemote: 'local',
    parameterClass: '7B',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportedLanguages: ['en'],
    capabilities: [],
    toolCallingSupport: 'none',
    structuredOutputSupport: 'none',
    codeCapability: false,
    longContextCapability: false,
    semanticVerificationCapability: false,
    privacyLevel: 'RESTRICTED',
    estimatedLatencyClass: 'medium',
    estimatedMemoryMb: 4096,
    requiredVramMb: 4096,
    availability: 'AVAILABLE',
    healthStatus: 'MODEL_READY',
    version: '1.0',
    enabled: true
  };

  const mockRemoteModel: ModelDescriptor = {
    modelId: 'cloud-model',
    displayName: 'Cloud Model',
    provider: 'openai',
    endpointType: 'cloud',
    localOrRemote: 'remote',
    parameterClass: 'large',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportedLanguages: ['en'],
    capabilities: [],
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
  };

  beforeEach(() => {
    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot([mockLocalModel, mockRemoteModel]);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: ['local-7b'],
      MEDIUM_MODEL: ['local-7b', 'cloud-model'],
      PRIMARY_MODEL: ['cloud-model']
    });
    config = RoutingConfigManager.getInstance().getConfig();
  });

  it('rejects remote models for RESTRICTED privacy', async () => {
    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.8, // forces PRIMARY_MODEL
      reasoningComplexity: 0.8,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: [],
      toolRequired: false,
      structuredOutputRequired: false,
      codeExecutionRequired: false,
      artifactKinds: [],
      privacyLevel: 'RESTRICTED',
      riskLevel: 'CRITICAL',
      latencyPreference: 'balanced',
      qualityPreference: 'high',
      retryHistory: 0,
      previousModelIds: [],
      previousDefectSignatures: [],
      routingBudgetRemaining: 1.0
    };

    const result = await ModelRouter.route(profile, config);
    // It should pick local-7b even if it prefers PRIMARY, because cloud is blocked by privacy
    expect(result.status).toBe('SUCCESS');
    expect(result.selectedModelId).toBe('local-7b');
    expect(result.rejectedCandidates.some(r => r.modelId === 'cloud-model' && r.reason.includes('RESTRICTED'))).toBe(true);
  });

  it('blocks all models if privacy blocks remote and local lacks capabilities', async () => {
    // Modify profile to require something only the remote model has
    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.8,
      reasoningComplexity: 0.8,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: ['LONG_CONTEXT'], // only remote has this
      toolRequired: false,
      structuredOutputRequired: false,
      codeExecutionRequired: false,
      artifactKinds: [],
      privacyLevel: 'RESTRICTED',
      riskLevel: 'CRITICAL',
      latencyPreference: 'balanced',
      qualityPreference: 'high',
      retryHistory: 0,
      previousModelIds: [],
      previousDefectSignatures: [],
      routingBudgetRemaining: 1.0
    };

    const result = await ModelRouter.route(profile, config);
    expect(result.status).toBe('PRIVACY_POLICY_BLOCKED'); // Or CAPABILITY_UNAVAILABLE depending on sort order, but privacy is first gate
  });
});
