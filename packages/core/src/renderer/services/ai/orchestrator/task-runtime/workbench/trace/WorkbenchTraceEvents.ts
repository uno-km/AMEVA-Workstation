import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';
import { WorkbenchSession, CommandPlan, WorkbenchDiff } from '../domain/WorkbenchTypes';

export class WorkbenchTraceEvents {
  constructor(private traceManager: ExecutionTraceManager) {}

  public recordWorkbenchEvent(
    session: WorkbenchSession, 
    eventType: string, 
    status: 'SUCCESS' | 'FAILED' | 'INTERRUPTED' = 'SUCCESS',
    summary: string = '',
    metadata: any = {}
  ) {
    this.traceManager.getStore().appendEvent({
      eventId: crypto.randomUUID(),
      traceId: session.missionId,
      spanId: `span-wb-${session.taskId}-${session.attemptId}`,
      parentSpanId: `span-t-${session.taskId}-${session.attemptId}`,
      missionId: session.missionId,
      taskId: session.taskId,
      attemptId: session.attemptId,
      timestamp: Date.now(),
      eventType,
      status,
      title: this.formatTitle(eventType),
      summary,
      sequenceNumber: 0, // In reality fetched from store
      visibility: 'INTERNAL',
      schemaVersion: '4.0.0',
      metadata: {
        workbenchType: session.workbenchType,
        ...metadata
      }
    });
  }

  public recordCommandEvent(
    session: WorkbenchSession,
    plan: CommandPlan,
    eventType: string,
    status: 'SUCCESS' | 'FAILED' | 'TIMED_OUT' | 'BLOCKED_BY_POLICY',
    summary: string,
    metadata: any = {}
  ) {
    this.traceManager.getStore().appendEvent({
      eventId: crypto.randomUUID(),
      traceId: session.missionId,
      spanId: `span-cmd-${plan.commandId}`,
      parentSpanId: `span-wb-${session.taskId}-${session.attemptId}`,
      missionId: session.missionId,
      taskId: session.taskId,
      attemptId: session.attemptId,
      timestamp: Date.now(),
      eventType,
      status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      title: `Command ${plan.executable}`,
      summary,
      sequenceNumber: 0,
      visibility: 'USER_FACING',
      schemaVersion: '4.0.0',
      metadata: {
        commandId: plan.commandId,
        executable: plan.executable,
        riskLevel: plan.riskLevel,
        ...metadata
      }
    });
  }

  private formatTitle(eventType: string): string {
    return eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
