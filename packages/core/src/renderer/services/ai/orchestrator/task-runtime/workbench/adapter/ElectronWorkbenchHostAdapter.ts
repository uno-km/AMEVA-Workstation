import type { IWorkbenchHostAdapter, WorkbenchHostCapabilities } from './IWorkbenchHostAdapter';
import type { IFileSystemAdapter } from '../../artifact/IFileSystemAdapter';
import type { ICommandExecutorAdapter } from './ICommandExecutorAdapter';
import type { ResourceLimits, SnapshotManifest, CommandPlan, CommandExecutionResult } from '../domain/WorkbenchTypes';
import type { IpcCommandRequest, IpcSnapshotRequest } from '../../../../../../../shared/ipc/workbenchIpcContract';

// This acts as a proxy to the Main Process IPC where the actual IFileSystemAdapter operations happen for Workbench.
// For operations outside of snapshot, we can use the existing window.electronAPI file methods, 
// but for Workbench strict isolation, we rely on the specific workbench IPCs.
class ElectronFileSystemAdapter implements IFileSystemAdapter {
  async stat(path: string): Promise<{ exists: boolean; size: number; isDirectory: boolean }> {
    throw new Error('Not implemented for generic use. Use specific IPCs.');
  }
  async read(path: string): Promise<string | null> {
    const res = await (window as any).electronAPI.readFromPath(path);
    if (res?.success) return res.content;
    return null;
  }
  async readBytes(path: string): Promise<Uint8Array | null> {
    throw new Error('Not implemented via IPC yet.');
  }
  async write(path: string, content: string): Promise<void> {
    const res = await (window as any).electronAPI.saveFile(content, path);
    if (!res?.success) throw new Error('Failed to write file via IPC');
  }
  async copy(sourcePath: string, destPath: string): Promise<void> {
    throw new Error('Use createSnapshot for Workbench copying.');
  }
  async move(sourcePath: string, destPath: string, backupPath?: string): Promise<void> {
    throw new Error('Not implemented. IPC adapter handles moves internally.');
  }
  async hash(path: string): Promise<string | null> {
    // For MVP we might need to compute hash. If not provided by IPC, we can read and hash locally or add IPC.
    // However, NodeArtifactFileAdapter was doing this. Let's assume we fetch content and hash it.
    const content = await this.read(path);
    if (content === null) return null;
    return await this.computeHashLocally(content);
  }
  async remove(path: string): Promise<void> {
    throw new Error('Not implemented via IPC yet.');
  }
  async list(path: string): Promise<string> {
    throw new Error('Not implemented via IPC yet.');
  }
  async exists(path: string): Promise<boolean> {
    const res = await (window as any).electronAPI.readFromPath(path);
    return res?.success === true;
  }
  async realpath(p: string): Promise<string> {
    return p; // Temporary fallback. Main process will validate paths.
  }
  async isSymlink(p: string): Promise<boolean> {
    return false; // Temporary fallback. Main process validates symlinks.
  }

  private async computeHashLocally(content: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

class ElectronCommandExecutorAdapter implements ICommandExecutorAdapter {
  public sessionContext: any;

  async execute(plan: CommandPlan, networkPolicy: string, maxOutputBytes: number): Promise<CommandExecutionResult> {
    const req: IpcCommandRequest = {
      ...this.sessionContext,
      commandId: plan.commandId,
      executable: plan.executable,
      arguments: plan.arguments,
      workingDirectory: plan.workingDirectory,
      environmentKeys: plan.environmentKeys,
      timeoutMs: plan.timeoutMs,
      maxOutputBytes,
      expectedExitCodes: plan.expectedExitCodes,
      networkRequired: plan.networkRequired,
      approvalId: (plan as any).approvalId,
      idempotencyKey: (plan as any).idempotencyKey,
      riskLevel: plan.riskLevel
    };

    const res = await (window as any).electronAPI.workbench.executeCommand(req);
    if (res && res.success) {
      return res.result as CommandExecutionResult;
    } else {
      throw new Error(`Command execution failed: ${res?.safeMessage || 'Unknown error'}`);
    }
  }

  async cancel(commandId: string): Promise<void> {
    await (window as any).electronAPI.workbench.cancelCommand(commandId);
  }

  async getStatus(commandId: string): Promise<"RUNNING" | "COMPLETED" | "FAILED" | "INTERRUPTED"> {
    return 'RUNNING';
  }

  getCapabilities(): Record<string, string> {
    return {
      timeout: 'ENFORCED',
      singleProcessCancellation: 'ENFORCED',
      processTreeCancellation: 'OBSERVED_ONLY',
      networkPolicy: 'UNSUPPORTED'
    };
  }
}

export class ElectronWorkbenchHostAdapter implements IWorkbenchHostAdapter {
  public fileSystem = new ElectronFileSystemAdapter();
  public commandExecutor = new ElectronCommandExecutorAdapter();
  public capabilities: WorkbenchHostCapabilities = {
    fileIsolation: 'ENFORCED',
    processTimeout: 'ENFORCED',
    processCancellation: 'ENFORCED',
    memoryLimit: 'UNSUPPORTED',
    cpuLimit: 'UNSUPPORTED',
    networkIsolation: 'UNSUPPORTED',
    symlinkInspection: 'OBSERVED_ONLY',
    copyOnWrite: 'UNSUPPORTED'
  };

  private sessionContext: any;

  async bindSession(session: any): Promise<void> {
    const req = {
      missionId: session.missionId,
      taskId: session.taskId,
      attemptId: session.attemptId,
      workbenchSessionId: session.workbenchSessionId,
      requestedSourceWorkspace: session.sourceWorkspace,
      requestedIsolatedWorkspace: session.isolatedWorkspace
    };
    const res = await (window as any).electronAPI.workbench.registerSession(req);
    if (res && res.success) {
      session.sessionCapabilityToken = res.result.sessionCapabilityToken;
      this.sessionContext = {
        workbenchSessionId: session.workbenchSessionId,
        sessionCapabilityToken: session.sessionCapabilityToken,
        missionId: session.missionId,
        taskId: session.taskId,
        attemptId: session.attemptId
      };
      this.commandExecutor.sessionContext = this.sessionContext;
    } else {
      throw new Error(`Failed to register session: ${res?.safeMessage}`);
    }
  }

  async createSnapshot(sourceDir: string, destDir: string, allowedPaths: string[] | null, resourceLimits: ResourceLimits, requiredInputs?: string[]): Promise<SnapshotManifest> {
    if (!this.sessionContext) throw new Error('Session not bound to HostAdapter');
    const req: IpcSnapshotRequest = {
      ...this.sessionContext,
      sourceDir,
      destDir,
      allowedPaths,
      maxSingleFileBytes: resourceLimits.maxSingleFileBytes,
      maxWorkspaceBytes: resourceLimits.maxWorkspaceBytes,
      maxFileCount: resourceLimits.maxFileCount,
      largeFilePolicy: resourceLimits.largeFilePolicy,
      requiredInputs
    };
    const res = await (window as any).electronAPI.workbench.createSnapshot(req);
    if (res && res.success) {
      return res.result as SnapshotManifest;
    } else {
      throw new Error(`Snapshot creation failed: ${res?.safeMessage || 'Unknown error'}`);
    }
  }

  async cleanupWorkspace(workspaceDir: string): Promise<void> {
    if (!this.sessionContext) throw new Error('Session not bound to HostAdapter');
    const req = { ...this.sessionContext, targetWorkspace: workspaceDir, cleanupReason: 'CLEANUP' };
    const res = await (window as any).electronAPI.workbench.cleanupWorkspace(req);
    if (!res?.success) throw new Error(`Cleanup failed: ${res?.safeMessage}`);
  }

  async inspectWorkspace(workspaceDir: string): Promise<any> {
    if (!this.sessionContext) throw new Error('Session not bound to HostAdapter');
    const req = { ...this.sessionContext, targetWorkspace: workspaceDir };
    const res = await (window as any).electronAPI.workbench.inspectWorkspace(req);
    return res?.result;
  }

  async generateDocumentArtifact(request: any): Promise<any> {
    if (!this.sessionContext) throw new Error('Session not bound to HostAdapter');
    const req = { ...request, ...this.sessionContext };
    const res = await (window as any).electronAPI.workbench.generateDocumentArtifact(req);
    if (!res?.success) throw new Error(`Generation failed: ${res?.safeMessage || 'Unknown error'}`);
    return res.result;
  }

  async extractDocumentArtifact(request: any): Promise<any> {
    if (!this.sessionContext) throw new Error('Session not bound to HostAdapter');
    const req = { ...request, ...this.sessionContext };
    const res = await (window as any).electronAPI.workbench.extractDocumentArtifact(req);
    if (!res?.success) throw new Error(`Extraction failed: ${res?.safeMessage || 'Unknown error'}`);
    return res.result;
  }
}
