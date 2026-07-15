import { ResolvedSymbol } from './TypeScriptSymbolResolver';
import { CodeModification } from '../domain/WorkbenchTypes';

export class TypeScriptASTModifier {
  public applyModification(
    originalContent: string,
    target: ResolvedSymbol,
    modification: CodeModification
  ): string {
    if (modification.changeType === 'UPDATE' && modification.content) {
      // Replace the exact bounds of the AST node
      const prefix = originalContent.slice(0, target.start);
      const suffix = originalContent.slice(target.end);
      return prefix + modification.content + suffix;
    } else if (modification.changeType === 'DELETE') {
      const prefix = originalContent.slice(0, target.start);
      const suffix = originalContent.slice(target.end);
      return prefix + suffix;
    }

    return originalContent;
  }
}
