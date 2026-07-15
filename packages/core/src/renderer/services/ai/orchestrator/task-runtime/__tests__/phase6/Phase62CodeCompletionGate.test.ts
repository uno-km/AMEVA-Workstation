import { describe, it, expect } from 'vitest';
import { CodeCompletionGate } from '../../workbench/execution/CodeCompletionGate';
import { CodeChangeReport } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2: Code Completion Gate', () => {
  const gate = new CodeCompletionGate();

  it('1. Blocks completion if report SourceApplyStatus is APPLIED', () => {
    const job = { currentRevision: 'rev-2' } as any;
    const report: CodeChangeReport = { sourceApplyStatus: 'APPLIED', outputRevision: 'rev-2', unresolvedDiagnostics: [] } as any;

    expect(() => gate.assertCanComplete(job, [], report)).toThrow('COMPLETION_GATE_VIOLATION: APPLIED state is not allowed');
  });

  it('2. Blocks completion if a required check was verified on an older revision', () => {
    const job = { currentRevision: 'rev-2' } as any;
    const report: CodeChangeReport = { sourceApplyStatus: 'BLOCKED_BY_APPROVAL_INTEGRATION', outputRevision: 'rev-2', unresolvedDiagnostics: [] } as any;
    
    const checks = [
      { checkType: 'test', required: true, status: 'PASS', verifiedRevision: 'rev-1' }
    ] as any[];

    expect(() => gate.assertCanComplete(job, checks, report)).toThrow('COMPLETION_GATE_VIOLATION: Required check test was verified on an older revision');
  });

  it('3. Allows completion if revisions match and checks pass', () => {
    const job = { currentRevision: 'rev-2' } as any;
    const report: CodeChangeReport = { sourceApplyStatus: 'BLOCKED_BY_APPROVAL_INTEGRATION', outputRevision: 'rev-2', unresolvedDiagnostics: [] } as any;
    
    const checks = [
      { checkType: 'test', required: true, status: 'PASS', verifiedRevision: 'rev-2' }
    ] as any[];

    expect(() => gate.assertCanComplete(job, checks, report)).not.toThrow();
  });
});
