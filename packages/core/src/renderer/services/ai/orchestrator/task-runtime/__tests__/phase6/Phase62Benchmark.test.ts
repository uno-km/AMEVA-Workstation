import { describe, it, expect, beforeEach } from 'vitest';
import { SyntheticCodeBenchmarkReportBuilder } from '../../workbench/execution/SyntheticCodeBenchmarkReportBuilder';
import { CodeWorkbenchJob, CodeChangeReport } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2.2: SyntheticCodeBenchmarkReportBuilder', () => {
  let builder: SyntheticCodeBenchmarkReportBuilder;

  beforeEach(() => {
    builder = new SyntheticCodeBenchmarkReportBuilder();
  });

  it('1. Throws if requiredCheckNotRunSuccessCount > 0', () => {
    // We hack the internals just to simulate it being > 0
    (builder as any).metrics.requiredCheckNotRunSuccessCount = 1;
    
    expect(() => {
       builder.recordJobCompletion({ status: 'COMPLETED' } as any, {} as any, 100, 1, 1, 1, 0);
    }).toThrow('Violation: requiredCheckNotRunSuccessCount > 0');
  });

  it('2. Throws if forcedPassCount > 0', () => {
    (builder as any).metrics.forcedPassCount = 1;
    
    expect(() => {
       builder.recordJobCompletion({ status: 'COMPLETED' } as any, {} as any, 100, 1, 1, 1, 0);
    }).toThrow('Violation: forcedPassCount > 0');
  });

  it('3. Throws if sourceDirectModificationCount > 0', () => {
    (builder as any).metrics.sourceDirectModificationCount = 1;
    
    expect(() => {
       builder.recordJobCompletion({ status: 'COMPLETED' } as any, {} as any, 100, 1, 1, 1, 0);
    }).toThrow('Violation: sourceDirectModificationCount > 0');
  });

  it('4. Accumulates averages correctly', () => {
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, {} as any, 100, 1, 2, 1, 0);
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, {} as any, 200, 3, 4, 1, 0);

    const report = builder.getReport();
    expect(report.totalJobs).toBe(2);
    expect(report.completedJobs).toBe(2);
    expect(report.averageDurationMs).toBe(150);
    expect(report.averageRepairCount).toBe(2);
    expect(report.averageCommandCount).toBe(3);
    expect(report.partialPatchCount).toBe(2);
  });
});
