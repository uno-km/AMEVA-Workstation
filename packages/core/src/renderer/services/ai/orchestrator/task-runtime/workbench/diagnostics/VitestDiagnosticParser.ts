import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { IDiagnosticParser } from './GenericCommandDiagnosticParser';

export class VitestDiagnosticParser implements IDiagnosticParser {
  public canParse(result: CheckResult): boolean {
    return result.checkType === 'unit-test' || result.checkType === 'integration-test' || result.commandPlan.executable.includes('vitest');
  }

  public parse(result: CheckResult): CodeDiagnostic[] {
    const diagnostics: CodeDiagnostic[] = [];
    const output = result.stdoutSummary || result.stderrSummary;
    
    // Very simplified Vitest output parser for demonstration
    // Real implementation would parse JSON output or use robust regex
    const failRegex = /FAIL\s+(.+)$/gm;
    let match;

    while ((match = failRegex.exec(output)) !== null) {
      const file = match[1].trim();

      diagnostics.push({
        diagnosticId: `vitest-${Date.now()}-${diagnostics.length}`,
        parserType: 'VitestDiagnosticParser',
        tool: 'vitest',
        checkId: result.checkId,
        checkType: result.checkType,
        severity: 'ERROR',
        file,
        logicalFile: file,
        message: 'Test failed in ' + file,
        normalizedMessage: 'Test failed',
        retryScope: 'TEST',
        retryable: true,
        confidence: 0.8,
        rawOutputReference: match[0],
        signature: `VitestDiagnosticParser|vitest|${result.checkType}|test_failure|${file}`
      });
    }

    return diagnostics;
  }
}
