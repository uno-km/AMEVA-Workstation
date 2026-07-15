import { CodeDiagnostic } from '../domain/WorkbenchTypes';
import { ICodeDiagnosticParser } from './ICodeDiagnosticParser';

export class TypeScriptDiagnosticParser implements ICodeDiagnosticParser {
  public parse(rawOutput: string, checkType: string, tool: string): CodeDiagnostic[] {
    const diagnostics: CodeDiagnostic[] = [];
    
    // Example format: src/file.ts(10,15): error TS2322: Type 'string' is not assignable to type 'number'.
    const tsRegex = /^(.*?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.*)$/gm;
    let match;

    while ((match = tsRegex.exec(rawOutput)) !== null) {
      diagnostics.push({
        diagnosticId: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tool,
        checkType,
        severity: match[4].toUpperCase() as any,
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[5],
        message: match[6],
        normalizedMessage: `${match[5]}: ${match[6]}`,
        retryScope: 'FILE', // Conservative default
        retryable: true,
        rawOutputReference: match[0],
        diagnosticSignature: `${tool}:${checkType}:${match[5]}:${match[1]}:${match[2]}`
      });
    }

    if (diagnostics.length === 0 && rawOutput.trim().length > 0) {
      // Unstructured diagnostic
      diagnostics.push({
        diagnosticId: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tool,
        checkType,
        severity: 'ERROR',
        file: 'UNKNOWN',
        line: 0,
        column: 0,
        code: 'UNSTRUCTURED',
        message: 'Parser could not structure the error output.',
        normalizedMessage: 'Unstructured Diagnostic',
        retryScope: 'FILE',
        retryable: false,
        rawOutputReference: rawOutput,
        diagnosticSignature: `${tool}:${checkType}:UNSTRUCTURED`
      });
    }

    return diagnostics;
  }
}
