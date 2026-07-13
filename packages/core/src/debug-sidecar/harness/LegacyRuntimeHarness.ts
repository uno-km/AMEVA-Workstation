/**
 * @file debug-sidecar/harness/LegacyRuntimeHarness.ts
 * @system AMEVA OS Desktop Workstation
 */

import { IRuntimeHarness, HarnessOptions } from './RuntimeHarnessFactory';
import { MissionLogManager } from '../logging/MissionLogManager';
import { AgentOrchestratorSession } from '../../renderer/services/ai/orchestrator/AgentOrchestrator';
import { EventNormalizer } from '../observability/EventNormalizer';
import { CorrelationContext } from '../observability/CorrelationContext';
import { LlamaHttpObserver } from '../collectors/LlamaHttpObserver';
import { LLMEngineAdapterFactory } from '../../renderer/services/ai/orchestrator/LLMEngineAdapter';

export class LegacyRuntimeHarness implements IRuntimeHarness {
  private session: AgentOrchestratorSession | null = null;
  private isDisposed = false;

  constructor(
    private options: HarnessOptions,
    private logManager: MissionLogManager
  ) {}

  public async start(): Promise<void> {
    return CorrelationContext.run({
      trace_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      mission_id: this.options.missionId
    }, async () => {
      const event = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_START', 'Starting Legacy Harness');
      await this.logManager.logEvent(event);

      try {
        const config = {
          aiType: 'ollama' as any, // Mocking or injecting config
          modelId: this.options.model,
          ollamaEndpoint: this.options.endpoint
        };

        this.session = new AgentOrchestratorSession(config as any, (orchestratorEvent) => {
          // Translate UI events to Unified Events
          const e = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'ORCHESTRATOR_EVENT', `Event: ${orchestratorEvent.type}`, { event_type: orchestratorEvent.type, ...orchestratorEvent });
          this.logManager.logEvent(e).catch(console.error);
        });

        // We use proxy to inject LlamaHttpObserver if we were doing deep intercept,
        // but to strictly adhere to ZERO-TOUCH without modifying AgentOrchestrator internal adapter factory logic,
        // we might have to rely on `selfHealingMiddleware` or similar DI if available, or just observe what we can.
        // Actually, LLMEngineAdapterFactory is hardcoded inside AgentOrchestrator constructor.
        // We will log that HTTP metrics are PARTIALLY_OBSERVABLE without core hooks in Legacy mode.

        await this.session.initialize();
        const result = await this.session.run(this.options.prompt);
        
        const endEvent = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_COMPLETE', 'Legacy Harness completed', { result: result.substring(0, 100) });
        await this.logManager.logEvent(endEvent);
      } catch (err: any) {
        const errorEvent = EventNormalizer.error('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_ERROR', `Legacy Harness failed: ${err.message}`, 'FATAL');
        await this.logManager.logEvent(errorEvent);
        throw err;
      }
    });
  }

  public async pause(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_PAUSE', 'Pause requested');
    await this.logManager.logEvent(event);
    // Legacy orchestrator has no formal pause, only abort
  }

  public async resume(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_RESUME', 'Resume requested');
    await this.logManager.logEvent(event);
  }

  public async cancel(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_CANCEL', 'Cancel requested');
    await this.logManager.logEvent(event);
    if (this.session) {
      await this.session.abort();
    }
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) return;
    const event = EventNormalizer.info('LIFECYCLE', 'LegacyRuntimeHarness', 'HARNESS_DISPOSE', 'Dispose requested');
    await this.logManager.logEvent(event);
    this.session = null;
    this.isDisposed = true;
  }
}
