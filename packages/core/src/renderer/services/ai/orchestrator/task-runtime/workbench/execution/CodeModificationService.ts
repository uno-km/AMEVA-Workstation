import { CodeWorkbenchJob, CodeChangePlan, CodeModification } from '../domain/WorkbenchTypes';
import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { TypeScriptProgramService } from '../ast/TypeScriptProgramService';
import { TypeScriptSymbolResolver } from '../ast/TypeScriptSymbolResolver';
import { TypeScriptASTModifier } from '../ast/TypeScriptASTModifier';

export class CodeModificationService {
  constructor(
    private hostAdapter: IWorkbenchHostAdapter,
    private tsProgramService: TypeScriptProgramService,
    private tsSymbolResolver: TypeScriptSymbolResolver,
    private tsAstModifier: TypeScriptASTModifier
  ) {}

  public async applyPlan(job: CodeWorkbenchJob, plan: CodeChangePlan): Promise<void> {
    for (const mod of plan.plannedChanges) {
      await this.applyModification(job, mod);
    }
  }

  public async applyModification(job: CodeWorkbenchJob, mod: CodeModification): Promise<void> {
    const targetPath = `${job.isolatedWorkspace}/${mod.targetFile}`.replace(/\/\//g, '/');

    // For non-JS/TS files or FILE level scopes, fallback to full replacement if allowed
    if (mod.scope === 'FILE') {
      if (mod.changeType === 'CREATE' || mod.changeType === 'UPDATE') {
        if (mod.content !== undefined) {
          await this.hostAdapter.fileSystem.write(targetPath, mod.content);
        }
      } else if (mod.changeType === 'DELETE') {
        if (await this.hostAdapter.fileSystem.exists(targetPath)) {
          await this.hostAdapter.fileSystem.remove(targetPath);
        }
      }
      return;
    }

    // For specific scopes (FUNCTION, CLASS, etc.), we need AST parsing
    if (!targetPath.endsWith('.ts') && !targetPath.endsWith('.js') && !targetPath.endsWith('.tsx') && !targetPath.endsWith('.jsx')) {
      throw new Error(`PARSER_UNAVAILABLE: Cannot apply AST modification to non-TS/JS file ${targetPath}.`);
    }

    if (!mod.targetSymbol) {
      throw new Error(`TARGET_NOT_FOUND: No target symbol provided for scope ${mod.scope}`);
    }

    const sourceFile = await this.tsProgramService.createSourceFile(targetPath);
    const resolvedSymbols = await this.tsSymbolResolver.findSymbol(sourceFile, mod.targetSymbol, mod.scope);

    if (resolvedSymbols.length === 0) {
      throw new Error(`TARGET_NOT_FOUND: Symbol '${mod.targetSymbol}' not found in ${targetPath}`);
    }

    if (resolvedSymbols.length > 1) {
      throw new Error(`AMBIGUOUS_CODE_TARGET: Found ${resolvedSymbols.length} instances of '${mod.targetSymbol}' in ${targetPath}`);
    }

    const target = resolvedSymbols[0];
    const originalContent = sourceFile.text;
    const newContent = this.tsAstModifier.applyModification(originalContent, target, mod);

    await this.hostAdapter.fileSystem.write(targetPath, newContent);

    // POST-PATCH VERIFICATION
    const newSourceFile = await this.tsProgramService.createSourceFile(targetPath);
    
    // Check syntax errors
    const context = await this.tsProgramService.createProgram(job.isolatedWorkspace, [targetPath]);
    const diagnostics = context.program.getSyntacticDiagnostics(newSourceFile);
    if (diagnostics.length > 0) {
        await this.hostAdapter.fileSystem.write(targetPath, originalContent); // Rollback
        throw new Error(`SYNTAX_ERROR: Patch caused syntax errors in ${targetPath}`);
    }

    const reResolvedSymbols = await this.tsSymbolResolver.findSymbol(newSourceFile, mod.targetSymbol, mod.scope);
    if (reResolvedSymbols.length === 0) {
        await this.hostAdapter.fileSystem.write(targetPath, originalContent); // Rollback
        throw new Error(`TARGET_NOT_FOUND: Patch destroyed the target symbol '${mod.targetSymbol}' in ${targetPath}`);
    }

    if (reResolvedSymbols.length > 1) {
        await this.hostAdapter.fileSystem.write(targetPath, originalContent); // Rollback
        throw new Error(`AMBIGUOUS_CODE_TARGET: Patch caused multiple instances of '${mod.targetSymbol}' in ${targetPath}`);
    }

    // Ranges check could go here if `CodeModification` specifies them explicitly.
    // Assuming pass for now if we reach here
  }
}
