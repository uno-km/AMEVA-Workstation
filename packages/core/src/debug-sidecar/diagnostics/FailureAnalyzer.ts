/**
 * @file debug-sidecar/diagnostics/FailureAnalyzer.ts
 * @system AMEVA OS Desktop Workstation
 */

import { UnifiedEventEnvelope } from '../observability/UnifiedEventEnvelope';

export class FailureAnalyzer {
  public static analyze(events: UnifiedEventEnvelope[]) {
    const errors = events.filter(e => e.level === 'ERROR');
    const firstFailure = errors.length > 0 ? errors[0] : null;

    const report = [
      '# Diagnostics Report',
      '',
      `Total Events: ${events.length}`,
      `Total Errors: ${errors.length}`,
      '',
      '## First Observed Failure',
      firstFailure ? `- Timestamp: ${firstFailure.timestamp}\n- Component: ${firstFailure.component}\n- Code: ${firstFailure.failure_code}\n- Message: ${firstFailure.message}` : 'None detected.',
      '',
      '## Inferences',
      firstFailure?.failure_code === 'STREAM_ERR' ? '- LLM backend may be unavailable or disconnected.' : '- N/A',
      '',
      '## Recommended Actions',
      firstFailure ? `- Check logs around sequence ${firstFailure.sequence} for task ${firstFailure.task_id || 'unknown'}` : '- No action required.'
    ];

    return report.join('\n');
  }
}
