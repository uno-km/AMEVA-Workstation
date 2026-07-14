import { describe, it, expect } from 'vitest';
import { ExecutionTraceViewModel } from '../trace/ExecutionTraceViewModel';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 UI Rendering', () => {
  it('should convert trace events to TimelineCards and hide INTERNAL events', () => {
    const mockEvents: TraceEvent[] = [
      {
        eventId: '1',
        traceId: 'm1',
        spanId: 's1',
        missionId: 'm1',
        timestamp: 1000,
        eventType: 'mission_started',
        status: 'STARTED',
        title: 'Mission Start',
        sequenceNumber: 1,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0'
      },
      {
        eventId: '2',
        traceId: 'm1',
        spanId: 's2',
        missionId: 'm1',
        timestamp: 1001,
        eventType: 'token_generated', // Raw CoT Event
        status: 'INFO',
        title: 'Thinking Token',
        sequenceNumber: 2,
        visibility: 'INTERNAL',
        schemaVersion: '4.0.0'
      },
      {
        eventId: '3',
        traceId: 'm1',
        spanId: 's3',
        missionId: 'm1',
        timestamp: 1002,
        eventType: 'tool_execution_started',
        status: 'RUNNING',
        title: 'Run command',
        sequenceNumber: 3,
        visibility: 'USER',
        schemaVersion: '4.0.0',
        toolExecution: {
          toolCallId: 't1',
          toolName: 'run_command',
          toolCategory: 'shell',
          selectionReason: '',
          normalizedArguments: { command: 'echo password=SECRET' },
          redactedArgumentKeys: [], // Redaction is tested elsewhere
          riskLevel: 'LOW',
          approvalRequired: false,
          startedAt: 1002,
          resultStatus: 'RUNNING',
          retryable: false,
          errorCode: ''
        }
      }
    ];

    const timelineCards = ExecutionTraceViewModel.toTimelineEvents(mockEvents, 'USER');
    
    // Only 'mission_started' and 'tool_execution_started' should be in the timeline
    // Because visibility is 'USER', the 'OPERATOR' visibility event should ALSO be hidden!
    // Wait, let's check visibility logic. 'USER'(1) vs 'OPERATOR'(2).
    // If target is USER, only USER(1) events are shown.
    expect(timelineCards).toHaveLength(1);
    expect(timelineCards[0].id).toBe('3');
    expect(timelineCards[0].title).toBe('Run command');
    expect(timelineCards[0].type).toBe('TOOL');
  });

  it('should show OPERATOR events if minVisibility is OPERATOR', () => {
    const mockEvents: TraceEvent[] = [
      {
        eventId: '1',
        traceId: 'm1',
        spanId: 's1',
        missionId: 'm1',
        timestamp: 1000,
        eventType: 'mission_started',
        status: 'STARTED',
        sequenceNumber: 1,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0'
      },
      {
        eventId: '2',
        traceId: 'm1',
        spanId: 's2',
        missionId: 'm1',
        timestamp: 1001,
        eventType: 'token_generated',
        status: 'INFO',
        sequenceNumber: 2,
        visibility: 'INTERNAL',
        schemaVersion: '4.0.0'
      }
    ];

    const timelineCards = ExecutionTraceViewModel.toTimelineEvents(mockEvents, 'OPERATOR');
    
    // mission_started should be shown, token_generated should be hidden
    expect(timelineCards).toHaveLength(1);
    expect(timelineCards[0].id).toBe('1');
    expect(timelineCards[0].type).toBe('MISSION');
  });
});
