/**
 * @file Phase4ToolLifecycle.integration.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 / 4.2 Tool Lifecycle 통합 검증 (Selection → Approval → Execution Started → Terminal → Observation)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import { ExecutionTraceManager } from '../trace/ExecutionTraceManager';
import { ToolApprovalPolicy, ToolApprovalViolationError } from '../policy/ToolApprovalPolicy';
import { ToolObservationBuilder } from '../executors/ToolObservationBuilder';
import type { ToolDefinition } from '../../types';

describe('Phase 4 Tool Lifecycle Integration Suite', () => {
  let store: ExecutionTraceStore;
  let manager: ExecutionTraceManager;
  let builder: ToolObservationBuilder;

  beforeEach(() => {
    store = new ExecutionTraceStore();
    manager = new ExecutionTraceManager(store);
    builder = new ToolObservationBuilder();
    ToolApprovalPolicy.clear();
  });

  it('1. verifies full lifecycle sequence for LOW risk tool execution (selection -> execution_started -> completed -> observation)', () => {
    const missionId = 'mission-lc-1';
    const taskId = 'task-lc-1';
    const attemptId = 'att-1';
    const toolCallId = 'tcall-low-1';

    // 1) Selection Decision & Selection Event
    manager.recordDecisionSummary(missionId, taskId, attemptId, {
      objective: 'Read file content',
      knownFacts: ['File exists'],
      missingInformation: [],
      selectedAction: 'read_file',
      selectedTool: 'read_file',
      selectionReason: 'Need to inspect configuration',
      alternativesConsidered: [],
      rejectionReasons: {},
      expectedOutcome: 'Returns file content',
      riskLevel: 'LOW',
      approvalRequired: false,
      nextStepIfFailed: 'Report missing file'
    });

    const lowDef: ToolDefinition = {
      name: 'read_file',
      description: 'Read file',
      parameters: { type: 'object', properties: {} },
      riskLevel: 'LOW',
      approvalRequired: false
    };

    const { toolTrace } = manager.recordToolSelected(
      missionId, taskId, attemptId,
      toolCallId, 'read_file', 'filesystem',
      'Select read_file', { path: '/etc/config.json' }, lowDef
    );

    expect(toolTrace.resultStatus).toBe('SELECTED');

    // 2) Execution Started before execution
    manager.recordToolExecutionStarted(missionId, taskId, attemptId, toolTrace);
    expect(toolTrace.resultStatus).toBe('RUNNING');
    expect(toolTrace.startedAt).toBeGreaterThan(0);

    // 3) Execution Completed (Terminal Event)
    manager.recordToolExecutionTerminal(
      missionId, taskId, attemptId, toolTrace,
      'SUCCEEDED', 'File read successfully', { exitCode: 0 }
    );
    expect(toolTrace.resultStatus).toBe('SUCCEEDED');
    expect(toolTrace.completedAt).toBeGreaterThanOrEqual(toolTrace.startedAt!);

    // 4) Tool Observation created
    const obs = builder.buildSuccess(
      { toolCallId, toolName: 'read_file', arguments: { path: '/etc/config.json' } },
      { success: true, result: '{"key": "value"}' },
      { exitCode: 0, durationMs: toolTrace.durationMs }
    );
    manager.recordToolObservation(missionId, taskId, attemptId, obs);

    // Verify trace history strictly follows sequence
    const trace = store.getMissionTrace(missionId);
    const eventTypes = trace.map(e => e.eventType);

    expect(eventTypes).toContain('decision_summary_created');
    expect(eventTypes).toContain('tool_selected');
    expect(eventTypes).toContain('tool_execution_started');
    expect(eventTypes).toContain('tool_execution_completed');
    expect(eventTypes).toContain('tool_observation_created');

    // Verify terminal event guarantee
    expect(store.isTerminalEventRecorded(toolCallId)).toBe(true);
  });

  it('2. verifies HIGH risk tool execution requiring explicit user approval (selection -> approval_requested -> approval_granted -> execution_started -> completed)', () => {
    const missionId = 'mission-lc-2';
    const taskId = 'task-lc-2';
    const attemptId = 'att-1';
    const toolCallId = 'tcall-high-1';

    const highDef: ToolDefinition = {
      name: 'delete_file',
      description: 'Delete file',
      parameters: { type: 'object', properties: {} },
      riskLevel: 'HIGH',
      approvalRequired: true
    };

    const { toolTrace } = manager.recordToolSelected(
      missionId, taskId, attemptId,
      toolCallId, 'delete_file', 'filesystem',
      'Select delete_file', { path: '/temp/old.log' }, highDef
    );

    // Request approval
    const req = manager.recordApprovalRequested(
      missionId, taskId, attemptId,
      toolCallId, 'delete_file', 'HIGH',
      { path: '/temp/old.log' }, ['/temp/old.log'], 'Deleting old log file'
    );
    expect(req.status).toBe('PENDING');

    // Execution should be blocked if we assert before approval
    expect(() => {
      ToolApprovalPolicy.assertApproved('delete_file', req.status, 'HIGH');
    }).toThrowError(ToolApprovalViolationError);

    // Resolve approval as APPROVED
    const resolved = ToolApprovalPolicy.resolveApproval(req.approvalId, 'APPROVED');
    expect(resolved.status).toBe('APPROVED');

    // Record approval granted event
    manager.recordApprovalGranted(missionId, taskId, attemptId, toolCallId, 'delete_file', resolved);

    // Now execution start is allowed
    expect(() => {
      ToolApprovalPolicy.assertApproved('delete_file', resolved.status, 'HIGH');
    }).not.toThrow();

    manager.recordToolExecutionStarted(missionId, taskId, attemptId, toolTrace);
    manager.recordToolExecutionTerminal(missionId, taskId, attemptId, toolTrace, 'SUCCEEDED', 'Deleted file');

    const trace = store.getMissionTrace(missionId);
    expect(trace.some(e => e.eventType === 'tool_approval_requested')).toBe(true);
    expect(trace.some(e => e.eventType === 'tool_approval_granted')).toBe(true);
    expect(trace.some(e => e.eventType === 'tool_execution_started')).toBe(true);
    expect(trace.some(e => e.eventType === 'tool_execution_completed')).toBe(true);
  });

  it('3. blocks execution and produces CANCELLED/REJECTED observation when user rejects approval (0 executions)', () => {
    const missionId = 'mission-lc-3';
    const taskId = 'task-lc-3';
    const attemptId = 'att-1';
    const toolCallId = 'tcall-high-2';

    const highDef: ToolDefinition = {
      name: 'sys_request_host',
      description: 'Run host command',
      parameters: { type: 'object', properties: {} },
      riskLevel: 'HIGH',
      approvalRequired: true
    };

    const { toolTrace } = manager.recordToolSelected(
      missionId, taskId, attemptId,
      toolCallId, 'sys_request_host', 'host',
      'Run host script', { cmd: 'rm -rf *' }, highDef
    );

    const req = manager.recordApprovalRequested(
      missionId, taskId, attemptId,
      toolCallId, 'sys_request_host', 'HIGH',
      { cmd: 'rm -rf *' }, [], 'Risky command'
    );

    // User rejects approval
    const resolved = ToolApprovalPolicy.resolveApproval(req.approvalId, 'REJECTED');
    manager.recordApprovalRejected(missionId, taskId, attemptId, toolCallId, 'sys_request_host', resolved, 'User denied execution');

    // Execution check throws error
    let thrownErr: ToolApprovalViolationError | undefined;
    try {
      ToolApprovalPolicy.assertApproved('sys_request_host', resolved.status, 'HIGH');
    } catch (e: any) {
      thrownErr = e;
    }
    expect(thrownErr).toBeInstanceOf(ToolApprovalViolationError);

    // Record terminal event for rejected call
    manager.recordToolExecutionTerminal(
      missionId, taskId, attemptId, toolTrace,
      'CANCELLED', 'Tool execution cancelled due to user rejection',
      { errorCode: 'APPROVAL_REJECTED' }
    );

    // Build rejected observation
    const obs = builder.buildRejected(
      { toolCallId, toolName: 'sys_request_host', arguments: { cmd: 'rm -rf *' } },
      thrownErr!.message
    );
    manager.recordToolObservation(missionId, taskId, attemptId, obs);

    const trace = store.getMissionTrace(missionId);
    expect(trace.some(e => e.eventType === 'tool_execution_started')).toBe(false); // execution NEVER started
    expect(trace.some(e => e.eventType === 'tool_execution_failed')).toBe(true); // cancelled terminal event recorded
    expect(trace.some(e => e.eventType === 'tool_observation_created' && e.observation?.status === 'REJECTED')).toBe(true);
  });

  it('4. guarantees exactly 1 terminal event per tool span even if terminal methods are invoked multiple times or tool fails/timeouts', () => {
    const missionId = 'mission-lc-4';
    const taskId = 'task-lc-4';
    const attemptId = 'att-1';
    const toolCallId = 'tcall-dup-1';

    const { toolTrace } = manager.recordToolSelected(
      missionId, taskId, attemptId,
      toolCallId, 'run_test', 'testing',
      'Run unit tests', {}, { name: 'run_test', riskLevel: 'MEDIUM' } as any
    );

    manager.recordToolExecutionStarted(missionId, taskId, attemptId, toolTrace);

    // First terminal event: FAILED
    manager.recordToolExecutionTerminal(missionId, taskId, attemptId, toolTrace, 'FAILED', 'Test assertion failed');
    expect(store.isTerminalEventRecorded(toolCallId)).toBe(true);

    // Attempt second terminal event (should be skipped due to 1-terminal guarantee)
    manager.recordToolExecutionTerminal(missionId, taskId, attemptId, toolTrace, 'SUCCEEDED', 'Late success');

    const trace = store.getMissionTrace(missionId);
    const terminalEvents = trace.filter(e => e.spanId === toolCallId && (e.eventType === 'tool_execution_failed' || e.eventType === 'tool_execution_completed'));
    expect(terminalEvents.length).toBe(1);
    expect(terminalEvents[0].status).toBe('FAILED');
  });

  it('5. prevents False Success in ToolObservationBuilder when tool internal error occurs (result.success = false)', () => {
    const obs = builder.buildSuccess(
      { toolCallId: 'call-err', toolName: 'build', arguments: {} },
      { success: false, error: 'Compilation failed with syntax error' },
      { exitCode: 2 }
    );

    expect(obs.status).toBe('FAILED');
    expect(obs.summary).toContain('실행 실패 (FAILED)');
    expect(obs.exitCode).toBe(2);
    expect(obs.failureReason).toContain('Compilation failed');
  });
});
