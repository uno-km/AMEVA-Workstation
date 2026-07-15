import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryDiscoveryService } from '../../workbench/execution/RepositoryDiscoveryService';
import { IWorkbenchHostAdapter } from '../../workbench/adapter/IWorkbenchHostAdapter';

describe('Phase 6.2: Repository Discovery Integration', () => {
  let mockAdapter: IWorkbenchHostAdapter;
  let service: RepositoryDiscoveryService;

  beforeEach(() => {
    mockAdapter = {
      fileSystem: {
        exists: vi.fn(),
        read: vi.fn(),
      } as any,
      commandExecutor: {} as any,
      capabilities: {} as any
    };
    service = new RepositoryDiscoveryService(mockAdapter);
  });

  it('1. Detects ambiguous package manager', async () => {
    vi.mocked(mockAdapter.fileSystem.exists).mockImplementation(async (path: string) => {
      if (path.includes('pnpm-lock.yaml')) return true;
      if (path.includes('yarn.lock')) return true;
      return false;
    });

    const profile = await service.discover('/iso');
    expect(profile.packageManager).toBe('AMBIGUOUS');
    expect(profile.discoveryWarnings).toContain('AMBIGUOUS_PACKAGE_MANAGER: Multiple lockfiles found.');
  });

  it('2. Parses package.json and tsconfig.json natively', async () => {
    vi.mocked(mockAdapter.fileSystem.exists).mockImplementation(async (path: string) => {
      if (path.includes('package-lock.json')) return true;
      if (path.includes('package.json')) return true;
      if (path.includes('tsconfig.json')) return true;
      return false;
    });

    vi.mocked(mockAdapter.fileSystem.read).mockImplementation(async (path: string) => {
      if (path.includes('package.json')) return JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } });
      if (path.includes('tsconfig.json')) return JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } });
      return null;
    });

    const profile = await service.discover('/iso');
    
    expect(profile.packageManager).toBe('npm');
    expect(profile.buildCommands).toContain('tsc');
    expect(profile.testCommands).toContain('vitest');
    expect(profile.language).toBe('TypeScript');
    expect(profile.pathAliases['@/*']).toEqual(['src/*']);
  });
});
