import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { IDiagnosticParser } from './GenericCommandDiagnosticParser';

export class TypeScriptDiagnosticParser implements IDiagnosticParser {
  public canParse(result: CheckResult): boolean {
    return result.checkType === 'type-check' || result.commandPlan.executable.includes('tsc');
  }

  public parse(result: CheckResult): CodeDiagnostic[] {
    const diagnostics: CodeDiagnostic[] = [];
    const tscRegex = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/gm;
    let match;

    while ((match = tscRegex.exec(result.stdoutSummary || result.stderrSummary)) !== null) {
      const file = match[1].trim();
      const line = parseInt(match[2], 10);
      const column = parseInt(match[3], 10);
      const severity = match[4].toUpperCase() as 'ERROR' | 'WARNING';
      const code = match[5];
      const message = match[6].trim();

      const normalized = message.replace(/'[^']+'/g, "'...'").replace(/"[^"]+"/g, '"..."');

      diagnostics.push({
        diagnosticId: `ts-${Date.now()}-${diagnostics.length}`,
        parserType: 'TypeScriptDiagnosticParser',
        tool: 'tsc',
        checkId: result.checkId,
        checkType: result.checkType,
        severity,
        file,
        logicalFile: file,
        line,
        column,
        code,
        message,
        normalizedMessage: normalized,
        retryScope: 'FILE',
        retryable: true,
        confidence: 0.9,
        rawOutputReference: match[0],
        signature: `TypeScriptDiagnosticParser|tsc|${result.checkType}|${code}|${file}|${line}`
      });
    }

    return diagnostics;
  }
}
