import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace Performance', () => {
  let store: ExecutionTraceStore;

  beforeEach(() => {
    store = new ExecutionTraceStore();
    store.clear();
  });

  it('should handle large batches of trace events without duplicates', () => {
    const events: TraceEvent[] = [];
    for (let i = 0; i < 5000; i++) {
      events.push({
        eventId: `evt-${i}`,
        traceId: 'm1',
        spanId: `span-${i}`,
        missionId: 'm1',
        timestamp: 1000 + i,
        eventType: 'tool_execution_completed',
        status: 'INFO',
        sequenceNumber: i + 1,
        visibility: 'INTERNAL',
        schemaVersion: '4.0.0'
      });
    }

    // appendBatch should process 5000 elements fast
    const start = performance.now();
    store.appendBatch(events);
    const end = performance.now();
    
    // Performance limit assert: Should process 5000 items in < 500ms
    expect(end - start).toBeLessThan(500);

    // Deduplication check: appending the exact same batch again should add NO new items
    store.appendBatch(events);
    expect(store.getMissionTrace('m1')).toHaveLength(5000);
  });
});
