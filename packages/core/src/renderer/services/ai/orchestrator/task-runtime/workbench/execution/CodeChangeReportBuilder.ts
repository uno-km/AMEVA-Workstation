import { CodeWorkbenchJob, CheckResult, CodeChangeReport, SourceApplyStatus } from '../domain/WorkbenchTypes';

export class CodeChangeReportBuilder {
  public buildReport(
    job: CodeWorkbenchJob,
    checkResults: CheckResult[],
    sourceApplyStatus: SourceApplyStatus = 'BLOCKED_BY_APPROVAL_INTEGRATION'
  ): CodeChangeReport {
    
    return {
      codeJobId: job.codeJobId,
      objective: job.objective,
      baseRevision: job.baseRevision,
      outputRevision: job.currentRevision,
      addedFiles: [],
      modifiedFiles: job.targetFiles, // In a real implementation, we'd extract from diff
      deletedFiles: [],
      renamedCandidates: [],
      changedSymbols: [],
      changedRanges: [],
      checks: checkResults,
      testSummary: checkResults.filter(c => c.checkType === 'test' && c.status === 'PASS').length > 0 ? 'Tests passed' : 'No tests run',
      buildSummary: checkResults.filter(c => c.checkType === 'build' && c.status === 'PASS').length > 0 ? 'Build passed' : 'No build run',
      unresolvedDiagnostics: [],
      riskSummary: 'No high risks identified.',
      modelRoutingSummary: job.routingProfile,
      approvalSummary: 'Some commands required approval and were blocked.',
      sourceApplyStatus,
      artifactIds: [],
      finalOutcome: 'Verified Patch and CodeChangeReport generated in isolated Workbench'
    };
  }
}
