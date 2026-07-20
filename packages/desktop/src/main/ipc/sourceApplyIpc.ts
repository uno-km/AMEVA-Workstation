/**
 * @file main/ipc/sourceApplyIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @role Source Apply IPC Handlers
 */

import { ipcMain } from 'electron';
import type { IpcResponse } from '../../../../core/src/shared/ipc/workbenchIpcContract.js';
import type { 
  IpcCreatePreviewRequest, 
  IpcCreatePreviewResponse, 
  IpcExecuteApplyRequest, 
  IpcExecuteApplyResponse,
  IpcRollbackApplyRequest,
  IpcRollbackApplyResponse,
  IpcAuthorizeSourceApplyRequest,
  IpcAuthorizeSourceApplyResponse
} from '../../../../core/src/shared/ipc/sourceApplyIpcContract.js';
import { SourceApplyService } from '../services/SourceApplyService.js';
import { sessionRegistry } from './workbenchIpc.js';
import { ArtifactRepositoryInMemory, ApprovalRepositoryInMemory } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/InMemoryRepositories.js';
import { ExecutionTraceManager } from '../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager.js';

export let sourceApplyService: SourceApplyService;

export function injectSourceApplyService(service: SourceApplyService) {
  sourceApplyService = service;
}

function verifySender(event: Electron.IpcMainInvokeEvent): void {
  if (!event.senderFrame) {
    throw new Error('IPC_SENDER_UNAUTHORIZED');
  }
}

function handleSafeError(e: any): any {
  const msg = e instanceof Error ? e.message : String(e);
  
  
  // Rule 3: errorCode MUST be the REAL failure reason
  // Rule 4: NO wrapping, NO abstraction, NO masking
  return { success: false, errorCode: msg };
}

export function registerSourceApplyIpc() {
  ipcMain.handle('sourceApply:createPreview', async (event, request: IpcCreatePreviewRequest): Promise<IpcResponse<IpcCreatePreviewResponse>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext({ 
        workbenchSessionId: request.workbenchSessionId, 
        sessionCapabilityToken: (request as any).sessionCapabilityToken 
      } as any);

      const preview = await sourceApplyService.createPreview(request, session.allowedWorkspaceRoot);
      return { success: true, result: { success: true, preview } };
    } catch (e: any) {
      return handleSafeError(e);
    }
  });

  ipcMain.handle('sourceApply:authorizeOperation', async (event, request: IpcAuthorizeSourceApplyRequest): Promise<IpcResponse<IpcAuthorizeSourceApplyResponse>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext({ 
        workbenchSessionId: request.workbenchSessionId, 
        sessionCapabilityToken: request.sessionCapabilityToken 
      } as any);

      const response = await sourceApplyService.authorizeOperation(request, session);
      return { success: true, result: response };
    } catch (e: any) {
      return handleSafeError(e);
    }
  });

  ipcMain.handle('sourceApply:executeApply', async (event, request: IpcExecuteApplyRequest): Promise<IpcResponse<IpcExecuteApplyResponse>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext({ 
        workbenchSessionId: request.workbenchSessionId, 
        sessionCapabilityToken: request.sessionCapabilityToken 
      } as any);

      const response = await sourceApplyService.executeApply(request, session);
      return { success: true, result: response };
    } catch (e: any) {
      return handleSafeError(e);
    }
  });

  ipcMain.handle('sourceApply:verifyApply', async (event, request: import('../../../../core/src/shared/ipc/sourceApplyIpcContract.js').IpcVerifyApplyRequest): Promise<IpcResponse<import('../../../../core/src/shared/ipc/sourceApplyIpcContract.js').IpcVerifyApplyResponse>> => {
    try {
      verifySender(event);
      const response = await sourceApplyService.verifyApply(request);
      return { success: true, result: response };
    } catch (e: any) {
      return handleSafeError(e);
    }
  });
}
