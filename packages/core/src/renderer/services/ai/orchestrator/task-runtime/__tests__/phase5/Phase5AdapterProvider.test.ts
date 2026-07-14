import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelAdapterProvider } from '../../routing/adapter/ModelAdapterProvider';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { ModelDescriptor } from '../../routing/domain/types';
import { LLMEngineAdapterFactory } from '../../../LLMEngineAdapter';

vi.mock('../../../LLMEngineAdapter');

describe('Phase 5: ModelAdapterProvider', () => {
  let provider: ModelAdapterProvider;
  let registry: ModelRegistry;

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
    (ModelAdapterProvider as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot([mockModel]);
    provider = ModelAdapterProvider.getInstance();
    provider.setBaseConfig({ modelId: 'llama-7b', engineType: 'llm' } as any);
  });

  it('throws when requesting adapter for unregistered model', async () => {
    await expect(provider.getAdapterForModel('unknown')).rejects.toThrow('Model unknown is not registered in the ModelRegistry.');
  });

  it('caches the adapter to avoid redundant loading (same real model, multiple roles)', async () => {
    const mockAdapter = { loadModel: vi.fn().mockResolvedValue(true), isReady: vi.fn().mockReturnValue(true), name: 'test' };
    vi.mocked(LLMEngineAdapterFactory.create).mockReturnValue(mockAdapter as any);

    const adapter1 = await provider.getAdapterForModel('llama-7b');
    const adapter2 = await provider.getAdapterForModel('llama-7b');
    
    expect(adapter1).toBe(adapter2);
    expect(LLMEngineAdapterFactory.create).toHaveBeenCalledTimes(1);
    expect(provider.getLoadedModelId()).toBe('llama-7b');
  });
});
