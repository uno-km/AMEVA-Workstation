import { CheckResult, CodeDiagnostic } from '../domain/WorkbenchTypes';
import { IDiagnosticParser, GenericCommandDiagnosticParser } from './GenericCommandDiagnosticParser';
import { TypeScriptDiagnosticParser } from './TypeScriptDiagnosticParser';
import { ESLintDiagnosticParser } from './ESLintDiagnosticParser';
import { VitestDiagnosticParser } from './VitestDiagnosticParser';
import { BuildDiagnosticParser } from './BuildDiagnosticParser';

export class DiagnosticParserRegistry {
  private parsers: IDiagnosticParser[] = [
    new TypeScriptDiagnosticParser(),
    new ESLintDiagnosticParser(),
    new VitestDiagnosticParser(),
    new BuildDiagnosticParser(),
    new GenericCommandDiagnosticParser() // Fallback
  ];

  public parseResult(result: CheckResult): CodeDiagnostic[] {
    for (const parser of this.parsers) {
      if (parser.canParse(result)) {
        const diagnostics = parser.parse(result);
        if (diagnostics.length > 0 || parser instanceof GenericCommandDiagnosticParser) {
          return diagnostics;
        }
      }
    }
    return [];
  }
}
