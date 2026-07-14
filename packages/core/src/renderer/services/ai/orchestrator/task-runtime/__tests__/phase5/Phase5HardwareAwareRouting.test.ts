import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { TaskRoutingProfile, ModelDescriptor, RoutingConfig } from '../../routing/domain/types';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';
import { HardwareResourceService } from '../../routing/router/HardwareResourceService';

vi.mock('../../routing/router/HardwareResourceService');

describe('Phase 5: HardwareAwareRouting (Conservative Policy)', () => {
  let registry: ModelRegistry;
  let config: RoutingConfig;

  const mockModel: ModelDescriptor = {
    modelId: 'heavy-32b',
    displayName: 'Heavy 32B',
    provider: 'llamacpp',
    endpointType: 'llm',
    localOrRemote: 'local',
    parameterClass: '32B',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportedLanguages: ['en'],
    capabilities: [],
    toolCallingSupport: 'none',
    structuredOutputSupport: 'none',
    codeCapability: false,
    longContextCapability: false,
    semanticVerificationCapability: false,
    privacyLevel: 'INTERNAL',
    estimatedLatencyClass: 'high',
    estimatedMemoryMb: 24000,
    requiredVramMb: 24000,
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
      MEDIUM_MODEL: ['heavy-32b'],
      PRIMARY_MODEL: ['heavy-32b']
    });
    config = RoutingConfigManager.getInstance().getConfig();
  });

  it('rejects if VRAM is explicitly insufficient', async () => {
    vi.mocked(HardwareResourceService.getMetrics).mockResolvedValue({
      availableVramMb: 8000,
      totalVramMb: 16000,
      gpuCount: 1,
      availableRamMb: 16000
    });

    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.1,
      reasoningComplexity: 0.1,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: [],
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
    expect(result.status).toBe('WAITING_USER'); // Because it gets rejected by VRAM, no models left
    expect(result.rejectedCandidates[0].reason).toContain('Insufficient VRAM');
  });

  it('applies conservative policy (rejects known OOM) when hardware stats are unavailable', async () => {
    vi.mocked(HardwareResourceService.getMetrics).mockResolvedValue(null);

    // Mock OOM status and smaller VRAM to bypass the >8GB strict check
    mockModel.healthStatus = 'OOM';
    mockModel.requiredVramMb = 8000;

    const profile: TaskRoutingProfile = {
      missionId: 'm1',
      taskId: 't1',
      taskType: 'EXECUTION',
      instructionComplexity: 0.1,
      reasoningComplexity: 0.1,
      contextSize: 1000,
      expectedOutputTokens: 500,
      requiredCapabilities: [],
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
    expect(result.status).toBe('WAITING_USER');
    expect(result.rejectedCandidates[0].reason).toContain('OOM');
  });
});
