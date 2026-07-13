/**
 * @file debug-sidecar/harness/V2RuntimeHarness.ts
 * @system AMEVA OS Desktop Workstation
 */

import { IRuntimeHarness, HarnessOptions } from './RuntimeHarnessFactory';
import { MissionLogManager } from '../logging/MissionLogManager';
import { EventNormalizer } from '../observability/EventNormalizer';
import { CorrelationContext } from '../observability/CorrelationContext';
import { LLMEngineAdapterFactory } from '../../renderer/services/ai/orchestrator/LLMEngineAdapter';
import { LlamaHttpObserver } from '../collectors/LlamaHttpObserver';

// V2 Imports
import { TaskEventLog } from '../../renderer/services/ai/orchestrator/task-runtime/events/TaskEventLog';
import { TaskRuntimeStore } from '../../renderer/services/ai/orchestrator/task-runtime/store/TaskRuntimeStore';
import { MissionExecutionRuntime } from '../../renderer/services/ai/orchestrator/task-runtime/mission/MissionExecutionRuntime';
import { InMemoryRuntimePersistenceAdapter } from '../../renderer/services/ai/orchestrator/task-runtime/persistence/RuntimePersistenceAdapter';
import { V2RuntimeFeatureFlag } from '../../renderer/services/ai/orchestrator/task-runtime/domain/V2RuntimeFeatureFlag';

export class V2RuntimeHarness implements IRuntimeHarness {
  private runtime: MissionExecutionRuntime | null = null;
  private isDisposed = false;
  private intervalId: NodeJS.Timeout | null = null;
  private eventLog: TaskEventLog;
  private taskStore: TaskRuntimeStore;

  constructor(
    private options: HarnessOptions,
    private logManager: MissionLogManager
  ) {
    this.eventLog = new TaskEventLog();
    this.taskStore = new TaskRuntimeStore(this.eventLog);

    // Subscribe to TaskEventLog to pipe to unified events
    this.eventLog.subscribe((event) => {
      const e = EventNormalizer.info('SCHEDULER', 'V2RuntimeHarness', event.type, `V2 Event: ${event.type}`, { event_type: event.type, ...event as any });
      this.logManager.logEvent(e).catch(console.error);
    });
  }

  public async start(): Promise<void> {
    return CorrelationContext.run({
      trace_id: crypto.randomUUID(),
      correlation_id: crypto.randomUUID(),
      mission_id: this.options.missionId
    }, async () => {
      const startEvent = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_START', 'Starting V2 Harness');
      await this.logManager.logEvent(startEvent);

      try {
        const config = {
          aiType: 'ollama' as any,
          modelId: this.options.model,
          ollamaEndpoint: this.options.endpoint
        };

        const baseAdapter = LLMEngineAdapterFactory.create(config as any);
        const wrappedAdapter = new LlamaHttpObserver(baseAdapter, this.logManager, this.options.model);

        await wrappedAdapter.loadModel(this.options.model);

        // Required to pass V2 ownership check
        V2RuntimeFeatureFlag.acquireV2Ownership(this.options.missionId, this.options.missionId);

        const persistenceAdapter = new InMemoryRuntimePersistenceAdapter();
        
        this.runtime = new MissionExecutionRuntime(
          this.taskStore,
          wrappedAdapter,
          this.options.missionId,
          10000,
          persistenceAdapter
        );

        // Note: For a complete test, the task graph must be pre-populated or Planning invoked.
        // We will just call start. If there are no tasks, it will exit gracefully or idle.
        this.runtime.start();

        // Polling state
        return new Promise<void>((resolve, reject) => {
          this.intervalId = setInterval(() => {
            const missionState = this.taskStore.getMissionState(this.options.missionId);
            if (!missionState) return;

            if (missionState.status === 'PAUSED' || missionState.status === 'COMPLETED') {
              this.finishHarness('HARNESS_COMPLETE', `Mission Finished: ${missionState.status}`).then(resolve);
            } else if (missionState.status === 'FAILED' || missionState.status === 'CANCELLED') {
              this.finishHarness('HARNESS_ERROR', `Mission Terminated: ${missionState.status}`).then(() => reject(new Error(missionState.status)));
            }
          }, 1000);
        });

      } catch (err: any) {
        const errorEvent = EventNormalizer.error('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_ERROR', `V2 Harness failed: ${err.message}`, 'FATAL');
        await this.logManager.logEvent(errorEvent);
        throw err;
      }
    });
  }

  private async finishHarness(eventType: string, message: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    V2RuntimeFeatureFlag.releaseOwnership(this.options.missionId);
    const endEvent = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', eventType, message);
    await this.logManager.logEvent(endEvent);
  }

  public async pause(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_PAUSE', 'Pause requested');
    await this.logManager.logEvent(event);
    if (this.runtime) {
      // MissionExecutionRuntime doesn't expose pause publically, typically just cancel.
      // We will cancel with a specific reason.
      this.runtime.cancel('User requested pause');
    }
  }

  public async resume(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_RESUME', 'Resume requested');
    await this.logManager.logEvent(event);
    if (this.runtime) {
      this.runtime.start(); // Resuming
    }
  }

  public async cancel(): Promise<void> {
    const event = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_CANCEL', 'Cancel requested');
    await this.logManager.logEvent(event);
    if (this.runtime) {
      this.runtime.cancel('User aborted mission');
    }
    await this.finishHarness('HARNESS_CANCELLED', 'Mission cancelled');
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) return;
    const event = EventNormalizer.info('LIFECYCLE', 'V2RuntimeHarness', 'HARNESS_DISPOSE', 'Dispose requested');
    await this.logManager.logEvent(event);
    await this.cancel();
    this.runtime = null;
    this.isDisposed = true;
  }
}
