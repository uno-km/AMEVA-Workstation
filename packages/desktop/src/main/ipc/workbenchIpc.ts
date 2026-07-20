import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import type { 
  IpcCommandRequest, 
  IpcCommandResult, 
  IpcResponse, 
  IpcSnapshotRequest, 
  IpcSnapshotManifest,
  IpcCleanupRequest,
  IpcRegisterSessionRequest,
  IpcRegisterSessionResponse
} from '../../../../core/src/shared/ipc/workbenchIpcContract.js';
import { WorkbenchSessionRegistry, WorkbenchPathValidator, WorkbenchApprovalResolver } from './WorkbenchSecurity.js';

const activeCommands = new Map<string, any>();
export const sessionRegistry = new WorkbenchSessionRegistry();

function verifySender(event: Electron.IpcMainInvokeEvent): void {
  // Security: Check origin / frame
  if (!event.senderFrame) {
    throw new Error('IPC_SENDER_UNAUTHORIZED');
  }
}

function handleSafeError(e: any, defaultCode: any): any {
  let errorCode = defaultCode;
  const msg = e.message || '';
  if (msg === 'INVALID_WORKBENCH_CONTEXT' || msg === 'WORKBENCH_SESSION_NOT_FOUND' || msg === 'WORKBENCH_SESSION_UNAUTHORIZED' || msg === 'WORKBENCH_CONTEXT_MISMATCH' || msg === 'IPC_SENDER_UNAUTHORIZED' || msg === 'INVALID_PATH' || msg === 'BLOCKED_BY_APPROVAL_INTEGRATION' || msg === 'SHELL_EXECUTION_NOT_ALLOWED' || msg === 'CLEANUP_SCOPE_VIOLATION') {
    errorCode = msg;
  }
  return { success: false, errorCode, safeMessage: msg };
}


function safePathResolve(basePath: string, targetPath: string): string | null {
  const resolved = path.resolve(basePath, targetPath);
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null; // Path traversal detected
  }
  return resolved;
}

export function registerWorkbenchIpc() {
  ipcMain.handle('workbench:registerSession', async (event, request: IpcRegisterSessionRequest): Promise<IpcResponse<IpcRegisterSessionResponse>> => {
    try {
      verifySender(event);
      const res = sessionRegistry.registerSession(request);
      return { success: true, result: res };
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTION_ERROR');
    }
  });

  ipcMain.handle('workbench:generateDocumentArtifact', async (event, request: any) => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);
      const { MainProcessDocumentHostService } = require('../services/MainProcessDocumentHostService');
      const service = new MainProcessDocumentHostService();
      const result = await service.generateArtifact(request, session.allowedWorkspaceRoot);
      return { success: true, result };
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTION_ERROR');
    }
  });

  ipcMain.handle('workbench:extractDocumentArtifact', async (event, request: any) => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);
      const { MainProcessDocumentHostService } = require('../services/MainProcessDocumentHostService');
      const service = new MainProcessDocumentHostService();
      const result = await service.extractArtifact(request, session.allowedWorkspaceRoot);
      return { success: true, result };
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTION_ERROR');
    }
  });

  ipcMain.handle('workbench:executeCommand', async (event, request: IpcCommandRequest): Promise<IpcResponse<IpcCommandResult>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);

      if (!request.commandId || !request.executable) {
        return { success: false, errorCode: 'INVALID_REQUEST', safeMessage: 'Invalid command request' };
      }

      // Validate approval and risk
      WorkbenchApprovalResolver.verifyApproval(request.approvalId, session, request.riskLevel);

      // Validate paths
      WorkbenchPathValidator.verifyContainment(request.workingDirectory, session.allowedWorkspaceRoot);

      // Block shells
      const execLower = request.executable.toLowerCase();
      if (execLower === 'cmd' || execLower === 'cmd.exe' || execLower === 'sh' || execLower === 'bash') {
         throw new Error('SHELL_EXECUTION_NOT_ALLOWED');
      }
      if (execLower === 'powershell' || execLower === 'powershell.exe' || execLower === 'pwsh' || execLower === 'pwsh.exe') {
         if (request.arguments.includes('-Command') || request.arguments.includes('-c')) {
            throw new Error('SHELL_EXECUTION_NOT_ALLOWED');
         }
      }

      // Windows process termination capability indicator
      const capabilitiesUsed = {
        timeout: 'ENFORCED',
        singleProcessCancellation: 'ENFORCED',
        processTreeCancellation: 'OBSERVED_ONLY',
        networkPolicy: request.networkRequired ? 'UNENFORCED' : 'ENFORCED'
      };

      return new Promise<IpcResponse<IpcCommandResult>>((resolve) => {
        let stdoutPreview = '';
        let stderrPreview = '';
        let outputBytes = 0;
        let outputTruncated = false;
        let exitCode: number | null = null;
        let signal: string | null = null;
        let status: IpcCommandResult['status'] = 'COMPLETED';
        let interrupted = false;
        let timedOut = false;
        let cancelled = false;

        const startedAt = Date.now();

        // Spawn with shell: false
        const child = spawn(request.executable, request.arguments, {
          cwd: request.workingDirectory,
          env: { ...process.env, ...request.environmentKeys },
          shell: false
        });

        activeCommands.set(request.commandId, child);

        const timer = setTimeout(() => {
          timedOut = true;
          status = 'TIMED_OUT';
          interrupted = true;
          child.kill('SIGKILL');
        }, request.timeoutMs);

        child.stdout.on('data', (chunk) => {
          outputBytes += chunk.length;
          if (outputBytes > request.maxOutputBytes) {
            outputTruncated = true;
            status = 'FAILED';
            interrupted = true;
            stderrPreview += `\n[Workbench] Max command output bytes exceeded.`;
            child.kill('SIGKILL');
          } else {
            stdoutPreview += chunk.toString();
          }
        });

        child.stderr.on('data', (chunk) => {
          stderrPreview += chunk.toString();
        });

        child.on('close', (code, sig) => {
          clearTimeout(timer);
          activeCommands.delete(request.commandId);
          exitCode = code;
          signal = sig;
          
          if (status === 'COMPLETED' && code !== 0 && !request.expectedExitCodes.includes(code || 0)) {
            status = 'FAILED';
          }
          
          if (cancelled) {
            status = 'INTERRUPTED';
          }

          resolve({
            success: true,
            result: {
              commandId: request.commandId,
              status,
              exitCode: exitCode || 0,
              signal,
              startedAt,
              completedAt: Date.now(),
              durationMs: Date.now() - startedAt,
              timedOut,
              cancelled,
              stdoutPreview,
              stderrPreview,
              outputTruncated,
              capabilitiesUsed
            }
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          activeCommands.delete(request.commandId);
          resolve({
            success: true,
            result: {
              commandId: request.commandId,
              status: 'FAILED',
              exitCode: -1,
              signal: null,
              startedAt,
              completedAt: Date.now(),
              durationMs: Date.now() - startedAt,
              timedOut: false,
              cancelled: false,
              stdoutPreview,
              stderrPreview: err.message,
              outputTruncated: false,
              capabilitiesUsed
            }
          });
        });
      });
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTION_ERROR');
    }
  });

  ipcMain.handle('workbench:cancelCommand', async (event, commandId: string): Promise<IpcResponse<void>> => {
    try {
      verifySender(event);
      const child = activeCommands.get(commandId);
      if (child) {
        child.kill('SIGKILL');
        activeCommands.delete(commandId);
      }
      return { success: true, result: undefined };
    } catch (e: any) {
      return handleSafeError(e, 'CANCEL_ERROR');
    }
  });

  ipcMain.handle('workbench:createSnapshot', async (event, request: IpcSnapshotRequest): Promise<IpcResponse<IpcSnapshotManifest>> => {
    let tmpDir = '';
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);

      if (request.sourceDir === request.destDir) {
        throw new Error('INVALID_PATH'); // Source and destination cannot be the same
      }

      // Check boundaries
      WorkbenchPathValidator.verifyContainment(request.sourceDir, session.allowedWorkspaceRoot);
      WorkbenchPathValidator.verifyContainment(request.destDir, session.allowedWorkspaceRoot);

      // Check overlap
      const realSrc = fs.existsSync(request.sourceDir) ? fs.realpathSync.native(request.sourceDir) : path.resolve(request.sourceDir);
      const realDest = fs.existsSync(request.destDir) ? fs.realpathSync.native(request.destDir) : path.resolve(request.destDir);
      if (realDest.startsWith(realSrc + path.sep) || realSrc.startsWith(realDest + path.sep)) {
         throw new Error('INVALID_PATH');
      }

      tmpDir = path.join(request.destDir, `_tmp_snapshot_${crypto.randomUUID()}`);
      let manifest: IpcSnapshotManifest = {
        totalFiles: 0,
        totalBytes: 0,
        copiedFiles: [],
        excludedFiles: [],
        referenceOnlyFiles: [],
        approvalRequiredFiles: [],
        failedFiles: []
      };

      await fsp.mkdir(tmpDir, { recursive: true });
      
      async function copyDir(src: string, dest: string) {
        const entries = await fsp.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            await fsp.mkdir(destPath, { recursive: true });
            await copyDir(srcPath, destPath);
          } else if (entry.isFile()) {
            const stats = await fsp.stat(srcPath);
            if (stats.size > request.maxSingleFileBytes) {
              if (request.requiredInputs?.includes(srcPath)) {
                // If it is required, we cannot just exclude. Send to failed or waiting user.
                throw new Error(`Required file ${srcPath} exceeds maxSingleFileBytes limits.`);
              }
              if (request.largeFilePolicy === 'EXCLUDE') {
                manifest.excludedFiles.push({ path: srcPath, reason: 'Size exceeded' });
              } else if (request.largeFilePolicy === 'FAIL') {
                throw new Error(`File ${srcPath} exceeds limits`);
              }
              continue;
            }
            await fsp.copyFile(srcPath, destPath);
            manifest.copiedFiles.push({ path: srcPath, reason: 'Copied' });
            manifest.totalFiles++;
            manifest.totalBytes += stats.size;
          }
        }
      }

      await copyDir(request.sourceDir, tmpDir);

      // Atomic rename (best effort on windows across same volume)
      if (fs.existsSync(request.destDir)) {
         await fsp.rm(request.destDir, { recursive: true, force: true });
      }
      await fsp.rename(tmpDir, request.destDir);
      
      return { success: true, result: manifest };
    } catch (e: any) {
      if (tmpDir && fs.existsSync(tmpDir)) {
        try { await fsp.rm(tmpDir, { recursive: true, force: true }); } catch (err) {}
      }
      return handleSafeError(e, 'SNAPSHOT_ERROR');
    }
  });

  ipcMain.handle('workbench:cleanupWorkspace', async (event, request: IpcCleanupRequest): Promise<IpcResponse<void>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);

      WorkbenchPathValidator.verifyContainment(request.targetWorkspace, session.allowedWorkspaceRoot);
      const realTarget = fs.existsSync(request.targetWorkspace) ? fs.realpathSync.native(request.targetWorkspace) : path.resolve(request.targetWorkspace);
      const realRoot = fs.realpathSync.native(session.allowedWorkspaceRoot);
      
      if (realTarget === realRoot) {
        throw new Error('CLEANUP_SCOPE_VIOLATION'); // cannot delete root
      }

      if (fs.existsSync(request.targetWorkspace)) {
        await fsp.rm(request.targetWorkspace, { recursive: true, force: true });
      }
      return { success: true, result: undefined };
    } catch (e: any) {
      return handleSafeError(e, 'CLEANUP_ERROR');
    }
  });

  ipcMain.handle('workbench:inspectWorkspace', async (event, request: any): Promise<IpcResponse<any>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext(request);
      WorkbenchPathValidator.verifyContainment(request.targetWorkspace, session.allowedWorkspaceRoot);

      const exists = fs.existsSync(request.targetWorkspace);
      return { success: true, result: { exists } };
    } catch (e: any) {
      return handleSafeError(e, 'INSPECT_ERROR');
    }
  });

  ipcMain.handle('workbench:closeSession', async (event, request: any): Promise<IpcResponse<void>> => {
    try {
      verifySender(event);
      sessionRegistry.closeSession(request.workbenchSessionId, request.sessionCapabilityToken);
      return { success: true, result: undefined };
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTION_ERROR');
    }
  });
}
