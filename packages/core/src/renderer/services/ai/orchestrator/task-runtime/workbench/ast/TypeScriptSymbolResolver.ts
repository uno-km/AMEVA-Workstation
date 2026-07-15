import { CodeModificationScope } from '../domain/WorkbenchTypes';

export interface ResolvedSymbol {
  name: string;
  scope: CodeModificationScope;
  start: number; // character position
  end: number;
  startLine: number;
  endLine: number;
  node: any; // ts.Node
}

export class TypeScriptSymbolResolver {
  public async findSymbol(
    sourceFile: any, // ts.SourceFile
    targetSymbol: string,
    expectedScope: CodeModificationScope
  ): Promise<ResolvedSymbol[]> {
    const ts = await import('typescript');
    const matches: ResolvedSymbol[] = [];

    const visit = (node: any) => {
      // Check if node matches symbol name and scope
      let name = '';
      let isMatch = false;

      if (expectedScope === 'FUNCTION' && ts.isFunctionDeclaration(node)) {
        name = node.name?.getText() || '';
        if (name === targetSymbol) isMatch = true;
      } else if (expectedScope === 'CLASS' && ts.isClassDeclaration(node)) {
        name = node.name?.getText() || '';
        if (name === targetSymbol) isMatch = true;
      } else if (expectedScope === 'METHOD' && ts.isMethodDeclaration(node)) {
        name = node.name?.getText() || '';
        if (name === targetSymbol) isMatch = true;
      } else if (expectedScope === 'IMPORT' && ts.isImportDeclaration(node)) {
        // Match import clauses
        const clause = node.importClause?.getText() || '';
        if (clause.includes(targetSymbol) || node.moduleSpecifier.getText().includes(targetSymbol)) {
          isMatch = true;
          name = targetSymbol;
        }
      }

      if (isMatch) {
        const start = node.getStart(sourceFile);
        const end = node.getEnd();
        const startPos = sourceFile.getLineAndCharacterOfPosition(start);
        const endPos = sourceFile.getLineAndCharacterOfPosition(end);

        matches.push({
          name,
          scope: expectedScope,
          start,
          end,
          startLine: startPos.line + 1,
          endLine: endPos.line + 1,
          node
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return matches;
  }
}
