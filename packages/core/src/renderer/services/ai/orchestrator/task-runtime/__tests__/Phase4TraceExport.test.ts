import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace Export', () => {
  let store: ExecutionTraceStore;

  beforeEach(() => {
    store = new ExecutionTraceStore();
    store.clear();
  });

  it('should export formatted trace without INTERNAL and CoT events', () => {
    const missionId = 'm-123';
    
    const events: TraceEvent[] = [
      {
        eventId: '1',
        traceId: missionId,
        spanId: 's1',
        missionId,
        timestamp: 1000,
        eventType: 'mission_started',
        status: 'STARTED',
        summary: 'Mission started',
        sequenceNumber: 1,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0'
      },
      {
        eventId: '2',
        traceId: missionId,
        spanId: 's2',
        missionId,
        timestamp: 1001,
        eventType: 'token_generated',
        status: 'INFO',
        sequenceNumber: 2,
        visibility: 'INTERNAL',
        schemaVersion: '4.0.0'
      },
      {
        eventId: '3',
        traceId: missionId,
        spanId: 's3',
        missionId,
        timestamp: 1002,
        eventType: 'tool_execution_completed',
        status: 'SUCCEEDED',
        sequenceNumber: 3,
        visibility: 'USER',
        schemaVersion: '4.0.0',
        toolExecution: {
          toolCallId: 't1',
          toolName: 'read_file',
          toolCategory: 'read',
          selectionReason: '',
          normalizedArguments: { path: '/secret/password.txt' },
          redactedArgumentKeys: ['path'], // SecretRedactor should mock this in real usage, but we test the export logic
          riskLevel: 'LOW',
          approvalRequired: false,
          resultStatus: 'SUCCEEDED',
          retryable: false,
          errorCode: ''
        }
      }
    ];

    store.appendBatch(events);

    const exported = store.exportTrace(missionId);
    
    // 1. schemaVersion checks
    expect(exported.schemaVersion).toBe('4.0.0');
    
    // 2. missionSummary
    expect(exported.missionSummary).toBeDefined();
    expect(exported.missionSummary.missionId).toBe(missionId);

    // 3. toolCalls (INTERNAL and Token events should be omitted entirely)
    expect(exported.toolCalls).toHaveLength(1);
    expect(exported.toolCalls[0].toolName).toBe('read_file');

    // Make sure token_generated isn't exported anywhere as a "taskTimeline" or anything else
    expect(exported.taskTimeline).toHaveLength(0);
  });
});
