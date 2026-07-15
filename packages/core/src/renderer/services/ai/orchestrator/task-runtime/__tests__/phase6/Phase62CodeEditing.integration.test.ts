import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodeModificationService } from '../../workbench/execution/CodeModificationService';
import { TypeScriptProgramService } from '../../workbench/ast/TypeScriptProgramService';
import { TypeScriptSymbolResolver } from '../../workbench/ast/TypeScriptSymbolResolver';
import { TypeScriptASTModifier } from '../../workbench/ast/TypeScriptASTModifier';
import { IWorkbenchHostAdapter } from '../../workbench/adapter/IWorkbenchHostAdapter';

describe('Phase 6.2: Code Editing with AST Integration', () => {
  let mockAdapter: IWorkbenchHostAdapter;
  let service: CodeModificationService;
  const memoryFs = new Map<string, string>();

  beforeEach(() => {
    memoryFs.clear();
    mockAdapter = {
      fileSystem: {
        exists: vi.fn(async (p) => memoryFs.has(p)),
        read: vi.fn(async (p) => memoryFs.get(p) || null),
        write: vi.fn(async (p, c) => { memoryFs.set(p, c); }),
        remove: vi.fn(async (p) => { memoryFs.delete(p); }),
      } as any,
      commandExecutor: {} as any,
      capabilities: {} as any
    };

    const tsService = new TypeScriptProgramService(mockAdapter);
    const tsResolver = new TypeScriptSymbolResolver();
    const tsModifier = new TypeScriptASTModifier();

    service = new CodeModificationService(mockAdapter, tsService, tsResolver, tsModifier);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Modifies exactly the FUNCTION scope using AST', async () => {
    memoryFs.set('/iso/src/calc.ts', 'export function add(a: number, b: number) { return a + b; }\nexport function sub(a: number, b: number) { return a - b; }');

    const job = { isolatedWorkspace: '/iso' } as any;
    
    await service.applyModification(job, {
      changeId: 'c1',
      targetFile: 'src/calc.ts',
      targetSymbol: 'add',
      scope: 'FUNCTION',
      changeType: 'UPDATE',
      content: 'export function add(a: number, b: number) { return a + b + 1; }',
      rationale: '', expectedBehavior: '', sourceRevision: '', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
    });

    const modified = memoryFs.get('/iso/src/calc.ts');
    expect(modified).toContain('export function add(a: number, b: number) { return a + b + 1; }');
    expect(modified).toContain('export function sub(a: number, b: number) { return a - b; }');
  });

  it('2. Throws AMBIGUOUS_CODE_TARGET if multiple symbols match', async () => {
    // Example: Overloads or same name in different inner scopes (simplified)
    memoryFs.set('/iso/src/calc.ts', 'function calc() { function inner() {} }\nfunction inner() {}');

    const job = { isolatedWorkspace: '/iso' } as any;

    await expect(
      service.applyModification(job, {
        changeId: 'c2',
        targetFile: 'src/calc.ts',
        targetSymbol: 'inner',
        scope: 'FUNCTION',
        changeType: 'UPDATE',
        content: 'function inner() { return 1; }',
        rationale: '', expectedBehavior: '', sourceRevision: '', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
      })
    ).rejects.toThrow('AMBIGUOUS_CODE_TARGET');
  });

  it('3. Throws PARSER_UNAVAILABLE for non-JS/TS scoped modification', async () => {
    const job = { isolatedWorkspace: '/iso' } as any;
    await expect(
      service.applyModification(job, {
        changeId: 'c3',
        targetFile: 'src/config.json',
        targetSymbol: 'prop',
        scope: 'FIELD',
        changeType: 'UPDATE',
        content: '1',
        rationale: '', expectedBehavior: '', sourceRevision: '', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
      })
    ).rejects.toThrow('PARSER_UNAVAILABLE');
  });
});
