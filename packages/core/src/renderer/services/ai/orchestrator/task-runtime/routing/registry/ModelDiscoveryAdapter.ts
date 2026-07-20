/**
 * @file routing/registry/ModelDiscoveryAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @role IPC & Settings to ModelRegistry synchronizer
 */

import * as ipc from '../../../../../ipc/electronApiAdapter';
import { ModelRegistry } from './ModelRegistry';
import type { ModelDescriptor, Capability } from '../domain/types';

export class ModelDiscoveryAdapter {
  /**
   * Scans IPC endpoints and syncs the ModelRegistry.
   * Extracts capabilities based on filename heuristics and known metadata.
   */
  public static async discoverAndSync(apiType: string): Promise<ModelDescriptor[]> {
    if (!ipc.isElectronEnv()) {
      // Return a synthetic model for browser environment
      const syntheticModels: ModelDescriptor[] = [
        this.createSyntheticDescriptor('synthetic-browser-model', 'Browser Fallback Model', 'webgpu', 'local')
      ];
      ModelRegistry.getInstance().syncSnapshot(syntheticModels);
      return syntheticModels;
    }

    try {
      const type = apiType === 'ollama' ? 'ollama' : 'llm';
      const chatModels = await ipc.llmListModels(type);
      const codeModels = await ipc.llmListModels('code');

      const descriptors: ModelDescriptor[] = [];

      for (const m of chatModels) {
        descriptors.push(this.mapToDescriptor(m, type, false));
      }
      for (const m of codeModels) {
        // avoid exact duplicates if they exist in both paths
        if (!descriptors.some(d => d.modelId === m.path)) {
          descriptors.push(this.mapToDescriptor(m, type, true));
        }
      }

      // Dynamically register the active remote model if configured
      try {
        const savedSettings = localStorage.getItem('ameva_ai_settings') || localStorage.getItem('ai-settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed && parsed.apiType === 'api' && parsed.apiModel) {
            const remoteModelId = parsed.apiModel;
            const isGemini = remoteModelId.toLowerCase().includes('gemini');
            const isClaude = remoteModelId.toLowerCase().includes('claude');
            const isGpt = remoteModelId.toLowerCase().includes('gpt');
            
            const remoteDescriptor: ModelDescriptor = {
              modelId: remoteModelId,
              displayName: remoteModelId,
              provider: isGemini ? 'gemini' : isClaude ? 'anthropic' : isGpt ? 'openai' : 'remote',
              endpointType: 'remote',
              localOrRemote: 'remote',
              parameterClass: '32B', // Treat remote models as large models
              contextWindow: 128000,
              maxOutputTokens: 8192,
              supportedLanguages: ['en', 'ko'],
              capabilities: [
                'CLASSIFICATION', 'SUMMARIZATION', 'ROUTING', 'PLANNING',
                'TOOL_RESULT_INTERPRETATION', 'SEMANTIC_VERIFICATION', 'DOCUMENT_DRAFTING',
                'TOOL_SELECTION', 'STRUCTURED_OUTPUT', 'LONG_CONTEXT'
              ],
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
            
            if (!descriptors.some(d => d.modelId === remoteModelId)) {
              descriptors.push(remoteDescriptor);
            }
          }
        }
      } catch (remoteErr) {
        console.warn('[ModelDiscoveryAdapter] Failed to sync remote model settings:', remoteErr);
      }

      ModelRegistry.getInstance().syncSnapshot(descriptors);
      return descriptors;
    } catch (e) {
      console.warn('[ModelDiscoveryAdapter] Model discovery failed:', e);
      return [];
    }
  }

  private static mapToDescriptor(rawModel: Record<string, unknown>, provider: string, isCodeModel: boolean): ModelDescriptor {
    const filename = (rawModel.filename || rawModel.name || '').toLowerCase();
    
    // Heuristics for capabilities
    const capabilities: Capability[] = ['CLASSIFICATION', 'SUMMARIZATION', 'ROUTING'];
    
    if (filename.includes('instruct') || filename.includes('chat')) {
      capabilities.push('PLANNING', 'TOOL_RESULT_INTERPRETATION', 'SEMANTIC_VERIFICATION', 'DOCUMENT_DRAFTING');
    }
    
    if (isCodeModel || filename.includes('coder') || filename.includes('code') || filename.includes('qwen2.5-coder')) {
      capabilities.push('CODE_GENERATION', 'CODE_REPAIR');
    }

    // Default heuristics
    let paramClass = '7B';
    if (filename.includes('3b')) paramClass = '3B';
    if (filename.includes('1.5b')) paramClass = '1.5B';
    if (filename.includes('14b')) paramClass = '14B';
    if (filename.includes('32b')) paramClass = '32B';

    let ctxSize = 8192;
    let hasLongCtx = false;
    if (filename.includes('32k')) {
      ctxSize = 32768;
      hasLongCtx = true;
    }

    if (hasLongCtx) {
      capabilities.push('LONG_CONTEXT');
    }

    // Qwen models generally support good tool calling and structured output
    let toolSupport: 'native' | 'prompt_only' | 'none' = 'prompt_only';
    let soSupport: 'native_schema' | 'grammar' | 'prompt_only' | 'none' = 'prompt_only';

    if (filename.includes('qwen2.5')) {
      toolSupport = 'native';
      capabilities.push('TOOL_SELECTION');
      // local models often support grammar natively via llama.cpp
      soSupport = provider === 'llm' ? 'grammar' : 'native_schema';
      capabilities.push('STRUCTURED_OUTPUT');
    }

    return {
      modelId: rawModel.path || rawModel.name,
      displayName: rawModel.name || rawModel.filename,
      provider: provider === 'llm' ? 'llamacpp' : provider, // can be ollama, llamacpp
      endpointType: provider,
      localOrRemote: 'local', // assuming all IPC discovered are local
      parameterClass: paramClass,
      contextWindow: ctxSize,
      maxOutputTokens: 4096,
      supportedLanguages: ['en', 'ko'], // Basic heuristic
      capabilities,
      toolCallingSupport: toolSupport,
      structuredOutputSupport: soSupport,
      codeCapability: capabilities.includes('CODE_GENERATION'),
      longContextCapability: hasLongCtx,
      semanticVerificationCapability: capabilities.includes('SEMANTIC_VERIFICATION'),
      privacyLevel: 'RESTRICTED', // Default safest for local
      estimatedLatencyClass: paramClass === '3B' || paramClass === '1.5B' ? 'low' : 'medium',
      estimatedMemoryMb: rawModel.size ? Math.floor(rawModel.size / (1024 * 1024)) : 4096,
      requiredVramMb: rawModel.size ? Math.floor(rawModel.size / (1024 * 1024)) : 4096, // Rough estimate
      availability: 'AVAILABLE',
      healthStatus: 'MODEL_READY',
      version: '1.0',
      enabled: true
    };
  }

  private static createSyntheticDescriptor(id: string, name: string, provider: string, loc: 'local' | 'remote'): ModelDescriptor {
    return {
      modelId: id,
      displayName: name,
      provider,
      endpointType: 'browser',
      localOrRemote: loc,
      parameterClass: 'unknown',
      contextWindow: 4096,
      maxOutputTokens: 1024,
      supportedLanguages: ['en'],
      capabilities: ['CLASSIFICATION', 'SUMMARIZATION'],
      toolCallingSupport: 'none',
      structuredOutputSupport: 'prompt_only',
      codeCapability: false,
      longContextCapability: false,
      semanticVerificationCapability: false,
      privacyLevel: 'PUBLIC',
      estimatedLatencyClass: 'medium',
      estimatedMemoryMb: 1024,
      requiredVramMb: 0,
      availability: 'AVAILABLE',
      healthStatus: 'MODEL_READY',
      version: '1.0',
      enabled: true
    };
  }
}
