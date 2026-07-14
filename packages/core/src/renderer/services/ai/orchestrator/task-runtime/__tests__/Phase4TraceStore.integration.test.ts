/**
 * @file Phase4TraceStore.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 Execution Trace Store의 Ordering, Idempotency, Sequence Monotonicity 및 Compaction 통합 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace Store Integration Suite', () => {
  let store: ExecutionTraceStore;

  beforeEach(() => {
    store = new ExecutionTraceStore();
  });

  it('1. guarantees monotonic sequence numbers per missionId across interleaved events', () => {
    expect(store.nextSequenceNumber('mission-a')).toBe(1);
    expect(store.nextSequenceNumber('mission-b')).toBe(1);
    expect(store.nextSequenceNumber('mission-a')).toBe(2);
    expect(store.nextSequenceNumber('mission-a')).toBe(3);
    expect(store.nextSequenceNumber('mission-b')).toBe(2);
  });

  it('2. enforces eventId idempotency by ignoring duplicate events', () => {
    const ev: TraceEvent = {
      eventId: 'evt-unique-101',
      traceId: 'm-idemp',
      spanId: 'span-1',
      missionId: 'm-idemp',
      timestamp: Date.now(),
      eventType: 'task_started',
      status: 'RUNNING',
      title: 'Task 1 Start',
      summary: 'Task started',
      sequenceNumber: 1,
      visibility: 'USER',
      schemaVersion: '4.0.0'
    };

    store.appendEvent(ev);
    expect(store.getMissionTrace('m-idemp').length).toBe(1);

    // Attempt appending duplicate eventId
    store.appendEvent({
      ...ev,
      summary: 'Duplicate append attempt'
    });
    expect(store.getMissionTrace('m-idemp').length).toBe(1);
    expect(store.getMissionTrace('m-idemp')[0].summary).toBe('Task started');
  });

  it('3. checks terminal event status correctly with isTerminalEventRecorded', () => {
    const spanId = 'span-term-chk';
    const missionId = 'm-term';

    store.appendEvent({
      eventId: 'ev-1',
      traceId: missionId,
      spanId,
      missionId,
      timestamp: Date.now(),
      eventType: 'tool_execution_started',
      status: 'RUNNING',
      sequenceNumber: 1,
      visibility: 'USER',
      schemaVersion: '4.0.0'
    });

    expect(store.isTerminalEventRecorded(spanId)).toBe(false);

    store.appendEvent({
      eventId: 'ev-2',
      traceId: missionId,
      spanId,
      missionId,
      timestamp: Date.now(),
      eventType: 'tool_execution_completed',
      status: 'SUCCEEDED',
      sequenceNumber: 2,
      visibility: 'USER',
      schemaVersion: '4.0.0'
    });

    expect(store.isTerminalEventRecorded(spanId)).toBe(true);
  });

  it('4. performs compaction correctly, removing internal/high-frequency events while preserving terminal and critical events', () => {
    const missionId = 'm-compact';

    store.appendEvent({
      eventId: 'c-1', traceId: missionId, spanId: 's1', missionId, timestamp: Date.now(),
      eventType: 'mission_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0'
    });
    store.appendEvent({
      eventId: 'c-2', traceId: missionId, spanId: 's2', missionId, timestamp: Date.now(),
      eventType: 'tool_execution_progress' as any, status: 'RUNNING', sequenceNumber: 2, visibility: 'INTERNAL', schemaVersion: '4.0.0'
    });
    store.appendEvent({
      eventId: 'c-3', traceId: missionId, spanId: 's3', missionId, timestamp: Date.now(),
      eventType: 'tool_execution_completed', status: 'SUCCEEDED', sequenceNumber: 3, visibility: 'USER', schemaVersion: '4.0.0'
    });

    expect(store.getMissionTrace(missionId).length).toBe(3);
    const removed = store.compactTrace(missionId);
    expect(removed).toBe(1);

    const compacted = store.getMissionTrace(missionId);
    expect(compacted.length).toBe(2);
    expect(compacted.some(e => e.eventId === 'c-2')).toBe(false);
    expect(compacted.some(e => e.eventId === 'c-1')).toBe(true);
    expect(compacted.some(e => e.eventId === 'c-3')).toBe(true);
  });
});
