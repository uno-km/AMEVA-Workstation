import { describe, it, expect, beforeEach } from 'vitest';
import { MultiAgentOrchestrator } from '../MultiAgentOrchestrator.js';
import { ConflictResolver } from '../ConflictResolver.js';
import { CapabilityRouter } from '../CapabilityRouter.js';
import { TraceAuditor } from '../TraceAuditor.js';
import { ImplementationPlan, ProposedChanges, ReviewReport, VerificationReport, ApprovalRequestBundle } from '../types.js';

describe('Phase 7: Multi-Agent Collaboration', () => {
  let orchestrator: MultiAgentOrchestrator;
  let conflictResolver: ConflictResolver;
  let capabilityRouter: CapabilityRouter;
  let traceAuditor: TraceAuditor;

  beforeEach(() => {
    conflictResolver = new ConflictResolver();
    capabilityRouter = new CapabilityRouter();
    traceAuditor = new TraceAuditor();
    orchestrator = new MultiAgentOrchestrator(conflictResolver, capabilityRouter, traceAuditor);
  });

  const getBaseProvenance = (role: any) => ({
    createdBy: 'agent-1',
    role,
    timestamp: Date.now(),
    taskId: 'task-1',
    missionId: 'mission-1'
  });

  it('5. Happy Path multi-agent trace', () => {
    const task = orchestrator.createTask('mission-1', [], 'rev-1');
    
    // Planner
    orchestrator.submitPlan({
      artifactId: 'plan-1',
      revision: 1,
      provenance: getBaseProvenance('PLANNER'),
      baseRevision: 'rev-1',
      requiredInputs: [],
      targetFiles: ['test.ts'],
      steps: [{ description: 'Test', expectedOutcome: 'Test' }],
      validationRules: []
    });

    // Implementer
    orchestrator.submitChanges({
      artifactId: 'changes-1',
      revision: 1,
      provenance: { ...getBaseProvenance('IMPLEMENTER'), planId: 'plan-1' },
      baseRevision: 'rev-1',
      patches: [{ filePath: 'test.ts', diff: 'diff', checksum: '123' }]
    });

    // Reviewer
    orchestrator.submitReview({
      artifactId: 'rev-report-1',
      revision: 1,
      provenance: { ...getBaseProvenance('REVIEWER'), targetChangesId: 'changes-1' },
      status: 'APPROVED',
      feedback: []
    });

    // Verifier
    orchestrator.submitVerification({
      artifactId: 'verif-1',
      revision: 1,
      provenance: { ...getBaseProvenance('VERIFIER'), targetChangesId: 'changes-1' },
      status: 'PASSED',
      testResults: { passed: 1, failed: 0, logs: '' },
      lintResults: { passed: true, issues: [] }
    });

    const trace = traceAuditor.getTrace(task.taskId);
    expect(trace.length).toBeGreaterThan(0);
    console.log('=== 5) Happy Path multi-agent trace ===\n', JSON.stringify(trace, null, 2));
  });

  it('6. Reject/Rework 경로 증거', () => {
    orchestrator.createTask('mission-1', [], 'rev-1');
    orchestrator.submitReview({
      artifactId: 'rev-report-1',
      revision: 1,
      provenance: { ...getBaseProvenance('REVIEWER'), targetChangesId: 'changes-1' },
      status: 'REJECTED',
      feedback: [{ filePath: 'test.ts', message: 'Bad code', severity: 'ERROR' }]
    });

    const trace = traceAuditor.getTrace('task-1');
    expect(trace.some(e => e.eventType === 'handoffRejected')).toBe(true);
    console.log('=== 6) Reject/Rework 경로 증거 ===\n', JSON.stringify(trace, null, 2));
  });

  it('7. Conflict detection/resolution 증거', () => {
    orchestrator.createTask('mission-1', [], 'rev-1');
    // Implementer submitting changes against wrong plan targets
    orchestrator.submitPlan({
      artifactId: 'plan-1',
      revision: 1,
      provenance: getBaseProvenance('PLANNER'),
      baseRevision: 'rev-1',
      requiredInputs: [],
      targetFiles: ['required.ts'],
      steps: [], validationRules: []
    });

    orchestrator.submitChanges({
      artifactId: 'changes-1',
      revision: 1,
      provenance: { ...getBaseProvenance('IMPLEMENTER'), planId: 'plan-1' },
      baseRevision: 'rev-1',
      patches: [{ filePath: 'wrong.ts', diff: 'diff', checksum: '123' }]
    });

    const trace = traceAuditor.getTrace('task-1');
    expect(trace.some(e => e.eventType === 'conflictDetected')).toBe(true);
    console.log('=== 7) Conflict detection/resolution 증거 ===\n', JSON.stringify(trace, null, 2));
  });

  it('8. Approval required/high-risk blocked 증거', () => {
    const bundle: ApprovalRequestBundle = {
      artifactId: 'appr-1',
      revision: 1,
      provenance: { createdBy: 'SYSTEM_ORCHESTRATOR', role: 'IMPLEMENTER', timestamp: Date.now(), missionId: 'm1', taskId: 't1' },
      baseRevision: 'rev-1',
      artifacts: { planId: '1', changesId: '2', reviewId: '3', verificationId: '4' },
      riskLevel: 'CRITICAL'
    };

    expect(() => orchestrator.requestApproval(bundle)).toThrow("SECURITY_BOUNDARY_VIOLATION");
    
    const trace = traceAuditor.getFullAudit();
    expect(trace.some(e => e.eventType === 'quarantineEscalated')).toBe(true);
    console.log('=== 8) Approval required/high-risk blocked 증거 ===\n', JSON.stringify(trace, null, 2));
  });

  it('9. Resume after restart 증거', () => {
    orchestrator.createTask('mission-1', ['dep-1'], 'rev-1'); // BLOCKED
    orchestrator.resumeTasks();
    
    const trace = traceAuditor.getFullAudit();
    expect(trace.some(e => e.eventType === 'resumeRecovered')).toBe(true);
    console.log('=== 9) Resume after restart 증거 ===\n', JSON.stringify(trace, null, 2));
  });

  it('10. forged payload ignored 증거', () => {
    const fakePayload = { token: 'secret-token-123', data: 'malicious' };
    orchestrator.handleForgedPayload(fakePayload);
    
    const trace = traceAuditor.getFullAudit();
    expect(trace.some(e => e.eventType === 'quarantineEscalated')).toBe(true);
    console.log('=== 10) forged payload ignored 증거 ===\n', JSON.stringify(trace, null, 2));
  });

  it('11. no direct source apply bypass 증거', () => {
    // Implementers cannot request apply directly
    expect(capabilityRouter.canExecute('IMPLEMENTER', 'requestApply')).toBe(false);
    expect(capabilityRouter.validateHighRiskAction('IMPLEMENTER', 'EXECUTE_APPLY', false, false)).toBe(false);
    console.log('=== 11) no direct source apply bypass 증거 ===\n', JSON.stringify({
      implementerCanRequestApply: capabilityRouter.canExecute('IMPLEMENTER', 'requestApply'),
      implementerCanExecuteApply: capabilityRouter.validateHighRiskAction('IMPLEMENTER', 'EXECUTE_APPLY', false, false)
    }, null, 2));
  });

  it('12. audit/trace raw output', () => {
    const trace = traceAuditor.getFullAudit();
    console.log('=== 12) audit/trace raw output ===\n', JSON.stringify(trace, null, 2));
  });
});
