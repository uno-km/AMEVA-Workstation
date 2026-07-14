import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskDispatcher } from '../../dispatch/TaskDispatcher';
import { ModelRegistry } from '../../routing/registry/ModelRegistry';
import { RoutingBudgetManager } from '../../routing/budget/RoutingBudgetManager';
import { ModelAdapterProvider } from '../../routing/adapter/ModelAdapterProvider';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';

describe('Phase 5.4: Privacy Flow Tests', () => {
  let mockStore: any;
  let mockLeaseManager: any;
  let mockLedger: any;
  let mockResolver: any;
  let mockAdapter: any;
  let adapterSpy: any;

  beforeEach(() => {
    (ModelRegistry as any).instance = undefined;
    const registry = ModelRegistry.getInstance();
    registry.syncSnapshot([
      { modelId: 'local-model-1', localOrRemote: 'local', availability: 'AVAILABLE', enabled: true, tags: ['local'] } as any,
      { modelId: 'remote-model-1', localOrRemote: 'remote', availability: 'AVAILABLE', enabled: true, tags: ['remote'] } as any
    ]);

    adapterSpy = vi.spyOn(ModelAdapterProvider.getInstance(), 'getAdapterForModel').mockImplementation(async (modelId: string) => {
      if (modelId === 'remote-model-1') {
        throw new Error('Privacy Gate Violation: Remote model requested for RESTRICTED task');
      }
      return {
        modelId: 'local-model-1',
        isRemote: false,
        generate: vi.fn(),
        generateStream: vi.fn()
      } as any;
    });

    RoutingConfigManager.getInstance().updateConfig({
      routingEnabled: true,
      maxRoutingDecisions: 10,
      maxModelEscalations: 3,
      maxModelSwitches: 3,
      maxTotalModelCalls: 100,
      maxEstimatedTokens: 50000,
      maxRoutingTimeMs: 5000
    });

    mockStore = {
      getTask: vi.fn(),
      dispatchTransition: vi.fn(),
      updateTaskMetadata: vi.fn(),
      getTraceManager: vi.fn().mockReturnValue({
        recordRoutingDecision: vi.fn(),
        recordTaskStarted: vi.fn(),
        getStore: vi.fn().mockReturnValue({ appendEvent: vi.fn(), nextSequenceNumber: vi.fn().mockReturnValue(1) })
      }),
      commitTaskBudget: vi.fn()
    };
    mockLeaseManager = {
      acquireLease: vi.fn().mockReturnValue({ attemptId: 'attempt-1', stateVersion: 1 }),
      releaseLease: vi.fn(),
      renewLease: vi.fn().mockReturnValue({ attemptId: 'attempt-1', stateVersion: 2 })
    };
    mockResolver = {
      resolve: vi.fn().mockResolvedValue({})
    };
  });

  it('1. Privacy Restricted Task -> Should not route to remote', async () => {
    mockStore.getTask.mockReturnValue({
      definition: {
        id: 't1',
        privacyLevel: 'RESTRICTED',
        requiredCapabilities: []
      },
      state: {
        status: 'READY',
        stateVersion: 1
      }
    });

    const dispatcher = new TaskDispatcher(mockStore, mockLeaseManager, mockLedger, mockResolver, mockAdapter);
    await dispatcher.dispatchTask('m1', 't1');

    // Wait for async background task to complete if there was any.
    await new Promise(r => setTimeout(r, 50));

    expect(mockStore.updateTaskMetadata).toHaveBeenCalled();
    const calls = mockStore.updateTaskMetadata.mock.calls;
    const affinityCall = calls.find((c: any) => c[1].routingAffinity);
    expect(affinityCall).toBeDefined();

    // Since only remote is remote, it should select local-model-1
    expect(affinityCall[1].routingAffinity.selectedModelId).toBe('local-model-1');
  });

  it('2. Privacy Block -> Local Rerouting & Budget Consumption', async () => {
    mockStore.getTask.mockReturnValue({
      definition: {
        id: 't2',
        privacyLevel: 'RESTRICTED',
        requiredCapabilities: []
      },
      state: {
        status: 'READY',
        stateVersion: 1,
        routingAffinity: {
          affinityStatus: 'ACTIVE',
          selectedModelId: 'remote-model-1',
          privacyLocalRerouteCount: 0,
          previousModelIds: [],
          failedCombinationDigests: []
        }
      }
    });

    const dispatcher = new TaskDispatcher(mockStore, mockLeaseManager, mockLedger, mockResolver, mockAdapter);
    
    // Mock is now handled in beforeEach conditionally by modelId

    await dispatcher.dispatchTask('m1', 't2');
    await new Promise(r => setTimeout(r, 50));

    const calls = mockStore.updateTaskMetadata.mock.calls;
    
    const blockCall = calls.find((c: any) => c[1].routingAffinity && c[1].routingAffinity.invalidationReason === 'PRIVACY_POLICY_BLOCKED');
    expect(blockCall).toBeDefined();
    
    const rerouteCall = calls.find((c: any) => c[1].routingAffinity && c[1].routingAffinity.privacyLocalRerouteCount === 1);
    expect(rerouteCall).toBeDefined();
    expect(rerouteCall[1].routingAffinity.selectedModelId).toBe('local-model-1');
  });
});
