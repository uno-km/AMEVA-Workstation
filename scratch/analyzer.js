import { Project, SyntaxKind, Node } from "ts-morph";
import fs from "fs";
import path from "path";

// Initialize project
const project = new Project({
  tsConfigFilePath: "./tsconfig.app.json",
});

const sourceFiles = project.getSourceFiles();

const results = {
  files: [],
  classes: [],
  functions: [],
  complexFunctions: [],
  godClasses: [],
  largeFiles: [],
  dependencies: {}
};

function calculateComplexity(node) {
  let complexity = 1;
  
  node.forEachDescendant(descendant => {
    switch (descendant.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.CatchClause:
      case SyntaxKind.ConditionalExpression: // ? :
        complexity++;
        break;
      case SyntaxKind.BinaryExpression:
        const operator = descendant.getOperatorToken().getText();
        if (operator === "&&" || operator === "||" || operator === "??") {
          complexity++;
        }
        break;
      case SyntaxKind.CaseClause:
        // switch cases
        complexity++;
        break;
    }
  });
  
  return complexity;
}

function getFunctionCalls(node) {
  const calls = [];
  const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const callExpr of callExpressions) {
    const expr = callExpr.getExpression();
    calls.push(expr.getText());
  }
  return [...new Set(calls)]; // Unique calls
}

sourceFiles.forEach(sourceFile => {
  const filePath = sourceFile.getFilePath();
  // ignore node_modules just in case
  if (filePath.includes("node_modules")) return;

  const fileLoc = sourceFile.getEndLineNumber();
  const fileName = path.relative(process.cwd(), filePath);
  
  // Track dependencies (imports)
  const imports = sourceFile.getImportDeclarations().map(imp => imp.getModuleSpecifierValue());
  results.dependencies[fileName] = imports;

  const fileInfo = {
    name: fileName,
    loc: fileLoc,
    classCount: 0,
    functionCount: 0
  };
  
  if (fileLoc > 300) {
    results.largeFiles.push(fileInfo);
  }
  results.files.push(fileInfo);

  // Analyze Classes
  const classes = sourceFile.getClasses();
  fileInfo.classCount = classes.length;
  
  classes.forEach(cls => {
    const className = cls.getName() || "AnonymousClass";
    const loc = cls.getEndLineNumber() - cls.getStartLineNumber() + 1;
    const methods = cls.getMethods();
    
    const classInfo = {
      file: fileName,
      name: className,
      loc: loc,
      methodCount: methods.length,
      propertiesCount: cls.getProperties().length
    };
    
    if (loc > 200 || methods.length > 15) {
      results.godClasses.push(classInfo);
    }
    
    results.classes.push(classInfo);
    
    // Analyze Methods
    methods.forEach(method => {
      const methodName = method.getName();
      const mLoc = method.getEndLineNumber() - method.getStartLineNumber() + 1;
      const mComp = calculateComplexity(method);
      const mCalls = getFunctionCalls(method);
      
      const funcInfo = {
        file: fileName,
        class: className,
        name: methodName,
        loc: mLoc,
        complexity: mComp,
        callsCount: mCalls.length,
        calls: mCalls
      };
      
      if (mComp > 15 || mLoc > 100) {
        results.complexFunctions.push(funcInfo);
      }
      results.functions.push(funcInfo);
    });
  });

  // Analyze standalone functions
  const functions = sourceFile.getFunctions();
  const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
  const functionExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression);
  
  // Also collect variable declarations that are arrow functions (common in React)
  const allFunctions = [...functions];
  
  // Helper to process any function-like node
  const processFunction = (funcNode, name) => {
    const loc = funcNode.getEndLineNumber() - funcNode.getStartLineNumber() + 1;
    const comp = calculateComplexity(funcNode);
    const calls = getFunctionCalls(funcNode);
    
    const funcInfo = {
      file: fileName,
      name: name,
      loc: loc,
      complexity: comp,
      callsCount: calls.length,
      calls: calls.slice(0, 10) // store up to 10 distinct calls to save space
    };
    
    if (comp > 15 || loc > 100) {
      results.complexFunctions.push(funcInfo);
    }
    results.functions.push(funcInfo);
  };

  functions.forEach(func => {
    processFunction(func, func.getName() || "AnonymousFunction");
  });
  
  // For arrow functions and function expressions, try to get the variable name if assigned
  const processAnonymousFunctions = (nodes, defaultName) => {
    nodes.forEach(func => {
      const parent = func.getParent();
      let name = defaultName;
      if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
        name = parent.getName();
      } else if (parent && parent.getKind() === SyntaxKind.PropertyAssignment) {
        name = parent.getName();
      }
      processFunction(func, name);
    });
  };
  
  processAnonymousFunctions(arrowFunctions, "ArrowFunction");
  processAnonymousFunctions(functionExpressions, "FunctionExpression");
  
  fileInfo.functionCount = functions.length + arrowFunctions.length + functionExpressions.length;
});

// Sort to find the biggest ones
results.files.sort((a, b) => b.loc - a.loc);
results.classes.sort((a, b) => b.loc - a.loc);
results.functions.sort((a, b) => b.complexity - a.complexity);
results.complexFunctions.sort((a, b) => b.complexity - a.complexity);

fs.writeFileSync("analysis_result.json", JSON.stringify({
  totalFiles: results.files.length,
  totalClasses: results.classes.length,
  totalFunctions: results.functions.length,
  top10LargeFiles: results.files.slice(0, 10),
  godClasses: results.godClasses,
  top20ComplexFunctions: results.complexFunctions.slice(0, 20),
}, null, 2));

console.log("Analysis complete. Saved to analysis_result.json");
