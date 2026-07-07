const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'renderer', 'hooks', 'useAI.ts');
const project = new Project();
project.addSourceFileAtPath(targetPath);
const sourceFile = project.getSourceFileOrThrow(targetPath);

// 1. Add import for useLocalAIEngine
sourceFile.addImportDeclaration({
  namedImports: ["useLocalAIEngine"],
  moduleSpecifier: "./useLocalAIEngine"
});

const hookFunc = sourceFile.getFunction('useAI');
if (!hookFunc) throw new Error("useAI function not found");

// Find specific variables/functions and remove them
const toRemove = [
  'loadModels',
  'checkIsAvailable',
  'importModel',
  'startEngine',
  'stopEngine'
];

let removedCount = 0;
hookFunc.getVariableStatements().forEach(stmt => {
  const decs = stmt.getDeclarations();
  if (decs.length > 0) {
    const name = decs[0].getName();
    if (toRemove.includes(name)) {
      stmt.remove();
      removedCount++;
      console.log(`Removed ${name}`);
    }
  }
});

if (removedCount > 0) {
  // Inject the hook call at the top of the useAI function
  // Find a good place to inject: after the stores are called.
  // Actually, we can just insert it as the first statement, or after useAIState.
  hookFunc.insertStatements(5, `  const { loadModels, checkIsAvailable, importModel, startEngine, stopEngine } = useLocalAIEngine();`);
  console.log("Injected useLocalAIEngine hook call.");
}

project.saveSync();
console.log("AST transformation successful.");
