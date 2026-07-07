import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

const project = new Project({
  tsConfigFilePath: "./tsconfig.app.json",
});

const targetFiles = [
  "src/renderer/App.tsx",
  "src/renderer/hooks/useAIAgent.ts",
  "src/renderer/components/AIPanel.tsx"
];

const results = {};

targetFiles.forEach(file => {
  const sourceFile = project.getSourceFile(file);
  if (!sourceFile) return;
  
  const fileName = path.relative(process.cwd(), sourceFile.getFilePath());
  results[fileName] = {
    functions: [],
    callGraph: {}
  };
  
  const processFunction = (funcNode, name) => {
    const loc = funcNode.getEndLineNumber() - funcNode.getStartLineNumber() + 1;
    
    // find calls inside this function
    const calls = [];
    funcNode.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
      calls.push(callExpr.getExpression().getText());
    });
    
    // Count frequencies of each call
    const callFreq = {};
    calls.forEach(c => {
      callFreq[c] = (callFreq[c] || 0) + 1;
    });
    
    // Top 5 calls
    const sortedCalls = Object.entries(callFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => `${x[0]} (x${x[1]})`);
    
    // If it's a very large function, we want to know what it contains
    if (loc > 100) {
      results[fileName].functions.push({
        name,
        loc,
        topCalls: sortedCalls
      });
      
      results[fileName].callGraph[name] = sortedCalls;
    }
  };

  sourceFile.getFunctions().forEach(f => processFunction(f, f.getName() || "AnonymousFunction"));
  
  // Try to find large arrow functions
  sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(vd => {
    const init = vd.getInitializer();
    if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
      processFunction(init, vd.getName());
    }
  });
  
});

fs.writeFileSync("deep_analysis_result.json", JSON.stringify(results, null, 2));
console.log("Deep analysis complete");
