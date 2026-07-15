import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { IDiagnosticParser } from './GenericCommandDiagnosticParser';

export class BuildDiagnosticParser implements IDiagnosticParser {
  public canParse(result: CheckResult): boolean {
    return result.checkType === 'build' || result.commandPlan.executable.includes('vite') || result.commandPlan.executable.includes('esbuild');
  }

  public parse(result: CheckResult): CodeDiagnostic[] {
    const diagnostics: CodeDiagnostic[] = [];
    const output = result.stdoutSummary || result.stderrSummary;
    
    // Simplistic Vite/Rollup parser
    const viteErrorRegex = /\[vite\]:(.+)/g;
    let match;
    while ((match = viteErrorRegex.exec(output)) !== null) {
      diagnostics.push({
        diagnosticId: `build-${Date.now()}-${diagnostics.length}`,
        parserType: 'BuildDiagnosticParser',
        tool: 'vite',
        checkId: result.checkId,
        checkType: result.checkType,
        severity: 'ERROR',
        file: 'unknown',
        message: match[1].trim(),
        normalizedMessage: match[1].trim(),
        retryScope: 'FILE',
        retryable: true,
        confidence: 0.7,
        rawOutputReference: match[0],
        signature: `BuildDiagnosticParser|vite|${result.checkType}|${match[1].trim()}`
      });
    }

    return diagnostics;
  }
}
