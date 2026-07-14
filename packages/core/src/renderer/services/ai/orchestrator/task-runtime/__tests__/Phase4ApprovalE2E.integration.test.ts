import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeepTaskExecutor } from '../executors/DeepTaskExecutor';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { TaskEventLog } from '../events/TaskEventLog';
import { ToolApprovalPolicy } from '../policy/ToolApprovalPolicy';
import { MissionExecutionRuntime } from '../mission/MissionExecutionRuntime';

describe('Phase 4 Approval E2E', () => {
  let store: TaskRuntimeStore;
  let runtime: MissionExecutionRuntime;

  beforeEach(() => {
    store = new TaskRuntimeStore(new TaskEventLog());
    runtime = new MissionExecutionRuntime(store, {} as any, 'm1');
    // Reset singleton
    (ToolApprovalPolicy as any).approvals.clear();
    (ToolApprovalPolicy as any).processedIdempotencyKeys.clear();
  });

  it('should wait for user approval and execute when APPROVED', async () => {
    // 1. Setup Mock Tool Definition
    const toolName = 'mock_high_risk_tool';
    const mockRegistry = {
      getDefinition: vi.fn().mockReturnValue({ riskLevel: 'HIGH', approvalRequired: true }),
      executeTool: vi.fn().mockResolvedValue({ success: true, missionId: 'm1', taskId: 't1', attemptId: '1' }),
      getAllDefinitions: vi.fn().mockReturnValue([{ name: toolName }]),
      registerDefaultTools: vi.fn().mockResolvedValue(undefined),
      serializeForPrompt: vi.fn().mockReturnValue('mocked tools')
    };

    const mockAdapter = {
      generateStream: vi.fn().mockResolvedValue(`<tool_call>{"name":"${toolName}","args":{}}</tool_call>`)
    };

    const leaseManager: any = { renewLease: vi.fn(), releaseLease: vi.fn() };
    const ledger: any = { getActiveTaskNode: vi.fn().mockReturnValue({
      definition: { id: 't1', title: 'Task1', expectedOutputs: [] },
      state: { status: 'RUNNING' }
    }), commitTaskBudget: vi.fn() };

    const mockCheckpointRuntime = { recordCrash: vi.fn(), recoverTasks: vi.fn(), maybeSaveOnTurnBoundary: vi.fn(), clearTask: vi.fn() };
    const executor = new DeepTaskExecutor(
      store,
      leaseManager,
      ledger,
      mockAdapter as any,
      mockRegistry as any,
      mockCheckpointRuntime as any
    );

    store.initMission('m1', { maxReasoningTurns: 10 } as any);
    store.registerTask({ definition: { id: 't1', title: 'Task1', expectedOutputs: [] }, state: { status: 'RUNNING' } } as any, 'm1');

    // 2. Start Execution in background
    const execPromise = executor.execute('m1', 't1', '1', 'lease1', new AbortController().signal);

    // 3. Wait a bit for the executor to pause at PENDING approval
    await new Promise(r => setTimeout(r, 300));

    // 4. Verify Approval Requested event
    const traceManager = store.getTraceManager();
    const traceEvents = traceManager.getStore().getMissionTrace('m1');
    const approvalReqEvent = traceEvents.find(e => e.eventType === 'tool_approval_requested');
    console.log('M1 EVENTS:', JSON.stringify(traceEvents, null, 2));
    expect(approvalReqEvent).toBeDefined();
    expect(approvalReqEvent?.approval?.status).toBe('PENDING');

    // 5. Simulate User Approval
    const approvalsMap = (ToolApprovalPolicy as any).approvals as Map<string, any>;
    const keys = Array.from(approvalsMap.keys());
    expect(keys.length).toBeGreaterThan(0);
    const actualApprovalId = keys[0];

    ToolApprovalPolicy.resolveApproval(actualApprovalId, 'APPROVED');

    // 6. Wait for Execution to finish
    await execPromise;

    // 7. Verify Tool Executed Successfully
    const finalEvents = traceManager.getStore().getMissionTrace('m1');
    const grantedEvent = finalEvents.find(e => e.eventType === 'tool_approval_granted');
    expect(grantedEvent).toBeDefined();

    const toolStartedEvent = finalEvents.find(e => e.eventType === 'tool_execution_started');
    expect(toolStartedEvent).toBeDefined();
    expect(mockRegistry.executeTool).toHaveBeenCalled();
  });

  it('should block execution when user REJECTS', async () => {
    const toolName = 'mock_high_risk_tool';
    const mockRegistry = {
      getDefinition: vi.fn().mockReturnValue({ riskLevel: 'HIGH', approvalRequired: true }),
      executeTool: vi.fn(),
      getAllDefinitions: vi.fn().mockReturnValue([{ name: toolName }]),
      registerDefaultTools: vi.fn().mockResolvedValue(undefined),
      serializeForPrompt: vi.fn().mockReturnValue('mocked tools')
    };
    const mockAdapter = {
      generateStream: vi.fn().mockResolvedValue(`<tool_call>{"name":"${toolName}","args":{}}</tool_call>`)
    };
    const leaseManager: any = { renewLease: vi.fn(), releaseLease: vi.fn() };
    const ledger: any = { getActiveTaskNode: vi.fn().mockReturnValue({
      definition: { id: 't2', title: 'Task2', expectedOutputs: [] },
      state: { status: 'RUNNING' }
    }), commitTaskBudget: vi.fn() };

    const mockCheckpointRuntime = { recordCrash: vi.fn(), recoverTasks: vi.fn(), maybeSaveOnTurnBoundary: vi.fn(), clearTask: vi.fn() };
    const executor = new DeepTaskExecutor(
      store, leaseManager, ledger, mockAdapter as any, mockRegistry as any, mockCheckpointRuntime as any
    );

    store.initMission('m2', { maxReasoningTurns: 10 } as any);
    store.registerTask({ definition: { id: 't2', title: 'Task2', expectedOutputs: [] }, state: { status: 'RUNNING' } } as any, 'm2');

    const execPromise = executor.execute('m2', 't2', '1', 'lease2', new AbortController().signal);
    await new Promise(r => setTimeout(r, 300));

    const keys = Array.from(((ToolApprovalPolicy as any).approvals as Map<string, any>).keys());
    const actualApprovalId = keys[0];

    ToolApprovalPolicy.resolveApproval(actualApprovalId, 'REJECTED');

    await execPromise; // error is caught internally and converted to Failure Observation

    const finalEvents = store.getTraceManager().getStore().getMissionTrace('m2');
    const rejectedEvent = finalEvents.find(e => e.eventType === 'tool_approval_rejected');
    expect(rejectedEvent).toBeDefined();

    // Tool execution should NOT be called
    expect(mockRegistry.executeTool).not.toHaveBeenCalled();

    // Observation should show failure
    const observationEvent = finalEvents.find(e => e.eventType === 'tool_observation_created');
    expect(observationEvent?.observation?.status).toBe('REJECTED');
    expect(observationEvent?.observation?.summary).toContain('explicitly REJECTED');
  });
});
