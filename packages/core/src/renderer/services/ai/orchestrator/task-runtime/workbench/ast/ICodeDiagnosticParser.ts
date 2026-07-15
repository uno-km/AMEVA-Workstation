import { CodeDiagnostic } from '../domain/WorkbenchTypes';

export interface ICodeDiagnosticParser {
  parse(rawOutput: string, checkType: string, tool: string): CodeDiagnostic[];
}
