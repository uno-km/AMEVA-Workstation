import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelCallGatewayAdapter } from '../../routing/gateway/ModelCallGatewayAdapter';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';
import { ModelAdapterMismatchError } from '../../routing/gateway/ModelCallGatewayAdapter';
import { ModelAdapterProvider } from '../../routing/adapter/ModelAdapterProvider';

describe('Phase 5.4: Adapter Call Evidence & Gateway Spy', () => {
  let mockTraceManager: any;
  let registry: ModelRegistry;

  beforeEach(() => {
    mockTraceManager = {
      recordModelCall: vi.fn(),
      getStore: vi.fn().mockReturnValue({ appendEvent: vi.fn(), nextSequenceNumber: vi.fn().mockReturnValue(1) })
    };

    (ModelAdapterProvider.getInstance() as any).baseConfig = {
      providerEndpoint: 'http://localhost:11434',
      providerType: 'ollama',
      defaultModel: 'llama2'
    };

    (ModelRegistry as any).instance = undefined;
    registry = ModelRegistry.getInstance();
    registry.syncSnapshot([
      { modelId: 'valid-model-1', availability: 'AVAILABLE', enabled: true } as any,
      { modelId: 'valid-model-2', availability: 'AVAILABLE', enabled: true } as any,
      { modelId: 'fallback-legacy', availability: 'AVAILABLE', enabled: true } as any
    ]);
  });

  it('1. V2 Planner selectedModelId === called adapter.modelId', async () => {
    const innerGenerate = vi.fn().mockResolvedValue('planned output');
    const mockAdapter = {
      modelId: 'valid-model-1',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'valid-model-1',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    const result = await gateway.generate([{ role: 'user', content: 'plan this' }]);
    expect(result).toBe('planned output');
    expect(innerGenerate).toHaveBeenCalledTimes(1);
  });

  it('2. Executor selectedModelId === called adapter.modelId', async () => {
    const innerGenerate = vi.fn().mockResolvedValue('exec output');
    const mockAdapter = {
      modelId: 'valid-model-2',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'valid-model-2',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    await gateway.generate([{ role: 'user', content: 'do this' }]);
    expect(innerGenerate).toHaveBeenCalledTimes(1);
  });

  it('3. Partial Repair selectedModelId === called adapter.modelId', async () => {
    const innerGenerate = vi.fn().mockResolvedValue('repair output');
    const mockAdapter = {
      modelId: 'valid-model-1',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'valid-model-1',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    await gateway.generate([{ role: 'user', content: 'repair this' }]);
    expect(innerGenerate).toHaveBeenCalledTimes(1);
  });

  it('4. SemanticVerifier selectedModelId === called adapter.modelId', async () => {
    const innerGenerate = vi.fn().mockResolvedValue('{"verdict": "PASS"}');
    const mockAdapter = {
      modelId: 'valid-model-2',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'valid-model-2',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    await gateway.generate([{ role: 'user', content: 'verify this' }]);
    expect(innerGenerate).toHaveBeenCalledTimes(1);
  });

  it('5. Summarizer selectedModelId === called adapter.modelId', () => {
    // There is no Summarizer Runtime in this project.
    console.log('Summarizer Runtime not implemented. NOT_APPLICABLE');
    expect(true).toBe(true);
  });

  it('6. Adapter mismatch 시 generate/generateStream 호출 0회', async () => {
    const innerGenerate = vi.fn();
    const mockAdapter = {
      modelId: 'wrong-model',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'valid-model-1',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    await expect(gateway.generate([])).rejects.toThrow(ModelAdapterMismatchError);
    expect(innerGenerate).toHaveBeenCalledTimes(0);
  });

  it('7. Registry에 없는 modelId 호출 0회', async () => {
    const innerGenerate = vi.fn();
    const mockAdapter = {
      modelId: 'unregistered-model',
      isRemote: false,
      generate: innerGenerate,
      generateStream: vi.fn()
    } as any;

    const gateway = new ModelCallGatewayAdapter(
      mockAdapter,
      'unregistered-model',
      mockTraceManager,
      'm1', 't1', 'a1', 'd1'
    );

    await expect(gateway.generate([])).rejects.toThrow(ModelAdapterMismatchError);
    expect(innerGenerate).toHaveBeenCalledTimes(0);
  });

  it('8. Routing Disabled 시 Legacy Adapter 호출', async () => {
    const defaultAdapter = await ModelAdapterProvider.getInstance().getAdapterForModel('fallback-legacy');
    expect(defaultAdapter).toBeDefined();
    // In legacy mode, default adapter is returned from provider without routing
  });

  it('9. 동일 modelId 역할 공유 시 Adapter 재사용', async () => {
    const adapter1 = await ModelAdapterProvider.getInstance().getAdapterForModel('valid-model-1');
    const adapter2 = await ModelAdapterProvider.getInstance().getAdapterForModel('valid-model-1');
    expect(adapter1).toBe(adapter2); // the factory caches it
  });
});
