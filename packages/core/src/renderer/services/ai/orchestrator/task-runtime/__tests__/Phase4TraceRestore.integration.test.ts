/**
 * @file Phase4TraceRestore.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 Execution Trace 복원(Restore) 시 미결 Span(INTERRUPTED) 마감, 시퀀스 연속성 및 정책 복구 통합 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import { ToolApprovalPolicy } from '../policy/ToolApprovalPolicy';
import type { TraceEvent } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace Restore Integration Suite', () => {
  let store: ExecutionTraceStore;

  beforeEach(() => {
    store = new ExecutionTraceStore();
    ToolApprovalPolicy.clear();
  });

  it('1. automatically reconciles unclosed RUNNING spans with an INTERRUPTED terminal event upon restore', async () => {
    const missionId = 'm-restore-1';

    // Simulate pre-crash event stream loaded from storage
    const persistedEvents: TraceEvent[] = [
      {
        eventId: `${missionId}_1_start`,
        traceId: missionId,
        spanId: 'span-m',
        missionId,
        timestamp: Date.now() - 5000,
        eventType: 'mission_started',
        status: 'RUNNING',
        sequenceNumber: 1,
        visibility: 'USER',
        schemaVersion: '4.0.0'
      },
      {
        eventId: `${missionId}_2_tool_run`,
        traceId: missionId,
        spanId: 'span-unclosed-tool',
        parentSpanId: 'span-t1',
        missionId,
        timestamp: Date.now() - 3000,
        eventType: 'tool_execution_started',
        status: 'RUNNING',
        title: 'Running long tool',
        summary: 'Executing delete_file...',
        sequenceNumber: 2,
        visibility: 'OPERATOR',
        schemaVersion: '4.0.0',
        toolExecution: {
          toolCallId: 'span-unclosed-tool',
          toolName: 'delete_file',
          toolCategory: 'filesystem',
          selectionReason: 'cleanup',
          normalizedArguments: { path: '/tmp/old' },
          redactedArgumentKeys: [],
          riskLevel: 'HIGH',
          approvalRequired: true,
          startedAt: Date.now() - 3000,
          resultStatus: 'RUNNING'
        }
      }
    ];

    // Load into store directly (or via restore)
    persistedEvents.forEach(e => store.appendEvent(e));
    expect(store.isTerminalEventRecorded('span-unclosed-tool')).toBe(false);

    // Perform restore reconciliation
    const reconciliation = await store.restore(missionId);

    // Verify unclosed span was closed with INTERRUPTED
    expect(reconciliation.interruptedSpans.length).toBe(1);
    expect(reconciliation.interruptedSpans[0]).toBe('span-unclosed-tool');
    expect(store.isTerminalEventRecorded('span-unclosed-tool')).toBe(true);

    const trace = store.getMissionTrace(missionId);
    const interruptedEvent = trace.find(e => e.spanId === 'span-unclosed-tool' && e.eventType === 'tool_execution_failed');
    expect(interruptedEvent).toBeDefined();
    expect(interruptedEvent?.status).toBe('INTERRUPTED');
    expect(interruptedEvent?.summary).toContain('INTERRUPTED');
  });

  it('2. maintains sequence number monotonicity across restore boundaries without collision', async () => {
    const missionId = 'm-restore-seq';

    store.appendEvent({
      eventId: `${missionId}_1_a`, traceId: missionId, spanId: 's1', missionId,
      timestamp: Date.now(), eventType: 'mission_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0'
    });
    store.appendEvent({
      eventId: `${missionId}_5_b`, traceId: missionId, spanId: 's2', missionId,
      timestamp: Date.now(), eventType: 'task_started', status: 'RUNNING', sequenceNumber: 5, visibility: 'USER', schemaVersion: '4.0.0'
    });

    // Run restore
    await store.restore(missionId);

    // Next sequence number must be > 5 (i.e. 6 or higher if runtime_restored was emitted)
    const nextSeq = store.nextSequenceNumber(missionId);
    expect(nextSeq).toBeGreaterThan(5);
  });

  it('3. emits runtime_restored OPERATOR event on restore to audit recovery timeline', async () => {
    const missionId = 'm-restore-event';

    store.appendEvent({
      eventId: `${missionId}_1_init`, traceId: missionId, spanId: 's1', missionId,
      timestamp: Date.now(), eventType: 'mission_started', status: 'RUNNING', sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0'
    });

    await store.restore(missionId);

    const trace = store.getMissionTrace(missionId);
    const restoredEv = trace.find(e => e.eventType === 'runtime_restored' as any);
    expect(restoredEv).toBeDefined();
    expect(restoredEv?.visibility).toBe('OPERATOR');
    expect(restoredEv?.summary).toContain('trace state successfully restored');
  });

  it('4. reconciles ToolApprovalPolicy state and executedToolKeys from persistent approval events during restore', async () => {
    const missionId = 'm-restore-policy';

    // Append pending approval request event and executed tool event
    store.appendEvent({
      eventId: `${missionId}_1_appr`, traceId: missionId, spanId: 'call-appr-1', missionId,
      timestamp: Date.now(), eventType: 'tool_approval_requested', status: 'PENDING',
      sequenceNumber: 1, visibility: 'USER', schemaVersion: '4.0.0',
      approval: {
        approvalId: 'appr-idemp-policy-1',
        traceId: missionId,
        missionId,
        taskId: 't1',
        toolCallId: 'call-appr-1',
        toolName: 'sys_format_vfs',
        riskLevel: 'CRITICAL',
        arguments: {},
        affectedResources: [],
        reason: 'Format drive',
        status: 'PENDING',
        requestedAt: Date.now()
      }
    });

    store.appendEvent({
      eventId: `${missionId}_2_done`, traceId: missionId, spanId: 'call-exec-1', missionId,
      timestamp: Date.now(), eventType: 'tool_execution_completed', status: 'SUCCEEDED',
      sequenceNumber: 2, visibility: 'USER', schemaVersion: '4.0.0',
      toolExecution: {
        toolCallId: 'call-exec-1',
        toolName: 'read_file',
        toolCategory: 'filesystem',
        selectionReason: 'read',
        normalizedArguments: {},
        redactedArgumentKeys: [],
        riskLevel: 'LOW',
        approvalRequired: false,
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        resultStatus: 'SUCCEEDED'
      }
    });

    await store.restore(missionId);

    // Verify approval state was restored into ToolApprovalPolicy
    const restoredAppr = ToolApprovalPolicy.getApprovalRequest('appr-idemp-policy-1');
    expect(restoredAppr).toBeDefined();
    expect(restoredAppr?.status).toBe('PENDING');

    // Verify executed tool span was marked in ToolApprovalPolicy idempotency ledger
    expect(ToolApprovalPolicy.isToolExecuted(`idemp-appr-${missionId}-call-exec-1`)).toBe(true);
  });
});
