import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { SecretRedactor } from '../../../trace/SecretRedactor';

export interface IDiagnosticParser {
  parse(result: CheckResult): CodeDiagnostic[];
  canParse(result: CheckResult): boolean;
}

export class GenericCommandDiagnosticParser implements IDiagnosticParser {
  public canParse(result: CheckResult): boolean {
    return true; // Fallback
  }

  public parse(result: CheckResult): CodeDiagnostic[] {
    const safeStdout = SecretRedactor.redactString(result.stdoutSummary);
    const safeStderr = SecretRedactor.redactString(result.stderrSummary);
    
    // Only return UNSTRUCTURED if it failed
    if (result.status === 'FAIL') {
      return [{
        diagnosticId: `gen-${Date.now()}`,
        parserType: 'GenericCommandDiagnosticParser',
        tool: result.checkType,
        checkId: result.checkId,
        checkType: result.checkType,
        severity: 'ERROR',
        file: 'unknown',
        message: 'Command failed with exit code ' + result.exitCode,
        normalizedMessage: 'Command execution failed without structured output.',
        retryScope: 'FILE', // Generic usually requires file or broader scope
        retryable: true,
        confidence: 0.1,
        rawOutputReference: safeStderr || safeStdout,
        signature: `Generic|${result.checkType}|${result.exitCode}`
      }];
    }
    return [];
  }
}
