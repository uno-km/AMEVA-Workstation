import { describe, it, expect, beforeEach } from 'vitest';
import { MultiAgentOrchestrator } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/multi-agent/MultiAgentOrchestrator.js';
import { ConflictResolver } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/multi-agent/ConflictResolver.js';
import { CapabilityRouter } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/multi-agent/CapabilityRouter.js';
import { TraceAuditor } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/multi-agent/TraceAuditor.js';

describe('Phase 7: Desktop Integration - Multi-Agent Collaboration', () => {
  let orchestrator: MultiAgentOrchestrator;
  let traceAuditor: TraceAuditor;
  let capabilityRouter: CapabilityRouter;

  beforeEach(() => {
    traceAuditor = new TraceAuditor();
    capabilityRouter = new CapabilityRouter();
    orchestrator = new MultiAgentOrchestrator(
      new ConflictResolver(),
      capabilityRouter,
      traceAuditor
    );
  });

  const getBaseProvenance = (role: any, taskId: string = 'task-desk-1') => ({
    createdBy: 'agent-desktop-1',
    role,
    timestamp: Date.now(),
    taskId,
    missionId: 'mission-desk-1'
  });

  it('1. planner -> implementer -> reviewer -> verifier happy path', () => {
    const task = orchestrator.createTask('mission-desk-1', [], 'rev-desk-1');
    expect(task.state).toBe('READY');
    const tid = task.taskId;

    orchestrator.submitPlan({
      artifactId: 'plan-1',
      revision: 1,
      provenance: getBaseProvenance('PLANNER', tid),
      baseRevision: 'rev-desk-1',
      requiredInputs: [],
      targetFiles: ['desktop-main.ts'],
      steps: [{ description: 'Desktop logic', expectedOutcome: 'Done' }],
      validationRules: []
    });

    orchestrator.submitChanges({
      artifactId: 'changes-1',
      revision: 1,
      provenance: { ...getBaseProvenance('IMPLEMENTER', tid), planId: 'plan-1' },
      baseRevision: 'rev-desk-1',
      patches: [{ filePath: 'desktop-main.ts', diff: 'diff', checksum: '123' }]
    });

    orchestrator.submitReview({
      artifactId: 'rev-report-1',
      revision: 1,
      provenance: { ...getBaseProvenance('REVIEWER', tid), targetChangesId: 'changes-1' },
      status: 'APPROVED',
      feedback: []
    });

    orchestrator.submitVerification({
      artifactId: 'verif-1',
      revision: 1,
      provenance: { ...getBaseProvenance('VERIFIER', tid), targetChangesId: 'changes-1' },
      status: 'PASSED',
      testResults: { passed: 5, failed: 0, logs: '' },
      lintResults: { passed: true, issues: [] }
    });

    const trace = traceAuditor.getTrace(tid);
    expect(trace.length).toBe(5); // CREATE, PLAN, CHANGES, REVIEW, VERIFICATION
    expect(trace[trace.length - 1].eventType).toBe('handoffCreated');
    console.log('=== Desktop Integration: Happy Path ===\n', JSON.stringify(trace, null, 2));
  });

  it('2. reject/rework loop', () => {
    orchestrator.createTask('mission-desk-1', [], 'rev-desk-1');
    orchestrator.submitReview({
      artifactId: 'rev-report-1',
      revision: 1,
      provenance: { ...getBaseProvenance('REVIEWER'), targetChangesId: 'changes-1' },
      status: 'REJECTED',
      feedback: [{ filePath: 'desktop-main.ts', message: 'Lint error', severity: 'ERROR' }]
    });

    const trace = traceAuditor.getTrace('task-desk-1');
    expect(trace.some(e => e.eventType === 'handoffRejected')).toBe(true);
    console.log('=== Desktop Integration: Reject/Rework Loop ===\n', JSON.stringify(trace, null, 2));
  });

  it('3. approval required / high-risk blocked', () => {
    // Attempt to bypass by a normal agent
    expect(() => {
      orchestrator.requestApproval({
        artifactId: 'appr-1',
        revision: 1,
        provenance: { createdBy: 'agent-1', role: 'IMPLEMENTER', timestamp: Date.now(), missionId: 'm1', taskId: 't1' },
        baseRevision: 'rev-1',
        artifacts: { planId: '1', changesId: '2', reviewId: '3', verificationId: '4' },
        riskLevel: 'HIGH'
      });
    }).toThrow("SECURITY_BOUNDARY_VIOLATION");
    
    const trace = traceAuditor.getFullAudit();
    expect(trace.some(e => e.eventType === 'quarantineEscalated')).toBe(true);
    console.log('=== Desktop Integration: Approval Required / High-risk Blocked ===\n', JSON.stringify(trace, null, 2));
  });

  it('4. forged payload ignored', () => {
    const payload = { token: 'secret-1234', exploit: true };
    orchestrator.handleForgedPayload(payload);
    
    const trace = traceAuditor.getFullAudit();
    const event = trace.find(e => e.eventType === 'quarantineEscalated');
    expect(event).toBeDefined();
    expect(event?.metadata.payload.token).toBe('[REDACTED]');
    console.log('=== Desktop Integration: Forged Payload Ignored ===\n', JSON.stringify(trace, null, 2));
  });

  it('5. no direct source apply bypass', () => {
    expect(capabilityRouter.canExecute('PLANNER', 'requestApply')).toBe(false);
    expect(capabilityRouter.canExecute('IMPLEMENTER', 'requestApply')).toBe(false);
    expect(capabilityRouter.validateHighRiskAction('IMPLEMENTER', 'EXECUTE_APPLY', false, false)).toBe(false);
    console.log('=== Desktop Integration: No Direct Source Apply Bypass ===\n', JSON.stringify({ bypassed: false }, null, 2));
  });

  it('6. resume after restart', () => {
    orchestrator.createTask('mission-desk-1', ['dependency'], 'rev-desk-1');
    orchestrator.resumeTasks();
    const trace = traceAuditor.getFullAudit();
    expect(trace.some(e => e.eventType === 'resumeRecovered')).toBe(true);
    console.log('=== Desktop Integration: Resume After Restart ===\n', JSON.stringify(trace, null, 2));
  });

  it('7. trace/audit raw output', () => {
    orchestrator.createTask('audit-mission', [], 'audit-rev');
    const trace = traceAuditor.getFullAudit();
    expect(trace.length).toBeGreaterThan(0);
    console.log('=== Desktop Integration: Trace/Audit Raw Output ===\n', JSON.stringify(trace, null, 2));
  });
});
