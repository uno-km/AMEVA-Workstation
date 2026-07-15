import { describe, it, expect } from 'vitest';
import { TypeScriptDiagnosticParser } from '../../workbench/ast/TypeScriptDiagnosticParser';

describe('Phase 6.2: Diagnostic Parser', () => {
  const parser = new TypeScriptDiagnosticParser();

  it('1. Parses structured tsc error', () => {
    const raw = `src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;
    const diagnostics = parser.parse(raw, 'typecheck', 'tsc');

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].file).toBe('src/index.ts');
    expect(diagnostics[0].line).toBe(10);
    expect(diagnostics[0].column).toBe(5);
    expect(diagnostics[0].severity).toBe('ERROR');
    expect(diagnostics[0].code).toBe('TS2322');
  });

  it('2. Emits unstructured diagnostic when parse fails', () => {
    const raw = `Unknown compilation error occurred without line numbers.`;
    const diagnostics = parser.parse(raw, 'typecheck', 'tsc');

    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe('UNSTRUCTURED');
    expect(diagnostics[0].severity).toBe('ERROR');
    expect(diagnostics[0].retryable).toBe(false);
  });
});
