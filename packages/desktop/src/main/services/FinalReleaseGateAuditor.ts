import { FinalReleaseGateReport } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types.js';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';
import { IApplyExecutionPersistence } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/RepositoryInterfaces.js';

export class FinalReleaseGateAuditor {
  constructor(
    private traceManager: ExecutionTraceManager,
    private execRepo?: IApplyExecutionPersistence
  ) {}

  public async generateReport(
    missionId: string, 
    executionId: string,
    benchmarkPassed: boolean,
    retentionValidated: boolean,
    queryValidated: boolean,
    regressionPassed: boolean = true,
    tscPassed: boolean = true,
    gitClean: boolean = true
  ): Promise<FinalReleaseGateReport> {
    const traces = this.traceManager.getStore().getMissionTrace(missionId);
    
    let executionStatus = 'UNKNOWN';
    if (this.execRepo) {
      const record = await this.execRepo.getExecutionRecord(executionId);
      if (record) executionStatus = record.status;
    }

    const containsQuarantine = traces.some(t => t.metadata?.event === 'QUARANTINE_ENGAGED');
    const reconciliationTriggered = traces.some(t => t.metadata?.event === 'CONSUMPTION_FAILED');
    const isCleanExecution = !containsQuarantine && !reconciliationTriggered && executionStatus === 'APPLIED';

    const allPassed = 
      regressionPassed && 
      tscPassed && 
      gitClean && 
      benchmarkPassed && 
      retentionValidated && 
      queryValidated && 
      !containsQuarantine; // quarantine is considered a fail in strict release gate

    const reportObj = {
      missionId,
      executionStatus,
      isCleanExecution,
      containsQuarantine,
      reconciliationTriggered,
      benchmarkPassed,
      retentionValidated,
      queryValidated,
      regressionPassed,
      tscPassed,
      gitClean,
      traces: traces.map(t => ({
        timestamp: t.timestamp,
        event: t.metadata?.event || 'UNKNOWN',
        error: t.metadata?.error
      }))
    };

    const summaryMarkdown = `
# Final Release Gate Report: Mission ${missionId}

## Overview
- **Status:** ${executionStatus}
- **Clean Execution:** ${isCleanExecution ? 'Yes' : 'No'}
- **Quarantine Triggered:** ${containsQuarantine ? 'Yes (WARNING)' : 'No'}
- **Reconciliation Triggered:** ${reconciliationTriggered ? 'Yes' : 'No'}

## Compliance Checks
- Regression Tests: ${regressionPassed ? 'PASS' : 'FAIL'}
- TSC Types: ${tscPassed ? 'PASS' : 'FAIL'}
- Git Clean: ${gitClean ? 'PASS' : 'FAIL'}
- Benchmark: ${benchmarkPassed ? 'PASS' : 'FAIL'}
- Retention: ${retentionValidated ? 'PASS' : 'FAIL'}
- Query Auth: ${queryValidated ? 'PASS' : 'FAIL'}

## Overall Result
**${allPassed ? 'COMPLETE / PASS' : 'FAIL'}**

## Trace Summary
${traces.slice(-5).map(t => `- [${new Date(t.timestamp).toISOString()}] ${t.metadata?.event}`).join('\n')}
`.trim();

    return {
      ...reportObj,
      summaryMarkdown,
      canonicalJson: reportObj
    };
  }
}
