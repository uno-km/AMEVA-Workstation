import { CodeWorkbenchJob, CheckResult, RepairRequest, CodeRepairPolicy } from '../domain/WorkbenchTypes';

interface DiagnosticHistoryEntry {
  hash: string;
  count: number;
  failingTests: number;
  totalDiagnostics: number;
}

export class CodeRepairCoordinator {
  private history: Map<string, DiagnosticHistoryEntry> = new Map();

  constructor(private policy: CodeRepairPolicy) {}

  public async createRepairRequests(job: CodeWorkbenchJob, checkResults: CheckResult[], currentHash: string): Promise<RepairRequest[]> {
    const requests: RepairRequest[] = [];

    for (const check of checkResults) {
      if (check.status === 'FAIL' && check.diagnostics.length > 0) {
        
        // NO_PROGRESS evaluation
        const signatureStr = check.diagnostics.map(d => d.signature || '').sort().join('|');
        const entry = this.history.get(signatureStr);
        const currentFailingTests = check.diagnostics.filter(d => d.failingTestId).length;

        if (entry) {
          const countDelta = entry.count + 1;
          const hashSame = entry.hash === currentHash;
          const diagNotImproved = check.diagnostics.length >= entry.totalDiagnostics - this.policy.minimumDiagnosticImprovement;
          const testsNotImproved = currentFailingTests >= entry.failingTests;

          if (hashSame && this.policy.stopOnSameHash) {
             throw new Error(`NO_PROGRESS: Identical artifact hash (${currentHash}) with same diagnostics.`);
          }

          if (countDelta >= this.policy.maxSameDiagnosticRepeats && diagNotImproved && testsNotImproved) {
            if (!this.policy.allowStrategyChange) {
              throw new Error(`NO_PROGRESS: Identical failure signatures repeated ${countDelta} times without improvement.`);
            }
            // Implementation for strategy change could be returned here if needed.
            throw new Error(`NO_PROGRESS: Identical failure signatures repeated ${countDelta} times without improvement.`);
          }
          
          if (!diagNotImproved || !testsNotImproved) {
             // Progress made! reset count
             this.history.set(signatureStr, {
                hash: currentHash,
                count: 1,
                failingTests: currentFailingTests,
                totalDiagnostics: check.diagnostics.length
             });
          } else {
             // No progress, increment count
             entry.count = countDelta;
             entry.hash = currentHash;
          }
        } else {
          this.history.set(signatureStr, {
            hash: currentHash,
            count: 1,
            failingTests: currentFailingTests,
            totalDiagnostics: check.diagnostics.length
          });
        }

        // Map to Repair Request
        requests.push({
          failingCheckId: check.checkId,
          diagnosticSignatures: check.diagnostics.map(d => d.signature || ''),
          targetFile: check.diagnostics[0].file,
          targetSymbol: check.diagnostics[0].relatedSymbol,
          retryScope: check.diagnostics[0].retryScope,
          expectedOldHash: currentHash,
          sourceRevision: job.currentRevision,
          protectedRanges: [],
          doNotRepeat: true
        });
      }
    }

    return requests;
  }
}
