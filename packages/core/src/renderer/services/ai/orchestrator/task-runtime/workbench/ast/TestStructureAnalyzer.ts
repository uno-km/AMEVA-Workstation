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
      swallowedErrors: 0
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

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return structure;
  }

  private analyzeCallExpression(node: ts.CallExpression, sourceFile: ts.SourceFile, structure: TestStructure, importAliases: Map<string, string>) {
    let expressionName = '';
    let modifier = '';

    if (ts.isIdentifier(node.expression)) {
      expressionName = node.expression.text;
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      if (ts.isIdentifier(node.expression.name)) {
        modifier = node.expression.name.text;
      }
      if (ts.isIdentifier(node.expression.expression)) {
        expressionName = node.expression.expression.text;
      } else if (ts.isPropertyAccessExpression(node.expression.expression) && ts.isIdentifier(node.expression.expression.name)) {
        expressionName = node.expression.expression.name.text;
      }
    }

    const resolvedName = importAliases.get(expressionName) || expressionName;
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    // Detect assertions
    if (resolvedName === 'expect' || resolvedName === 'assert' || resolvedName.includes('Assert')) {
      structure.assertions.push({ matcher: modifier || 'unknown', line });
    } else if (ts.isPropertyAccessExpression(node.expression) && (resolvedName === 'resolves' || resolvedName === 'rejects' || resolvedName === 'toThrow' || resolvedName === 'throws')) {
       structure.assertions.push({ matcher: resolvedName, line });
    }

    // Detect test blocks
    let nameArg = 'unknown';
    if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      nameArg = (node.arguments[0] as ts.StringLiteral).text;
    }

    if (this.suiteIdentifiers.includes(resolvedName)) {
      structure.suites.push({ name: nameArg, type: 'SUITE', framework: 'detected', line });
      if (this.modifierIdentifiers.includes(modifier)) structure.modifiers.push(modifier);
    } else if (this.testIdentifiers.includes(resolvedName)) {
      structure.tests.push({ name: nameArg, type: 'TEST', framework: 'detected', line });
      if (this.modifierIdentifiers.includes(modifier)) structure.modifiers.push(modifier);
    } else if (this.hookIdentifiers.includes(resolvedName)) {
      structure.hooks.push({ name: resolvedName, type: 'HOOK', framework: 'detected', line });
    }
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
            // Returning inside catch often means swallowed if returning true or expected value
            structure.swallowedErrors++;
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
