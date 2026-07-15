import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { IDiagnosticParser } from './GenericCommandDiagnosticParser';

export class ESLintDiagnosticParser implements IDiagnosticParser {
  public canParse(result: CheckResult): boolean {
    return result.checkType === 'lint' || result.commandPlan.executable.includes('eslint');
  }

  public parse(result: CheckResult): CodeDiagnostic[] {
    const diagnostics: CodeDiagnostic[] = [];
    const output = result.stdoutSummary || result.stderrSummary;
    
    try {
      // Assuming eslint --format json was used
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        for (const fileResult of parsed) {
          const file = fileResult.filePath;
          for (const msg of fileResult.messages) {
            diagnostics.push({
              diagnosticId: `eslint-${Date.now()}-${diagnostics.length}`,
              parserType: 'ESLintDiagnosticParser',
              tool: 'eslint',
              checkId: result.checkId,
              checkType: result.checkType,
              severity: msg.severity === 2 ? 'ERROR' : 'WARNING',
              file,
              logicalFile: file,
              line: msg.line,
              column: msg.column,
              code: msg.ruleId,
              message: msg.message,
              normalizedMessage: msg.message,
              retryScope: 'FILE',
              retryable: msg.fixable || false,
              confidence: 0.9,
              rawOutputReference: JSON.stringify(msg),
              signature: `ESLintDiagnosticParser|eslint|${result.checkType}|${msg.ruleId}|${file}|${msg.line}`
            });
          }
        }
      }
    } catch (e) {
      // Fallback if not JSON
    }

    return diagnostics;
  }
}
