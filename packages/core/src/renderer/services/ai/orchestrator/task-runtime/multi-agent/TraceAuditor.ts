/**
 * @file orchestrator/task-runtime/multi-agent/TraceAuditor.ts
 * @system AMEVA OS Desktop Workstation
 * @role Trace and Audit for Multi-Agent Runtime
 */

import { MultiAgentRole, Provenance } from './types.ts';

export type AgentEventType =
  | 'agentActionStarted'
  | 'agentActionCompleted'
  | 'handoffCreated'
  | 'handoffRejected'
  | 'conflictDetected'
  | 'conflictResolved'
  | 'verificationFailed'
  | 'approvalRequested'
  | 'approvalGranted'
  | 'executionBlocked'
  | 'resumeRecovered'
  | 'quarantineEscalated';

export interface AuditEvent {
  eventId: string;
  eventType: AgentEventType;
  timestamp: number;
  correlationId: string;
  taskId: string;
  missionId: string;
  role: MultiAgentRole;
  metadata: any;
}

export class TraceAuditor {
  private log: AuditEvent[] = [];

  public appendEvent(
    eventType: AgentEventType,
    taskId: string,
    missionId: string,
    role: MultiAgentRole,
    metadata: any
  ): AuditEvent {
    const event: AuditEvent = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      timestamp: Date.now(),
      correlationId: `${missionId}-${taskId}`,
      taskId,
      missionId,
      role,
      metadata: this.redactSensitiveData(metadata)
    };
    
    this.log.push(event);
    return event;
  }

  public getTrace(taskId: string): AuditEvent[] {
    return this.log.filter(e => e.taskId === taskId);
  }

  public getFullAudit(): AuditEvent[] {
    return [...this.log];
  }

  private redactSensitiveData(metadata: any): any {
    if (!metadata) return metadata;
    const clone = JSON.parse(JSON.stringify(metadata)); // Deep copy
    // Recursive redaction logic stub
    const keysToRedact = ['password', 'token', 'secret', 'apikey'];
    
    const redact = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key of Object.keys(obj)) {
          if (keysToRedact.some(k => key.toLowerCase().includes(k))) {
            obj[key] = '[REDACTED]';
          } else {
            redact(obj[key]);
          }
        }
      }
    };
    
    redact(clone);
    return clone;
  }
}
