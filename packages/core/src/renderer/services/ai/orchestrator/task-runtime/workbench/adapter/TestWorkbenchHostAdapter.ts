import { IWorkbenchHostAdapter, WorkbenchHostCapabilities } from './IWorkbenchHostAdapter';
import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { ICommandExecutorAdapter } from './ICommandExecutorAdapter';
import { WorkspaceIsolator } from '../workspace/WorkspaceIsolator';
import { ResourceLimits, SnapshotManifest } from '../domain/WorkbenchTypes';

export class TestWorkbenchHostAdapter implements IWorkbenchHostAdapter {
  constructor(
    public readonly fileSystem: IFileSystemAdapter,
    public readonly commandExecutor: ICommandExecutorAdapter
  ) {}

  public get capabilities(): WorkbenchHostCapabilities {
    return {
      fileIsolation: 'ENFORCED',
      processTimeout: 'ENFORCED',
      processCancellation: 'ENFORCED',
      memoryLimit: 'UNSUPPORTED',
      cpuLimit: 'UNSUPPORTED',
      networkIsolation: 'UNENFORCED',
      symlinkInspection: 'ENFORCED',
      copyOnWrite: 'OBSERVED_ONLY' // fallback to stream if unsupported
    };
  }

  public async createSnapshot(
    sourceDir: string,
    destDir: string,
    allowedPaths: string[] | null,
    resourceLimits: ResourceLimits,
    requiredInputs: string[] = []
  ): Promise<SnapshotManifest> {
    const isolator = new WorkspaceIsolator(this.fileSystem);

    // Create a temporary directory first for atomicity
    const tempDest = `${destDir}_tmp_${Date.now()}`;
    await this.fileSystem.write(`${tempDest}/.keep`, ''); // Ensure dir creation, or use adapter's mkdir if we had it, but write creates dir recursively

    try {
      const manifest = await isolator.createIsolatedWorkspace(sourceDir, tempDest, allowedPaths, requiredInputs, resourceLimits);
      
      await this.fileSystem.remove(`${tempDest}/.keep`);

      // Atomic swap
      if (await this.fileSystem.exists(destDir)) {
        await this.fileSystem.remove(destDir);
      }
      await this.fileSystem.move(tempDest, destDir);
      return manifest;
    } catch (e) {
      // Cleanup on failure
      await this.fileSystem.remove(tempDest);
      throw e;
    }
  }

  public async cleanupWorkspace(workspaceDir: string): Promise<void> {
    await this.fileSystem.remove(workspaceDir);
  }

  public async inspectWorkspace(workspaceDir: string): Promise<any> {
    return this.fileSystem.list(workspaceDir);
  }
}
