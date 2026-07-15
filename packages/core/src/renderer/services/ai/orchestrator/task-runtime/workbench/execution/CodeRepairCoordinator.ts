import { CodeWorkbenchJob, CheckResult, RepairRequest, CodeRepairPolicy } from '../domain/WorkbenchTypes';

interface DiagnosticHistoryEntry {
  hash: string;
  count: number;
  strategyChanges: number;
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
            
            if (this.policy.maxStrategyChanges !== undefined && entry.strategyChanges >= this.policy.maxStrategyChanges) {
               throw new Error(`NO_PROGRESS: Maximum strategy changes reached (${this.policy.maxStrategyChanges}).`);
            }
            
            entry.strategyChanges++;
            entry.count = 1; // reset repeat count after strategy change
            // we let it pass to try a new strategy
          } else if (!diagNotImproved || !testsNotImproved) {
             // Progress made! reset count
             this.history.set(signatureStr, {
                hash: currentHash,
                count: 1,
                strategyChanges: entry.strategyChanges, // keep strategy changes
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
            strategyChanges: 0,
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
