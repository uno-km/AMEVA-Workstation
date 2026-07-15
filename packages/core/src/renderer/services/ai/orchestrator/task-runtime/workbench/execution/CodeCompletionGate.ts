import { CodeWorkbenchJob, CheckResult, CodeChangeReport } from '../domain/WorkbenchTypes';

export class CodeCompletionGate {
  public assertCanComplete(job: CodeWorkbenchJob, checkResults: CheckResult[], report: CodeChangeReport): void {
    
    if (report.sourceApplyStatus === 'APPLIED') {
      throw new Error(`COMPLETION_GATE_VIOLATION: APPLIED state is not allowed in Phase 6.2 Code Workbench. Must be BLOCKED_BY_APPROVAL_INTEGRATION or similar.`);
    }

    if (report.outputRevision !== job.currentRevision) {
      throw new Error(`COMPLETION_GATE_VIOLATION: CodeChangeReport outputRevision mismatch.`);
    }

    for (const check of checkResults) {
      if (check.required) {
        if (check.status !== 'PASS' && check.status !== 'NOT_APPLICABLE') {
          throw new Error(`COMPLETION_GATE_VIOLATION: Required check ${check.checkType} is in state ${check.status}.`);
        }
        if (check.verifiedRevision !== job.currentRevision) {
          throw new Error(`COMPLETION_GATE_VIOLATION: Required check ${check.checkType} was verified on an older revision.`);
        }
        // Implicitly assume inputDigest matches if verifiedRevision matches in our simplified setup, otherwise we'd check it here.
      }
    }

    if (report.unresolvedDiagnostics.length > 0) {
      throw new Error(`COMPLETION_GATE_VIOLATION: Cannot complete with unresolved required diagnostics.`);
    }
  }

  public assertTestWeakeningSafe(weakeningResults: any[]): void {
    for (const res of weakeningResults) {
      if (res.weakeningDetected) {
        if (!res.justificationRequired) {
          throw new Error(`TEST_WEAKENING_DETECTED: Unauthorized test weakening detected in ${res.testFile}`);
        } else {
           // Wait for user or block by approval integration
           throw new Error(`TEST_WEAKENING_SUSPECTED: Test weakening suspected in ${res.testFile}. Justification required.`);
        }
      }
    }
  }
}
