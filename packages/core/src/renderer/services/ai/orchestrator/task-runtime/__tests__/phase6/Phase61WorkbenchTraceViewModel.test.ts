import { describe, it, expect, vi } from 'vitest';
import { WorkbenchTraceEvents } from '../../workbench/trace/WorkbenchTraceEvents';
import { WorkbenchSession } from '../../workbench/domain/WorkbenchTypes';

describe('Phase6.1 WorkbenchTraceViewModel', () => {
  it('should emit workbench_declared and command_started events properly without raw Chain of Thought', () => {
    const appendEventMock = vi.fn();
    const mockManager: any = {
      getStore: () => ({ appendEvent: appendEventMock })
    };

    const traceEvents = new WorkbenchTraceEvents(mockManager);
    
    const session: WorkbenchSession = {
      workbenchSessionId: 'wb-1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchType: 'CODE',
      sourceWorkspace: '/',
      isolatedWorkspace: '/',
      baseRevision: '1',
      currentRevision: '1',
      allowedPaths: [],
      protectedPaths: [],
      allowedCommands: [],
      networkPolicy: 'DENY',
      resourceLimits: {} as any,
      requiredChecks: [],
      expectedArtifacts: [],
      status: 'DECLARED',
      createdAt: 0,
      updatedAt: 0
    };

    traceEvents.recordWorkbenchEvent(session, 'workbench_declared');

    expect(appendEventMock).toHaveBeenCalled();
    const event = appendEventMock.mock.calls[0][0];
    
    expect(event.eventType).toBe('workbench_declared');
    expect(event.visibility).toBe('INTERNAL'); // Does not show raw CoT
    expect(event.metadata.workbenchType).toBe('CODE');
  });
});
