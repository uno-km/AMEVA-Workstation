import { 
  FinalReleaseGateReport,
  SourceApplyOperationStatus
} from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager';

export class FinalReleaseGateAuditor {
  constructor(
    private traceManager: ExecutionTraceManager
  ) {}

  public generateReport(
    missionId: string, 
    executionStatus: SourceApplyOperationStatus,
    benchmarkPassed: boolean,
    retentionValidated: boolean,
    queryValidated: boolean
  ): FinalReleaseGateReport {
    const traces = this.traceManager.getStore().getMissionTrace(missionId);
    
    let isCleanExecution = false;
    let containsQuarantine = false;
    let reconciliationTriggered = false;

    for (const t of traces) {
      if (t.metadata?.event === 'QUARANTINE_ENGAGED' || t.metadata?.event === 'CONSUME_PENDING_HOLD_ENGAGED') {
        containsQuarantine = true;
      }
      if (t.metadata?.reconciled === true) {
        reconciliationTriggered = true;
      }
    }

    if (executionStatus === 'APPLIED' && !containsQuarantine) {
      isCleanExecution = true;
    }

    const canonicalJson = {
      missionId,
      executionStatus,
      isCleanExecution,
      containsQuarantine,
      reconciliationTriggered,
      benchmarkPassed,
      retentionValidated,
      queryValidated,
      traces: traces.map(t => ({ timestamp: t.timestamp, event: t.metadata?.event }))
    };

    const summaryMarkdown = `
# Final Release Gate Report: Mission ${missionId}

## Overview
- **Status:** ${executionStatus}
- **Clean Execution:** ${isCleanExecution ? 'Yes' : 'No'}
- **Quarantine Triggered:** ${containsQuarantine ? 'Yes (WARNING)' : 'No'}
- **Reconciliation Triggered:** ${reconciliationTriggered ? 'Yes' : 'No'}

## Compliance Checks
- Benchmark: ${benchmarkPassed ? 'PASS' : 'FAIL'}
- Retention: ${retentionValidated ? 'PASS' : 'FAIL'}
- Query Auth: ${queryValidated ? 'PASS' : 'FAIL'}

## Trace Summary
${traces.map(t => `- [${new Date(t.timestamp).toISOString()}] ${t.metadata?.event}`).join('\n')}
    `;

    return {
      isCleanExecution,
      containsQuarantine,
      reconciliationTriggered,
      benchmarkPassed,
      retentionValidated,
      queryValidated,
      summaryMarkdown: summaryMarkdown.trim(),
      canonicalJson
    };
  }
}
