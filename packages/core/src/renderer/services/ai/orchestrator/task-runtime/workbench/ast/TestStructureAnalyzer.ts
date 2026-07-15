import ts from 'typescript';
import { TypeScriptProgramService } from './TypeScriptProgramService';

export interface TestBlockInfo {
  name: string;
  type: 'SUITE' | 'TEST' | 'HOOK';
  framework: string;
  line: number;
}

export interface AssertionInfo {
  matcher: string;
  line: number;
}

export interface TestStructure {
  testFile: string;
  suites: TestBlockInfo[];
  tests: TestBlockInfo[];
  hooks: TestBlockInfo[];
  assertions: AssertionInfo[];
  modifiers: string[]; // e.g., 'skip', 'todo', 'only', 'concurrent'
  swallowedErrors: number;
  unreachableAssertions: number;
  missingAwait: number;
  promisesCatchReturningTrue: number;
}

export class TestStructureAnalyzer {
  private suiteIdentifiers = ['describe', 'suite', 'context'];
  private testIdentifiers = ['it', 'test', 'specify'];
  private hookIdentifiers = ['beforeAll', 'beforeEach', 'afterAll', 'afterEach'];
  private modifierIdentifiers = ['skip', 'todo', 'only', 'concurrent', 'each', 'fails'];

  constructor(private programService: TypeScriptProgramService) {}

  public async analyzeFile(filePath: string): Promise<TestStructure | null> {
    const sourceFile = await this.programService.createSourceFile(filePath);
    if (!sourceFile) return null;

    const structure: TestStructure = {
      testFile: filePath,
      suites: [],
      tests: [],
      hooks: [],
      assertions: [],
      modifiers: [],
      swallowedErrors: 0,
      unreachableAssertions: 0,
      missingAwait: 0,
      promisesCatchReturningTrue: 0
    };

    const importAliases = new Map<string, string>();

    const visit = (node: ts.Node) => {
      // Collect import aliases
      if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.propertyName) {
              importAliases.set(element.name.text, element.propertyName.text);
            } else {
              importAliases.set(element.name.text, element.name.text);
            }
          }
        }
      }

      if (ts.isCallExpression(node)) {
        this.analyzeCallExpression(node, sourceFile, structure, importAliases);
      }

      if (ts.isCatchClause(node)) {
        this.analyzeCatchClause(node, structure);
      }

      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
        this.analyzeControlFlow(node, sourceFile, structure, importAliases);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return structure;
  }

  private analyzeCallExpression(node: ts.CallExpression, sourceFile: ts.SourceFile, structure: TestStructure, importAliases: Map<string, string>) {
    let expressionName = '';
    let modifier = '';
    let isEach = false;
    
    let baseExpr = node.expression;

    // Handle test.each()(...) or test.each`...`(...)
    if (ts.isCallExpression(baseExpr) || ts.isTaggedTemplateExpression(baseExpr)) {
        baseExpr = baseExpr.expression;
        isEach = true;
    }

    if (ts.isIdentifier(baseExpr)) {
      expressionName = baseExpr.text;
    } else if (ts.isPropertyAccessExpression(baseExpr)) {
      if (ts.isIdentifier(baseExpr.name)) {
        modifier = baseExpr.name.text;
      }
      if (ts.isIdentifier(baseExpr.expression)) {
        expressionName = baseExpr.expression.text;
      } else if (ts.isPropertyAccessExpression(baseExpr.expression) && ts.isIdentifier(baseExpr.expression.name)) {
        expressionName = baseExpr.expression.name.text;
      }
    }

    const resolvedName = importAliases.get(expressionName) || expressionName;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    // Detect assertions (expect, assert)
    if (resolvedName === 'expect' || resolvedName === 'assert' || resolvedName.includes('Assert')) {
      let matcher = modifier || 'unknown';
      let rejectsResolves = '';
      if (ts.isPropertyAccessExpression(baseExpr) && ts.isPropertyAccessExpression(baseExpr.expression)) {
        if (ts.isIdentifier(baseExpr.expression.name)) {
            rejectsResolves = baseExpr.expression.name.text;
            if (rejectsResolves === 'rejects' || rejectsResolves === 'resolves') {
                matcher = `${rejectsResolves}.${matcher}`;
            }
        }
      }
      structure.assertions.push({ matcher, line });
    } else if (ts.isPropertyAccessExpression(baseExpr) && (resolvedName === 'resolves' || resolvedName === 'rejects' || resolvedName === 'toThrow' || resolvedName === 'throws')) {
       structure.assertions.push({ matcher: resolvedName, line });
    }

    // Detect test blocks
    let nameArg = 'unknown';
    if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      nameArg = (node.arguments[0] as ts.StringLiteral).text;
    } else if (node.arguments.length > 0 && ts.isTemplateExpression(node.arguments[0])) {
      nameArg = 'template string';
    }

    if (this.suiteIdentifiers.includes(resolvedName)) {
      structure.suites.push({ name: nameArg, type: 'SUITE', framework: 'detected', line });
      if (this.modifierIdentifiers.includes(modifier)) structure.modifiers.push(modifier);
      if (isEach) structure.modifiers.push('each');
    } else if (this.testIdentifiers.includes(resolvedName)) {
      structure.tests.push({ name: nameArg, type: 'TEST', framework: 'detected', line });
      if (this.modifierIdentifiers.includes(modifier)) structure.modifiers.push(modifier);
      if (isEach) structure.modifiers.push('each');
    } else if (this.hookIdentifiers.includes(resolvedName)) {
      structure.hooks.push({ name: resolvedName, type: 'HOOK', framework: 'detected', line });
    }
  }

  private analyzeControlFlow(node: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration, sourceFile: ts.SourceFile, structure: TestStructure, importAliases: Map<string, string>) {
     if (!node.body || !ts.isBlock(node.body)) return;
     
     let unreachable = false;
     
     const visitBlock = (n: ts.Node) => {
         if (ts.isReturnStatement(n)) unreachable = true;
         
         if (ts.isIfStatement(n)) {
             if (n.expression.kind === ts.SyntaxKind.FalseKeyword) {
                // If we find assertions in if(false), they are unreachable
                const assertionCountBefore = structure.assertions.length;
                this.visitForAssertionsOnly(n.thenStatement, sourceFile, structure, importAliases);
                structure.unreachableAssertions += (structure.assertions.length - assertionCountBefore);
             }
         }

         if (unreachable && ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
             const assertionCountBefore = structure.assertions.length;
             this.visitForAssertionsOnly(n, sourceFile, structure, importAliases);
             structure.unreachableAssertions += (structure.assertions.length - assertionCountBefore);
         }
         
         if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
            // Check for missing await on async calls or expects
            const text = n.expression.getText(sourceFile);
            if (text.includes('expect(') && (text.includes('.resolves') || text.includes('.rejects'))) {
                structure.missingAwait++;
            }
         }
         
         ts.forEachChild(n, visitBlock);
     };
     visitBlock(node.body);
  }
  
  private visitForAssertionsOnly(node: ts.Node, sourceFile: ts.SourceFile, structure: TestStructure, importAliases: Map<string, string>) {
      if (ts.isCallExpression(node)) {
          this.analyzeCallExpression(node, sourceFile, structure, importAliases);
      }
      ts.forEachChild(node, n => this.visitForAssertionsOnly(n, sourceFile, structure, importAliases));
  }

  private analyzeCatchClause(node: ts.CatchClause, structure: TestStructure) {
    if (!node.block || node.block.statements.length === 0) {
      structure.swallowedErrors++;
    } else {
      let containsThrowOrReject = false;
      const visitBlock = (n: ts.Node) => {
        if (ts.isThrowStatement(n)) containsThrowOrReject = true;
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
            const text = n.expression.text;
            if (text === 'reject' || text.includes('throw')) containsThrowOrReject = true;
        }
        if (ts.isReturnStatement(n)) {
            if (n.expression && n.expression.kind === ts.SyntaxKind.TrueKeyword) {
                structure.promisesCatchReturningTrue++;
            }
        }
        ts.forEachChild(n, visitBlock);
      };
      visitBlock(node.block);

      if (!containsThrowOrReject && node.block.statements.length > 0 && !node.block.statements.some(s => ts.isReturnStatement(s))) {
         structure.swallowedErrors++;
      }
    }
  }
}
