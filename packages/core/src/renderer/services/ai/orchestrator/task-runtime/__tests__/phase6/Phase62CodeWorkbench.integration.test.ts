import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CodeWorkbenchCoordinator } from '../../workbench/execution/CodeWorkbenchCoordinator';
import { IWorkbenchHostAdapter } from '../../workbench/adapter/IWorkbenchHostAdapter';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { WorkbenchSession, CommandExecutionResult, CodeChangePlan } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2: Code Workbench Integration', () => {
  let mockFs: IFileSystemAdapter;
  let mockHostAdapter: IWorkbenchHostAdapter;
  let coordinator: CodeWorkbenchCoordinator;
  let mockSession: WorkbenchSession;

  beforeEach(() => {
    const memoryFs = new Map<string, string>();

    mockFs = {
      read: vi.fn(async (path: string) => memoryFs.get(path) || null),
      write: vi.fn(async (path: string, content: string) => { memoryFs.set(path, content); }),
      exists: vi.fn(async (path: string) => memoryFs.has(path)),
      remove: vi.fn(async (path: string) => { memoryFs.delete(path); }),
      stat: vi.fn(),
      copy: vi.fn(),
      move: vi.fn(),
      hash: vi.fn(),
      list: vi.fn(),
      realpath: vi.fn(),
      isSymlink: vi.fn()
    };

    mockHostAdapter = {
      fileSystem: mockFs,
      commandExecutor: {
        execute: vi.fn(),
        cancel: vi.fn(),
        getStatus: vi.fn(),
        getCapabilities: vi.fn()
      },
      capabilities: {} as any,
      createSnapshot: vi.fn(),
      cleanupWorkspace: vi.fn(),
      inspectWorkspace: vi.fn(),
      bindSession: vi.fn()
    };

    coordinator = new CodeWorkbenchCoordinator(mockHostAdapter);

    mockSession = {
      workbenchSessionId: 'sess-1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchType: 'CODE',
      sourceWorkspace: '/source',
      isolatedWorkspace: '/isolated',
      baseRevision: 'rev-0',
      currentRevision: 'rev-0',
      allowedPaths: ['/isolated'],
      protectedPaths: [],
      allowedCommands: ['tsc', 'vitest'],
      networkPolicy: 'DENY',
      resourceLimits: {} as any,
      requiredChecks: ['tsc --noEmit'],
      expectedArtifacts: [],
      status: 'READY',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    memoryFs.set('/isolated/index.ts', 'const a: string = 1;');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Orchestrates Plan -> Modify -> Validate -> Repair Loop successfully', async () => {
    // Mock the ChangePlanner to just create a dummy change
    vi.spyOn(coordinator['changePlanner'], 'createPlan').mockResolvedValue({
      planId: 'plan-1',
      objective: 'Fix type error',
      modifications: [
        { logicalPath: 'index.ts', operation: 'UPDATE', content: 'const a: string = "1";' }
      ],
      expectedImpact: []
    });

    // Mock the command executor to fail the first time, then succeed the second time (simulating a successful repair)
    let executionCount = 0;
    vi.mocked(mockHostAdapter.commandExecutor.execute).mockImplementation(async () => {
      executionCount++;
      if (executionCount === 1) {
        return {
          status: 'COMPLETED',
          exitCode: 1,
          stdout: '',
          stderr: 'Type error: Type number is not assignable to type string.',
          interrupted: false,
          capabilitiesUsed: {}
        } as CommandExecutionResult;
      } else {
        return {
          status: 'COMPLETED',
          exitCode: 0,
          stdout: 'Pass',
          stderr: '',
          interrupted: false,
          capabilitiesUsed: {}
        } as CommandExecutionResult;
      }
    });

    // Mock the RepairLoop to provide a fix on the first failure
    vi.spyOn(coordinator['repairLoop'], 'attemptRepair').mockResolvedValue({
      attemptNumber: 1,
      validationResult: { passed: false, errors: ['Type error'], warnings: [] },
      proposedFixes: [
        { logicalPath: 'index.ts', operation: 'UPDATE', content: 'const a: string = "fixed";' }
      ]
    });

    // Run coordinator
    const { diff, validationResult } = await coordinator.runCodeModificationCycle(mockSession, 'Fix type error', 3);

    // Assertions
    expect(coordinator['changePlanner'].createPlan).toHaveBeenCalledTimes(1);
    expect(mockFs.write).toHaveBeenCalledWith('/isolated/index.ts', 'const a: string = "1";'); // initial change
    expect(mockFs.write).toHaveBeenCalledWith('/isolated/index.ts', 'const a: string = "fixed";'); // repair change

    expect(mockHostAdapter.commandExecutor.execute).toHaveBeenCalledTimes(2); // Initial validate + 1 repair validate
    expect(coordinator['repairLoop'].attemptRepair).toHaveBeenCalledTimes(1);
    
    expect(validationResult.passed).toBe(true);
    expect(diff).not.toBeNull();
    expect(diff?.summary).toBe('Generated diff from Code Workbench');
  });

  it('2. Stops repairing if maxRepairs is reached', async () => {
    vi.spyOn(coordinator['changePlanner'], 'createPlan').mockResolvedValue({
      planId: 'plan-2',
      objective: 'Break stuff',
      modifications: [],
      expectedImpact: []
    });

    // Always fail validation
    vi.mocked(mockHostAdapter.commandExecutor.execute).mockResolvedValue({
      status: 'COMPLETED',
      exitCode: 1,
      stdout: '',
      stderr: 'Persistent error',
      interrupted: false,
      capabilitiesUsed: {}
    });

    vi.spyOn(coordinator['repairLoop'], 'attemptRepair').mockImplementation(async (s, r, attempt) => {
      return {
        attemptNumber: attempt,
        validationResult: r,
        proposedFixes: [{ logicalPath: 'index.ts', operation: 'UPDATE', content: `// attempt ${attempt}` }]
      };
    });

    const { diff, validationResult } = await coordinator.runCodeModificationCycle(mockSession, 'Break stuff', 2);

    expect(coordinator['repairLoop'].attemptRepair).toHaveBeenCalledTimes(2);
    expect(mockHostAdapter.commandExecutor.execute).toHaveBeenCalledTimes(3); // Initial + 2 repairs
    
    expect(validationResult.passed).toBe(false);
    expect(diff).toBeNull(); // No diff emitted on failure
  });
});
