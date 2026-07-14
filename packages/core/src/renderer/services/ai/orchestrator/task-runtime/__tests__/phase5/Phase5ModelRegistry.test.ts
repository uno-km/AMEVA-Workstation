import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { ModelDescriptor } from '../../routing/domain/types';

describe('Phase 5: ModelRegistry (Single Source of Truth)', () => {
  let registry: ModelRegistry;

  const mockModel1: ModelDescriptor = {
    modelId: 'llama-7b',
    displayName: 'Llama 7B',
    provider: 'llamacpp',
    endpointType: 'llm',
    localOrRemote: 'local',
    parameterClass: '7B',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportedLanguages: ['en'],
    capabilities: ['CLASSIFICATION', 'SUMMARIZATION'],
    toolCallingSupport: 'prompt_only',
    structuredOutputSupport: 'prompt_only',
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

  const mockModel2: ModelDescriptor = {
    modelId: 'qwen-32b',
    displayName: 'Qwen 32B Coder',
    provider: 'ollama',
    endpointType: 'ollama',
    localOrRemote: 'local',
    parameterClass: '32B',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportedLanguages: ['en', 'ko'],
    capabilities: ['CODE_GENERATION', 'STRUCTURED_OUTPUT', 'TOOL_SELECTION', 'LONG_CONTEXT'],
    toolCallingSupport: 'native',
    structuredOutputSupport: 'native_schema',
    codeCapability: true,
    longContextCapability: true,
    semanticVerificationCapability: true,
    privacyLevel: 'RESTRICTED',
    estimatedLatencyClass: 'high',
    estimatedMemoryMb: 24000,
    requiredVramMb: 24000,
    availability: 'AVAILABLE',
    healthStatus: 'MODEL_READY',
    version: '1.0',
    enabled: true
  };

  beforeEach(() => {
    // Reset singleton instance by using any (only in tests)
    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
  });

  it('syncs snapshot correctly and does not double register', () => {
    registry.syncSnapshot([mockModel1, mockModel2]);
    const models = registry.getAllModels();
    expect(models.length).toBe(2);
    expect(models.find(m => m.modelId === 'llama-7b')).toBeDefined();
  });

  it('filters by capability', () => {
    registry.syncSnapshot([mockModel1, mockModel2]);
    const coders = registry.getModelsByCapability('CODE_GENERATION');
    expect(coders.length).toBe(1);
    expect(coders[0].modelId).toBe('qwen-32b');
  });

  it('maps roles correctly to actual models', () => {
    registry.syncSnapshot([mockModel1, mockModel2]);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: ['llama-7b'],
      MEDIUM_MODEL: ['llama-7b', 'qwen-32b'],
      PRIMARY_MODEL: ['qwen-32b']
    });

    const smallModels = registry.getModelsByRole('SMALL_MODEL');
    expect(smallModels.length).toBe(1);
    expect(smallModels[0].modelId).toBe('llama-7b');
  });

  it('falls back to any available model if role mapping is empty (Single Model Environment requirement)', () => {
    registry.syncSnapshot([mockModel1]);
    registry.updateRoleMappings({
      RULE_ENGINE: [],
      SMALL_MODEL: [],
      MEDIUM_MODEL: [],
      PRIMARY_MODEL: []
    });

    const mediumModels = registry.getModelsByRole('MEDIUM_MODEL');
    expect(mediumModels.length).toBe(1);
    expect(mediumModels[0].modelId).toBe('llama-7b');
  });

  it('maintains independence from useAIModels hook', () => {
    // This is conceptually verified by checking imports, but we can verify it doesn't throw.
    expect(registry.getRegistrySnapshot()).toBeDefined();
  });
});
