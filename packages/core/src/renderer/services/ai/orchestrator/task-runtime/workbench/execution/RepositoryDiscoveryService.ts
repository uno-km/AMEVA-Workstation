import { IWorkbenchHostAdapter } from '../adapter/IWorkbenchHostAdapter';
import { RepositoryProfile } from '../domain/WorkbenchTypes';

export class RepositoryDiscoveryService {
  constructor(private hostAdapter: IWorkbenchHostAdapter) {}

  public async discover(isolatedWorkspace: string): Promise<RepositoryProfile> {
    const profile: RepositoryProfile = {
      language: 'UNKNOWN',
      frameworks: [],
      packageManager: 'UNKNOWN',
      sourceRoots: [],
      testRoots: [],
      buildCommands: [],
      testCommands: [],
      lintCommands: [],
      formatCommands: [],
      typeCheckCommands: [],
      generatedPaths: [],
      protectedPaths: [],
      dependencyFiles: [],
      repositoryRevision: 'UNKNOWN',
      confidence: 0,
      warnings: [],
      discoveredConfigFiles: [],
      discoveredScripts: {},
      packageManagerEvidence: '',
      frameworkEvidence: '',
      compilerConfig: {},
      projectReferences: [],
      pathAliases: {},
      discoveryWarnings: []
    };

    try {
      // 1. Detect package manager
      const lockfiles = [];
      if (await this.hostAdapter.fileSystem.exists(`${isolatedWorkspace}/package-lock.json`)) lockfiles.push('npm');
      if (await this.hostAdapter.fileSystem.exists(`${isolatedWorkspace}/yarn.lock`)) lockfiles.push('yarn');
      if (await this.hostAdapter.fileSystem.exists(`${isolatedWorkspace}/pnpm-lock.yaml`)) lockfiles.push('pnpm');

      if (lockfiles.length === 1) {
        profile.packageManager = lockfiles[0];
        profile.packageManagerEvidence = `Found ${lockfiles[0]} lockfile`;
      } else if (lockfiles.length > 1) {
        profile.packageManager = 'AMBIGUOUS';
        profile.discoveryWarnings.push('AMBIGUOUS_PACKAGE_MANAGER: Multiple lockfiles found.');
      } else {
        profile.discoveryWarnings.push('No lockfile found. Package manager unknown.');
      }

      // 2. Parse package.json
      const pkgJsonPath = `${isolatedWorkspace}/package.json`;
      if (await this.hostAdapter.fileSystem.exists(pkgJsonPath)) {
        profile.discoveredConfigFiles.push('package.json');
        const pkgContent = await this.hostAdapter.fileSystem.read(pkgJsonPath);
        if (pkgContent) {
          try {
            const pkg = JSON.parse(pkgContent);
            profile.discoveredScripts = pkg.scripts || {};
            
            // Map scripts natively
            if (pkg.scripts?.build) profile.buildCommands.push(pkg.scripts.build);
            if (pkg.scripts?.test) profile.testCommands.push(pkg.scripts.test);
            if (pkg.scripts?.lint) profile.lintCommands.push(pkg.scripts.lint);
            if (pkg.scripts?.format) profile.formatCommands.push(pkg.scripts.format);
            if (pkg.scripts?.typecheck || pkg.scripts?.['type-check']) {
              profile.typeCheckCommands.push(pkg.scripts.typecheck || pkg.scripts['type-check']);
            }

            profile.language = 'JavaScript'; // Default, might be upgraded to TS

          } catch (e) {
            profile.discoveryWarnings.push('Failed to parse package.json');
          }
        }
      }

      // 3. Detect TS
      const tsconfigPath = `${isolatedWorkspace}/tsconfig.json`;
      if (await this.hostAdapter.fileSystem.exists(tsconfigPath)) {
        profile.discoveredConfigFiles.push('tsconfig.json');
        profile.language = 'TypeScript';
        const tsContent = await this.hostAdapter.fileSystem.read(tsconfigPath);
        try {
          // Simple parsing (real TS parsing needs to handle comments, so we just store raw or do a light parse)
          profile.compilerConfig = JSON.parse(tsContent?.replace(/\/\/.*$/gm, '') || '{}');
          if (profile.compilerConfig.compilerOptions?.paths) {
            profile.pathAliases = profile.compilerConfig.compilerOptions.paths;
          }
        } catch (e) {
          profile.discoveryWarnings.push('Failed to parse tsconfig.json natively (might contain comments)');
        }
      }

      profile.confidence = 100 - (profile.discoveryWarnings.length * 10);
      if (profile.confidence < 0) profile.confidence = 0;

    } catch (err: any) {
      profile.discoveryWarnings.push(`Discovery error: ${err.message}`);
    }

    return profile;
  }
}
