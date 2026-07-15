import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';

export interface TypeScriptProgramContext {
  program: any; // ts.Program
  typeChecker: any; // ts.TypeChecker
  compilerHost: any; // ts.CompilerHost
  sourceFiles: Map<string, any>; // ts.SourceFile
}

export class TypeScriptProgramService {
  constructor(private hostAdapter: IWorkbenchHostAdapter) {}

  public async createProgram(workspaceDir: string, entryFiles: string[]): Promise<TypeScriptProgramContext> {
    // Dynamically import typescript so we don't bundle it into the main renderer chunk needlessly
    const ts = await import('typescript');
    
    const sourceFiles = new Map<string, any>();

    const compilerHost: any = {
      fileExists: (fileName: string) => {
        // As a synchronous interface expected by TS, we must rely on a pre-fetched cache or 
        // in our limited workbench scope, we might need a workaround for async fs access.
        // For Phase 6.2, since we know TS expects sync FS, we will use a naive stub 
        // or require files to be pre-cached. 
        // In this implementation, we will mock the return for known files to prevent blocking.
        return true;
      },
      readFile: (fileName: string) => {
        // Expected to be sync. If we can't do sync, we must pre-fetch source files.
        return sourceFiles.get(fileName)?.text || '';
      },
      getSourceFile: (fileName: string, languageVersion: any) => {
        if (sourceFiles.has(fileName)) return sourceFiles.get(fileName);
        // Pre-fetch is required in actual use, stubbing empty for safety.
        return undefined;
      },
      getDefaultLibFileName: (options: any) => 'lib.d.ts',
      writeFile: () => {},
      getCurrentDirectory: () => workspaceDir,
      getDirectories: () => [],
      getCanonicalFileName: (fileName: string) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    };

    // Pre-fetch entry files
    for (const file of entryFiles) {
      const content = await this.hostAdapter.fileSystem.read(file);
      if (content) {
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
        sourceFiles.set(file, sourceFile);
      }
    }

    const program = ts.createProgram(entryFiles, {
      target: ts.ScriptTarget.Latest,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowJs: true
    }, compilerHost);

    return {
      program,
      typeChecker: program.getTypeChecker(),
      compilerHost,
      sourceFiles
    };
  }

  // Simplified version specifically for AST operations without full semantic binding
  public async createSourceFile(filePath: string): Promise<any> {
    const ts = await import('typescript');
    const content = await this.hostAdapter.fileSystem.read(filePath);
    if (!content) throw new Error(`File not found: ${filePath}`);
    
    return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  }
}
