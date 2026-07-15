import { describe, it, expect } from 'vitest';
import { CodeChangeReportBuilder } from '../../workbench/execution/CodeChangeReportBuilder';

describe('Phase 6.2: Source Apply Gate', () => {
  const builder = new CodeChangeReportBuilder();

  it('1. Outputs BLOCKED_BY_APPROVAL_INTEGRATION for SourceApplyStatus', () => {
    const job = { codeJobId: '1', currentRevision: 'rev-2' } as any;
    const report = builder.buildReport(job, [], 'BLOCKED_BY_APPROVAL_INTEGRATION');

    expect(report.sourceApplyStatus).toBe('BLOCKED_BY_APPROVAL_INTEGRATION');
    expect(report.finalOutcome).toContain('Verified Patch and CodeChangeReport generated in isolated Workbench');
  });
});
