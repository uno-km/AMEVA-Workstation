/**
 * @file routing/adapter/ModelAdapterProvider.ts
 * @system AMEVA OS Desktop Workstation
 * @role Lifecycle manager for ILLMEngineAdapter instances.
 */

import { ILLMEngineAdapter, OrchestratorConfig } from '../../../types';
import { LLMEngineAdapterFactory } from '../../../LLMEngineAdapter';
import { ModelRegistry } from '../registry/ModelRegistry';

export class ModelAdapterProvider {
  private static instance: ModelAdapterProvider;
  private adapters: Map<string, ILLMEngineAdapter> = new Map();
  private baseConfig: OrchestratorConfig | null = null;
  private loadedModelId: string | null = null;

  private constructor() {}

  public static getInstance(): ModelAdapterProvider {
    if (!ModelAdapterProvider.instance) {
      ModelAdapterProvider.instance = new ModelAdapterProvider();
    }
    return ModelAdapterProvider.instance;
  }

  public setBaseConfig(config: OrchestratorConfig): void {
    this.baseConfig = config;
  }

  /**
   * Returns an adapter for the given modelId.
   * If the model isn't loaded, it will attempt to unload the previous and load the new one.
   * If modelId is not in the registry, throws an error (unless it's RULE_ENGINE which is handled outside).
   */
  public async getAdapterForModel(modelId: string, requiredPrivacyLevel?: 'INTERNAL' | 'CONFIDENTIAL' | 'PUBLIC'): Promise<ILLMEngineAdapter> {
    if (!this.baseConfig) {
      throw new Error('ModelAdapterProvider baseConfig not set.');
    }

    const registry = ModelRegistry.getInstance();
    const descriptor = registry.getModel(modelId);
    
    if (!descriptor) {
      throw new Error(`Model ${modelId} is not registered in the ModelRegistry.`);
    }

    // [Item 6] Privacy Gate 이중 검증 (실제 Adapter 호출 직전)
    if (requiredPrivacyLevel && descriptor.privacyLevel) {
      const isInternalReq = requiredPrivacyLevel === 'INTERNAL';
      const isConfidentialReq = requiredPrivacyLevel === 'CONFIDENTIAL';
      
      if (isInternalReq && descriptor.privacyLevel !== 'INTERNAL') {
        throw new Error(`Privacy Gate Violation: Model ${modelId} (${descriptor.privacyLevel}) does not satisfy required INTERNAL privacy.`);
      }
      if (isConfidentialReq && descriptor.privacyLevel === 'PUBLIC') {
        throw new Error(`Privacy Gate Violation: Model ${modelId} (${descriptor.privacyLevel}) does not satisfy required CONFIDENTIAL privacy.`);
      }
    }

    // Reuse existing adapter if we already created one for this endpoint type
    // In our architecture, one adapter (e.g. LlamaLocalEngineAdapter) can swap models if it supports it,
    // but Ollama/Llama.cpp handles models natively on the server side.
    const cacheKey = descriptor.endpointType;
    let adapter = this.adapters.get(cacheKey);

    if (!adapter) {
      const configOverride: OrchestratorConfig = {
        ...this.baseConfig,
        engineType: descriptor.endpointType as import('../../../types').OrchestratorConfig['engineType'], 
      };
      adapter = LLMEngineAdapterFactory.create(configOverride);
      this.adapters.set(cacheKey, adapter);
    }

    if (this.loadedModelId !== modelId) {
      // Unload previous if necessary (mostly no-op for ollama/llamacpp, but good practice)
      if (this.loadedModelId) {
         try {
           await adapter.unloadModel();
         } catch (e) {
           console.warn(`[ModelAdapterProvider] Failed to unload model ${this.loadedModelId}`, e);
         }
      }

      try {
        await adapter.loadModel(modelId);
        this.loadedModelId = modelId;
        registry.updateHealth(modelId, 'MODEL_READY');
      } catch (err: unknown) {
        registry.updateHealth(modelId, 'UNAVAILABLE');
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load model ${modelId}: ${msg}`);
      }
    }

    if (!adapter.isReady()) {
      registry.updateHealth(modelId, 'UNRESPONSIVE');
      throw new Error(`Adapter for ${modelId} is not ready.`);
    }

    return adapter;
  }
  
  public getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  public async cleanup(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
         await adapter.unloadModel();
      } catch (e) {}
    }
    this.adapters.clear();
    this.loadedModelId = null;
  }
}
