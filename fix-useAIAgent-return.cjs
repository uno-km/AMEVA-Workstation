const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project();
const targetPath = path.join(__dirname, 'src', 'renderer', 'hooks', 'useAIAgent.ts');
const sourceFile = project.addSourceFileAtPath(targetPath);

const useAIFunc = sourceFile.getFunction('useAIAgent');
if (!useAIFunc) throw new Error("useAIAgent not found");

// The return statement is at the bottom.
const returnStmt = useAIFunc.getStatements().find(s => s.getKind() === SyntaxKind.ReturnStatement);
if (returnStmt) {
  const objLiteral = returnStmt.getExpression();
  if (objLiteral && objLiteral.getKind() === SyntaxKind.ObjectLiteralExpression) {
    const props = objLiteral.getProperties();
    const toRemove = ['refreshModels', 'importModel', 'startEngine', 'stopEngine', 'checkIsAvailable'];
    const nodesToRemove = props.filter(p => {
      if (p.getKind() === SyntaxKind.ShorthandPropertyAssignment || p.getKind() === SyntaxKind.PropertyAssignment) {
        return toRemove.includes(p.getName());
      }
      return false;
    });
    nodesToRemove.forEach(p => p.remove());
    console.log("Removed old return values.");
  }
}

// Remove useLocalAIEngine call if exists
const localAIEngineCall = useAIFunc.getVariableStatement(stmt => {
  return stmt.getText().includes('useLocalAIEngine');
});
if (localAIEngineCall) {
  localAIEngineCall.remove();
  console.log("Removed useLocalAIEngine call from useAIAgent");
}

// Remove useLocalAIEngine import if exists
const localAIEngineImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === './useLocalAIEngine');
if (localAIEngineImport) {
  localAIEngineImport.remove();
  console.log("Removed useLocalAIEngine import from useAIAgent");
}

project.saveSync();
console.log("Done fixing useAIAgent.ts");
