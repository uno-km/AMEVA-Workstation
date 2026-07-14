import { ILLMEngineAdapter } from '../../../types';
import { ModelRegistry } from '../registry/ModelRegistry';
import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';

export class ModelAdapterMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelAdapterMismatchError';
  }
}

/**
 * A decorator for ILLMEngineAdapter that ensures the loaded model strictly matches
 * the routing decision's selectedModelId and the registry descriptor's modelId
 * before allowing generate/generateStream.
 */
export class ModelCallGatewayAdapter implements ILLMEngineAdapter {
  constructor(
    private innerAdapter: ILLMEngineAdapter,
    private expectedModelId: string,
    private traceManager: ExecutionTraceManager,
    private missionId: string,
    private taskId: string,
    private attemptId: string,
    private routingDecisionId?: string
  ) {}

  public get modelId(): string | undefined {
    return this.innerAdapter.modelId;
  }

  public get isRemote(): boolean | undefined {
    return this.innerAdapter.isRemote;
  }

  public async loadModel(modelId: string): Promise<void> {
    return this.innerAdapter.loadModel(modelId);
  }

  public async unloadModel(): Promise<void> {
    return this.innerAdapter.unloadModel();
  }

  public isReady(): boolean {
    if (typeof (this.innerAdapter as any).isReady === 'function') {
      return (this.innerAdapter as any).isReady();
    }
    return true; // default if not implemented
  }

  public async abort(): Promise<void> {
    if (typeof (this.innerAdapter as any).abort === 'function') {
      return (this.innerAdapter as any).abort();
    }
  }

  public async generateStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onToken: (token: string) => void
  ): Promise<string> {
    this.assertModelMatch();
    return this.innerAdapter.generateStream(messages, onToken);
  }

  public async generate(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    this.assertModelMatch();
    if (typeof (this.innerAdapter as any).generate === 'function') {
      return (this.innerAdapter as any).generate(messages);
    }
    // Fallback if generate is not implemented but generateStream is
    let result = '';
    await this.innerAdapter.generateStream(messages, token => { result += token; });
    return result;
  }

  private assertModelMatch(): void {
    const adapterModelId = this.innerAdapter.modelId;
    const descriptor = ModelRegistry.getInstance().getModel(this.expectedModelId);

    if (adapterModelId !== this.expectedModelId || !descriptor || descriptor.modelId !== this.expectedModelId) {
      const errorMsg = `ModelCallGateway Assertion Failed: selectedModelId=${this.expectedModelId}, adapter.modelId=${adapterModelId}, descriptor.modelId=${descriptor?.modelId}`;
      
      const seq = this.traceManager.getStore().nextSequenceNumber(this.missionId);
      this.traceManager.getStore().appendEvent({
        eventId: `${this.missionId}_${seq}_mismatch_${crypto.randomUUID()}`,
        traceId: this.missionId,
        spanId: `span-t-${this.taskId}-${this.attemptId}`,
        parentSpanId: `span-t-${this.taskId}-${this.attemptId}`,
        missionId: this.missionId,
        taskId: this.taskId,
        attemptId: this.attemptId,
        timestamp: Date.now(),
        eventType: 'model_call_failed' as import('../../trace/types').TraceEventType,
        status: 'FAILED',
        title: 'MODEL_ADAPTER_MISMATCH',
        summary: errorMsg,
        sequenceNumber: seq,
        visibility: 'USER',
        severity: 'HIGH',
        schemaVersion: '4.0.0',
        data: { 
          routingDecisionId: this.routingDecisionId, 
          selectedModelId: this.expectedModelId, 
          adapterModelId, 
          descriptorModelId: descriptor?.modelId 
        }
      } as import('../../trace/types').TraceEvent);

      throw new ModelAdapterMismatchError(errorMsg);
    }
  }
}
