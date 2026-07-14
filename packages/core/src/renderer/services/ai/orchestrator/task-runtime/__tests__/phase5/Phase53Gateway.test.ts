import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelCallGatewayAdapter, ModelAdapterMismatchError } from '../../routing/gateway/ModelCallGatewayAdapter';
import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';

describe('Phase 5.3: ModelCallGateway & Adapter Mismatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should throw MODEL_ADAPTER_MISMATCH and generate 0 calls if selectedModelId != adapter.modelId', async () => {
    const traceManager = new ExecutionTraceManager();
    
    // Mock the inner adapter
    const innerAdapter = {
      modelId: 'wrong-model-id',
      isRemote: true,
      loadModel: vi.fn(),
      unloadModel: vi.fn(),
      generate: vi.fn(),
      generateStream: vi.fn()
    } as any;

    // Mock Registry
    vi.spyOn(ModelRegistry.getInstance(), 'getModel').mockReturnValue({
      modelId: 'wrong-model-id'
    } as any);

    const gatewayAdapter = new ModelCallGatewayAdapter(
      innerAdapter,
      'expected-model-id',
      traceManager,
      'test-mission',
      'test-task',
      '1',
      'decision-1'
    );

    await expect(gatewayAdapter.generate([{ role: 'user', content: 'hello' }]))
      .rejects
      .toThrow(ModelAdapterMismatchError);

    // generate must NOT be called
    expect(innerAdapter.generate).not.toHaveBeenCalled();
    expect(innerAdapter.generateStream).not.toHaveBeenCalled();
  });

  it('2. should call innerAdapter.generate if selectedModelId === adapter.modelId === descriptor.modelId', async () => {
    const traceManager = new ExecutionTraceManager();
    
    const innerAdapter = {
      modelId: 'correct-model-id',
      isRemote: true,
      loadModel: vi.fn(),
      unloadModel: vi.fn(),
      generate: vi.fn().mockResolvedValue('success'),
      generateStream: vi.fn()
    } as any;

    vi.spyOn(ModelRegistry.getInstance(), 'getModel').mockReturnValue({
      modelId: 'correct-model-id'
    } as any);

    const gatewayAdapter = new ModelCallGatewayAdapter(
      innerAdapter,
      'correct-model-id',
      traceManager,
      'test-mission',
      'test-task',
      '1',
      'decision-1'
    );

    const result = await gatewayAdapter.generate([{ role: 'user', content: 'hello' }]);
    expect(result).toBe('success');
    expect(innerAdapter.generate).toHaveBeenCalledTimes(1);
  });
});
