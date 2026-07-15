import { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import { ICommandExecutorAdapter } from './ICommandExecutorAdapter';
import { ResourceLimits, SnapshotManifest } from '../domain/WorkbenchTypes';

export type CapabilityStatus = 'ENFORCED' | 'OBSERVED_ONLY' | 'UNSUPPORTED';

export interface WorkbenchHostCapabilities {
  fileIsolation: CapabilityStatus;
  processTimeout: CapabilityStatus;
  processCancellation: CapabilityStatus;
  memoryLimit: CapabilityStatus;
  cpuLimit: CapabilityStatus;
  networkIsolation: CapabilityStatus;
  symlinkInspection: CapabilityStatus;
  copyOnWrite: CapabilityStatus;
}

export interface IWorkbenchHostAdapter {
  fileSystem: IFileSystemAdapter;
  commandExecutor: ICommandExecutorAdapter;
  capabilities: WorkbenchHostCapabilities;

  bindSession?(session: any): void;

  createSnapshot(
    sourceDir: string,
    destDir: string,
    allowedPaths: string[] | null,
    resourceLimits: ResourceLimits,
    requiredInputs?: string[]
  ): Promise<SnapshotManifest>;

  cleanupWorkspace(workspaceDir: string): Promise<void>;
  
  inspectWorkspace(workspaceDir: string): Promise<any>;
}
