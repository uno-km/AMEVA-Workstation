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

  it('5. Prints SYNTHETIC CODE BENCHMARK report with 8 scenarios', () => {
    // 1. TypeScript 타입 오류 (Repair 1회 후 성공)
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, { codeJobId: 'job-tsc' } as any, 150, 1, 2, 1, 0);
    // 2. 누락 Import (단순 변경, Repair 0회)
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, { codeJobId: 'job-import' } as any, 50, 0, 1, 1, 0);
    // 3. Unit Test 실패 (Repair 2회 후 성공)
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, { codeJobId: 'job-test' } as any, 300, 2, 3, 1, 0);
    // 4. JSON Config 수정 (단순 파일 변경)
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, { codeJobId: 'job-json' } as any, 20, 0, 1, 1, 0);
    // 5. 함수와 Unit Test 추가 (파일 추가/변경)
    builder.recordJobCompletion({ status: 'COMPLETED' } as any, { codeJobId: 'job-feature' } as any, 400, 0, 2, 0, 1);
    // 6. Build 실패 후 Repair (Repair 3회 후 실패)
    builder.recordJobCompletion({ status: 'FAILED' } as any, { codeJobId: 'job-build-fail' } as any, 800, 3, 4, 1, 0);
    // 7. Protected File 차단 (승인 대기)
    builder.recordJobCompletion({ status: 'WAITING_USER' } as any, { codeJobId: 'job-protected' } as any, 10, 0, 0, 0, 0);
    (builder as any).metrics.approvalBlockedCount = 1;
    // 8. Network 작업 차단/WAITING_USER
    builder.recordJobCompletion({ status: 'WAITING_USER' } as any, { codeJobId: 'job-network' } as any, 15, 0, 0, 0, 0);
    (builder as any).metrics.approvalBlockedCount = 2; // incremented

    const report = builder.getReport();
    console.log('\n--- SYNTHETIC CODE BENCHMARK ---');
    console.log(JSON.stringify(report, null, 2));
    
    expect(report.totalJobs).toBe(8);
    expect(report.completedJobs).toBe(5);
    expect(report.failedJobs).toBe(1);
    expect(report.waitingUserJobs).toBe(2);
    
    // Assert 0 bypasses as requested
    expect(report.testWeakeningSuccessfulBypassCount).toBe(0);
    expect(report.approvalStubBypassCount).toBe(0);
    expect(report.requiredCheckNotRunSuccessCount).toBe(0);
    expect(report.forcedPassCount).toBe(0);
    expect(report.sourceDirectModificationCount).toBe(0);
    expect(report.infiniteRepairCount).toBe(0);
  });
});
