import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import { DeepTaskExecutor } from '../executors/DeepTaskExecutor';
import { MissionExecutionRuntime } from '../mission/MissionExecutionRuntime';

describe('Phase 4 Observation Pipeline', () => {
  it('should format tool result and emit tool_observation_created event in a deterministic sequence', async () => {
    const store = new TaskRuntimeStore(new TaskEventLog());
    const runtime = new MissionExecutionRuntime(store, {} as any, 'm1');
    
    const mockRegistry = {
      getDefinition: vi.fn().mockReturnValue({ riskLevel: 'LOW', approvalRequired: false }),
      executeTool: vi.fn().mockResolvedValue({ success: true, stdout: 'file read ok' }),
      getAllDefinitions: vi.fn().mockReturnValue([{ name: 'read_file' }]),
      registerDefaultTools: vi.fn().mockResolvedValue(undefined),
      serializeForPrompt: vi.fn().mockReturnValue('mocked tools')
    };

    const mockAdapter = {
      generateStream: vi.fn().mockResolvedValue(`<tool_call>{"name":"read_file","args":{"path":"test.txt"}}</tool_call>`)
    };

    const leaseManager: any = { renewLease: vi.fn(), releaseLease: vi.fn() };
    const ledger: any = { getActiveTaskNode: vi.fn().mockReturnValue({
      definition: { id: 't1', title: 'Task1', expectedOutputs: [] },
      state: { status: 'RUNNING' }
    }), commitTaskBudget: vi.fn() };

    const mockCheckpointRuntime = { recordCrash: vi.fn(), recoverTasks: vi.fn(), maybeSaveOnTurnBoundary: vi.fn(), clearTask: vi.fn() };
    const executor = new DeepTaskExecutor(
      store, leaseManager, ledger, mockAdapter as any, mockRegistry as any, mockCheckpointRuntime as any
    );

    store.initMission('m1', { maxReasoningTurns: 10 } as any);
    store.registerTask({ definition: { id: 't1', title: 'Task1', expectedOutputs: [] }, state: { status: 'RUNNING' } } as any, 'm1');

    await executor.execute('m1', 't1', '1', 'lease1', new AbortController().signal);

    const traceManager = store.getTraceManager();
    const events = traceManager.getStore().getMissionTrace('m1');

    const observationEvent = events.find(e => e.eventType === 'tool_observation_created');
    console.log('EVENTS:', JSON.stringify(events, null, 2));
    expect(observationEvent).toBeDefined();
    expect(observationEvent?.observation?.status).toBe('SUCCESS');
    expect(observationEvent?.observation?.summary).toContain('실행 성공');

    // Verify ordering: started -> completed -> observation
    const startedIdx = events.findIndex(e => e.eventType === 'tool_execution_started');
    const completedIdx = events.findIndex(e => e.eventType === 'tool_execution_completed');
    const obsIdx = events.findIndex(e => e.eventType === 'tool_observation_created');

    expect(startedIdx).toBeLessThan(completedIdx);
    expect(completedIdx).toBeLessThan(obsIdx);
  });
});
