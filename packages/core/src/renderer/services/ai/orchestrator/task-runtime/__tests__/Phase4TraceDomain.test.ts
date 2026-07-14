/**
 * @file Phase4TraceDomain.test.ts
 * @system AMEVA OS Desktop Workstation
 * @role Phase 4 / 4.1 Execution Trace Domain, Policy, Redactor 및 ViewModel 통합 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionTraceStore } from '../trace/ExecutionTraceStore';
import { ExecutionTraceManager } from '../trace/ExecutionTraceManager';
import { ToolApprovalPolicy, ToolApprovalViolationError } from '../policy/ToolApprovalPolicy';
import { SecretRedactor } from '../trace/SecretRedactor';
import { ExecutionTraceViewModel } from '../trace/ExecutionTraceViewModel';
import type { DecisionSummary } from '../trace/ExecutionTraceTypes';

describe('Phase 4 Trace Domain & Policy Comprehensive Suite', () => {
  let store: ExecutionTraceStore;
  let manager: ExecutionTraceManager;

  beforeEach(() => {
    store = new ExecutionTraceStore();
    manager = new ExecutionTraceManager(store);
    ToolApprovalPolicy.clear();
  });

  describe('1. SecretRedactor Unit & Store Integration', () => {
    it('redactArguments masks sensitive keys (apiKey, password, Bearer token) without modifying original object', () => {
      const originalArgs = {
        apiKey: 'super_secret_api_key_12345',
        auth: {
          password: 'my_password_word',
          header: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        },
        safeParam: 'hello world',
        count: 42
      };

      const { redactedArguments, redactedArgumentKeys } = SecretRedactor.redactArguments(originalArgs);

      // Verify original is untouched
      expect(originalArgs.apiKey).toBe('super_secret_api_key_12345');
      expect(originalArgs.auth.password).toBe('my_password_word');

      // Verify redacted copy
      expect(redactedArguments.apiKey).toBe('[REDACTED_CREDENTIAL]');
      expect(redactedArguments.auth.password).toBe('[REDACTED_CREDENTIAL]');
      expect(redactedArguments.auth.header).toContain('Bearer [REDACTED_TOKEN]');
      expect(redactedArguments.safeParam).toBe('hello world');
      expect(redactedArguments.count).toBe(42);

      expect(redactedArgumentKeys).toContain('apiKey');
      expect(redactedArgumentKeys).toContain('auth.password');
      expect(redactedArgumentKeys).toContain('auth.header');
    });

    it('redactText masks private keys, bearer tokens, and cookies', () => {
      const rawText = `
Connecting with Cookie: session_id=abc123456; path=/
Authorization: Bearer secret_jwt_token_here
And RSA key:
-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJB...
-----END RSA PRIVATE KEY-----
      `;

      const redacted = SecretRedactor.redactText(rawText);
      expect(redacted).toContain('Cookie: [REDACTED_COOKIE]');
      expect(redacted).toContain('Bearer [REDACTED_TOKEN]');
      expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
      expect(redacted).not.toContain('session_id=abc123456');
    });

    it('ExecutionTraceStore automatically redacts events on appendEvent', () => {
      store.appendEvent({
        eventId: 'm1_1_test',
        traceId: 'm1',
        spanId: 's1',
        missionId: 'm1',
        timestamp: Date.now(),
        eventType: 'tool_execution_started',
        status: 'RUNNING',
        title: 'Run API',
        summary: 'Calling API with Authorization: Bearer top_secret_token_x',
        sequenceNumber: 1,
        visibility: 'USER',
        schemaVersion: '4.0.0',
        toolExecution: {
          toolCallId: 'tcall_1',
          toolName: 'fetch_url',
          toolCategory: 'network',
          selectionReason: 'fetch data',
          normalizedArguments: { apiKey: 'secret_123', url: 'https://example.com' },
          redactedArgumentKeys: [],
          riskLevel: 'LOW',
          approvalRequired: false,
          startedAt: Date.now(),
          resultStatus: 'RUNNING'
        }
      });

      const trace = store.getMissionTrace('m1');
      expect(trace.length).toBe(1);
      expect(trace[0].summary).toContain('Bearer [REDACTED_TOKEN]');
      expect(trace[0].toolExecution?.normalizedArguments.apiKey).toBe('[REDACTED_CREDENTIAL]');
      expect(trace[0].toolExecution?.normalizedArguments.url).toBe('https://example.com');
    });
  });

  describe('2. ExecutionTraceStore Ordering, Export, and Compaction', () => {
    it('guarantees monotonic sequence numbers across multiple missions', () => {
      expect(store.nextSequenceNumber('mission-a')).toBe(1);
      expect(store.nextSequenceNumber('mission-a')).toBe(2);
      expect(store.nextSequenceNumber('mission-b')).toBe(1);
      expect(store.nextSequenceNumber('mission-a')).toBe(3);
    });

    it('exportTrace outputs structured schema 4.0.0 JSON with secret redaction re-applied', () => {
      manager.recordMissionStarted('m-exp', 'Test Export Mission');
      manager.recordTaskStarted('m-exp', 't-exp-1', 'att-1', 'Export Task');
      manager.recordDecisionSummary('m-exp', 't-exp-1', 'att-1', {
        objective: 'Test export',
        knownFacts: ['fact 1'],
        missingInformation: [],
        selectedAction: 'Call fetch_url',
        selectedTool: 'fetch_url',
        selectionReason: 'Because we need data using Bearer secret_export_token',
        alternativesConsidered: [],
        rejectionReasons: {},
        expectedOutcome: 'Got data',
        riskLevel: 'LOW',
        approvalRequired: false,
        nextStepIfFailed: 'Retry'
      });

      const exported = store.exportTrace('m-exp');
      expect(exported.schemaVersion).toBe('4.0.0');
      expect(exported.missionSummary?.missionId).toBe('m-exp');
      expect(exported.taskTimeline.length).toBe(1);
      expect(exported.decisionSummaries.length).toBe(1);
      expect(exported.decisionSummaries[0].selectionReason).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('compactTrace removes high-frequency/internal progress events while preserving terminal and decision events', () => {
      manager.recordMissionStarted('m-comp', 'Compaction Mission');
      manager.recordTaskStarted('m-comp', 't-1', 'a-1');

      // Append an internal progress event directly to store
      store.appendEvent({
        eventId: 'm-comp_99_prog',
        traceId: 'm-comp',
        spanId: 's-prog',
        missionId: 'm-comp',
        timestamp: Date.now(),
        eventType: 'tool_execution_progress' as any,
        status: 'RUNNING',
        title: 'Internal progress',
        summary: 'Step 1/100',
        sequenceNumber: 99,
        visibility: 'INTERNAL',
        schemaVersion: '4.0.0'
      });

      expect(store.getMissionTrace('m-comp').length).toBe(3);
      const removedCount = store.compactTrace('m-comp');
      expect(removedCount).toBe(1);
      expect(store.getMissionTrace('m-comp').length).toBe(2);
      expect(store.getMissionTrace('m-comp').some(e => e.eventType === 'tool_execution_progress' as any)).toBe(false);
    });
  });

  describe('3. Decision Summary Validation & Safe Fallback', () => {
    it('applies safe fallback summary and emits OPERATOR trace when DecisionSummary schema validation fails', () => {
      // Pass incomplete/invalid decision summary
      const invalidDecision = {
        objective: 'Missing some required fields like riskLevel and selectionReason',
        selectedTool: 'broken_tool'
      } as unknown as DecisionSummary;

      const ev = manager.recordDecisionSummary('m-dec', 't-dec', 'att-1', invalidDecision);

      // Verify that valid fallback decision was recorded in ev
      expect(ev.decision?.selectedTool).toBe('broken_tool');
      expect(ev.decision?.riskLevel).toBe('HIGH');
      expect(ev.decision?.selectionReason).toContain('Safe fallback decision summary due to schema validation failure');

      // Verify an OPERATOR fallback notice was also emitted
      const trace = store.getMissionTrace('m-dec');
      const fallbackEvent = trace.find(e => e.eventType === 'decision_summary_fallback_used' as any);
      expect(fallbackEvent).toBeDefined();
      expect(fallbackEvent?.visibility).toBe('OPERATOR');
      expect(fallbackEvent?.status).toBe('WARNING');
    });
  });

  describe('4. ToolApprovalPolicy Risk Evaluation & Approval Runtime', () => {
    it('prioritizes ToolDefinition.riskLevel over defaults when evaluating risk', () => {
      // Define a tool that would normally sound low risk by name, but definition specifies CRITICAL
      const def = {
        name: 'custom_check',
        description: 'Custom checking tool',
        parameters: { type: 'object', properties: {} },
        riskLevel: 'CRITICAL' as const
      };

      const result = ToolApprovalPolicy.evaluateRisk('custom_check', {}, def);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.approvalRequired).toBe(true);
    });

    it('blocks execution with ToolApprovalViolationError when HIGH/CRITICAL tool is unapproved', () => {
      expect(() => {
        ToolApprovalPolicy.assertApproved('dangerous_tool', 'PENDING', 'HIGH');
      }).toThrowError(ToolApprovalViolationError);

      expect(() => {
        ToolApprovalPolicy.assertApproved('dangerous_tool', 'REJECTED', 'CRITICAL');
      }).toThrowError(ToolApprovalViolationError);

      // Should not throw when APPROVED
      expect(() => {
        ToolApprovalPolicy.assertApproved('dangerous_tool', 'APPROVED', 'HIGH');
      }).not.toThrow();
    });

    it('injectTestRiskClassifier isolates test overrides cleanly without mock_ prefix risk modification', () => {
      ToolApprovalPolicy.injectTestRiskClassifier((toolName) => {
        if (toolName === 'test_high_risk_tool') return 'HIGH';
        return undefined;
      });

      const { riskLevel, approvalRequired } = ToolApprovalPolicy.evaluateRisk('test_high_risk_tool', {});
      expect(riskLevel).toBe('HIGH');
      expect(approvalRequired).toBe(true);
    });
  });

  describe('5. ExecutionTraceViewModel Connectivity & Filtering', () => {
    it('filterByVisibility hides INTERNAL events and respects minVisibility ranks', () => {
      store.appendEvent({
        eventId: 'm-view_1', traceId: 'm-view', spanId: 'v1', missionId: 'm-view',
        timestamp: Date.now(), eventType: 'mission_started', status: 'RUNNING',
        title: 'User event', summary: 'Visible to user', sequenceNumber: 1,
        visibility: 'USER', schemaVersion: '4.0.0'
      });
      store.appendEvent({
        eventId: 'm-view_2', traceId: 'm-view', spanId: 'v2', missionId: 'm-view',
        timestamp: Date.now(), eventType: 'task_started', status: 'RUNNING',
        title: 'Operator event', summary: 'Visible to operator', sequenceNumber: 2,
        visibility: 'OPERATOR', schemaVersion: '4.0.0'
      });
      store.appendEvent({
        eventId: 'm-view_3', traceId: 'm-view', spanId: 'v3', missionId: 'm-view',
        timestamp: Date.now(), eventType: 'tool_execution_started', status: 'RUNNING',
        title: 'Internal event', summary: 'Should be hidden', sequenceNumber: 3,
        visibility: 'INTERNAL', schemaVersion: '4.0.0'
      });

      const trace = store.getMissionTrace('m-view');
      const userCards = ExecutionTraceViewModel.filterByVisibility(trace, 'USER');
      expect(userCards.length).toBe(1);
      expect(userCards[0].visibility).toBe('USER');

      const opCards = ExecutionTraceViewModel.filterByVisibility(trace, 'OPERATOR');
      expect(opCards.length).toBe(2);
      expect(opCards.some(e => e.visibility === 'INTERNAL')).toBe(false);
    });

    it('toTimelineEvents converts TraceEvents into sorted TimelineCards with correct types', () => {
      manager.recordDecisionSummary('m-vm', 't-1', 'att-1', {
        objective: 'VM test', knownFacts: [], missingInformation: [],
        selectedAction: 'Run tool', selectedTool: 'sys_print', selectionReason: 'Print info',
        alternativesConsidered: [], rejectionReasons: {}, expectedOutcome: 'Printed',
        riskLevel: 'LOW', approvalRequired: false, nextStepIfFailed: 'Stop'
      });

      manager.recordToolObservation('m-vm', 't-1', 'att-1', {
        toolCallId: 'call-abc',
        toolName: 'sys_print',
        status: 'SUCCESS',
        summary: 'Successfully printed output to terminal',
        createdAt: Date.now()
      });

      const trace = store.getMissionTrace('m-vm');
      const timeline = ExecutionTraceViewModel.toTimelineEvents(trace);

      expect(timeline.length).toBe(2);
      expect(timeline[0].type).toBe('DECIDED');
      expect(timeline[1].type).toBe('OBSERVATION');

      const decisions = ExecutionTraceViewModel.getDecisionSummaries(trace);
      expect(decisions.length).toBe(1);
      expect(decisions[0].selectedTool).toBe('sys_print');

      const observations = ExecutionTraceViewModel.getObservations(trace);
      expect(observations.length).toBe(1);
      expect(observations[0].toolName).toBe('sys_print');
    });
  });
});
