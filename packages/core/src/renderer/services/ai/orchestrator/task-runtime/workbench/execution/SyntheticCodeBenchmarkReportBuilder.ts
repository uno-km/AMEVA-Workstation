import { CodeWorkbenchJob, CheckResult, CodeChangeReport, SyntheticCodeBenchmarkReport } from '../domain/WorkbenchTypes';

export class SyntheticCodeBenchmarkReportBuilder {
  private metrics: SyntheticCodeBenchmarkReport = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    waitingUserJobs: 0,
    averageCommandCount: 0,
    averageRepairCount: 0,
    partialPatchCount: 0,
    fullFileReplacementCount: 0,
    noProgressCount: 0,
    testWeakeningBlockedCount: 0,
    testWeakeningSuccessfulBypassCount: 0,
    approvalBlockedCount: 0,
    approvalStubBypassCount: 0,
    requiredCheckNotRunSuccessCount: 0,
    forcedPassCount: 0,
    sourceDirectModificationCount: 0,
    infiniteRepairCount: 0,
    averageDurationMs: 0
  };

  public recordJobCompletion(job: CodeWorkbenchJob, report: CodeChangeReport, durationMs: number, repairCount: number, commandCount: number, partialPatches: number, fullReplacements: number) {
    this.metrics.totalJobs++;
    if (job.status === 'COMPLETED') this.metrics.completedJobs++;
    if (job.status === 'FAILED') this.metrics.failedJobs++;
    if (job.status === 'WAITING_USER') this.metrics.waitingUserJobs++;

    this.metrics.averageDurationMs = ((this.metrics.averageDurationMs * (this.metrics.totalJobs - 1)) + durationMs) / this.metrics.totalJobs;
    this.metrics.averageCommandCount = ((this.metrics.averageCommandCount * (this.metrics.totalJobs - 1)) + commandCount) / this.metrics.totalJobs;
    this.metrics.averageRepairCount = ((this.metrics.averageRepairCount * (this.metrics.totalJobs - 1)) + repairCount) / this.metrics.totalJobs;
    
    this.metrics.partialPatchCount += partialPatches;
    this.metrics.fullFileReplacementCount += fullReplacements;

    // Strict assertions
    if (this.metrics.requiredCheckNotRunSuccessCount > 0) throw new Error("Violation: requiredCheckNotRunSuccessCount > 0");
    if (this.metrics.forcedPassCount > 0) throw new Error("Violation: forcedPassCount > 0");
    if (this.metrics.sourceDirectModificationCount > 0) throw new Error("Violation: sourceDirectModificationCount > 0");
    if (this.metrics.testWeakeningSuccessfulBypassCount > 0) throw new Error("Violation: testWeakeningSuccessfulBypassCount > 0");
    if (this.metrics.approvalStubBypassCount > 0) throw new Error("Violation: approvalStubBypassCount > 0");
    if (this.metrics.infiniteRepairCount > 0) throw new Error("Violation: infiniteRepairCount > 0");
  }

  public recordNoProgress() {
    this.metrics.noProgressCount++;
  }

  public recordTestWeakeningBlocked() {
    this.metrics.testWeakeningBlockedCount++;
  }

  public recordApprovalBlocked() {
    this.metrics.approvalBlockedCount++;
  }

  public getReport(): SyntheticCodeBenchmarkReport {
    return { ...this.metrics };
  }
}
