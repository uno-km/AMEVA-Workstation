/**
 * @file debug-sidecar/collectors/LlamaHttpObserver.ts
 * @system AMEVA OS Desktop Workstation
 * @role Wraps LLM Adapters to observe execution metrics.
 */

import { ILLMEngineAdapter } from '../../renderer/services/ai/orchestrator/types';
import { EventNormalizer } from '../observability/EventNormalizer';
import { MissionLogManager } from '../logging/MissionLogManager';
import { CorrelationContext } from '../observability/CorrelationContext';

export class LlamaHttpObserver implements ILLMEngineAdapter {
  constructor(
    private readonly inner: ILLMEngineAdapter,
    private readonly logManager: MissionLogManager,
    private readonly modelName: string
  ) {}

  public async loadModel(modelId: string): Promise<void> {
    const start = performance.now();
    try {
      await this.inner.loadModel(modelId);
      const duration = performance.now() - start;
      const event = EventNormalizer.info('LLM', 'LlamaHttpObserver', 'MODEL_LOAD_SUCCESS', `Loaded ${modelId}`, { duration_ms: duration, modelId });
      await this.logManager.logEvent(event);
    } catch (e: any) {
      const event = EventNormalizer.error('LLM', 'LlamaHttpObserver', 'MODEL_LOAD_ERROR', `Failed to load ${modelId}: ${e.message}`, 'LOAD_ERR');
      await this.logManager.logEvent(event);
      throw e;
    }
  }

  public async unloadModel(): Promise<void> {
    return this.inner.unloadModel ? this.inner.unloadModel() : Promise.resolve();
  }

  public async generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string> {
    const ctx = CorrelationContext.current();
    const start = performance.now();
    
    // Log Request Metadata (no raw prompts)
    const reqEvent = EventNormalizer.info('LLM', 'LlamaHttpObserver', 'LLM_REQUEST_START', 'Starting stream generation', {
      model: this.modelName,
      message_count: messages.length,
      role_sequence: messages.map(m => m.role)
    });
    await this.logManager.logEvent(reqEvent);

    let firstTokenTime: number | null = null;
    let lastTokenTime = performance.now();
    let chunkCount = 0;
    let maxGap = 0;

    const wrappedOnToken = (token: string) => {
      const now = performance.now();
      if (!firstTokenTime) {
        firstTokenTime = now;
        const ttft = firstTokenTime - start;
        const ttftEvent = EventNormalizer.info('LLM', 'LlamaHttpObserver', 'LLM_FIRST_TOKEN', 'First token received', { ttft_ms: ttft });
        this.logManager.logEvent(ttftEvent).catch(console.error);
      }
      
      const gap = now - lastTokenTime;
      if (gap > maxGap) maxGap = gap;
      lastTokenTime = now;
      chunkCount++;

      // We only log chunk timings if needed (Standard/Verbose profile could filter this)
      // For now, logging every chunk is heavy, we'll just track metrics.

      onToken(token);
    };

    try {
      const result = await this.inner.generateStream(messages, wrappedOnToken);
      const totalDuration = performance.now() - start;
      
      const endEvent = EventNormalizer.info('LLM', 'LlamaHttpObserver', 'LLM_REQUEST_SUCCESS', 'Stream completed', {
        duration_ms: totalDuration,
        first_token_latency_ms: firstTokenTime ? firstTokenTime - start : 0,
        chunk_count: chunkCount,
        maximum_chunk_gap_ms: maxGap,
        response_bytes: Buffer.byteLength(result, 'utf8')
      });
      await this.logManager.logEvent(endEvent);
      
      return result;
    } catch (e: any) {
      const duration = performance.now() - start;
      const endEvent = EventNormalizer.error('LLM', 'LlamaHttpObserver', 'LLM_REQUEST_ERROR', `Stream failed: ${e.message}`, 'STREAM_ERR', {
        duration_ms: duration,
        chunk_count: chunkCount
      });
      await this.logManager.logEvent(endEvent);
      throw e;
    }
  }

  public async abort(): Promise<void> {
    const event = EventNormalizer.info('LLM', 'LlamaHttpObserver', 'LLM_ABORT', 'Abort requested');
    await this.logManager.logEvent(event);
    return this.inner.abort();
  }

  public isReady(): boolean {
    return this.inner.isReady();
  }
}
