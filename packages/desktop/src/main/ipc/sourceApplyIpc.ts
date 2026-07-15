/**
 * @file main/ipc/sourceApplyIpc.ts
 * @system AMEVA OS Desktop Workstation
 * @role Source Apply IPC Handlers
 */

import { ipcMain } from 'electron';
import { IpcResponse } from '../../../../core/src/shared/ipc/workbenchIpcContract.js';
import { 
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

function handleSafeError(e: any, defaultCode: any): any {
  let errorCode = defaultCode;
  const msg = e.message || '';
  if (msg.includes('INVALID_PATH') || msg.includes('UNAUTHORIZED') || msg.includes('CAPABILITY_INVALID')) {
    errorCode = msg;
  }
  return { success: false, errorCode, error: msg };
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
      return handleSafeError(e, 'PREVIEW_ERROR');
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
      return handleSafeError(e, 'AUTHORIZE_ERROR');
    }
  });

  ipcMain.handle('sourceApply:executeApply', async (event, request: IpcExecuteApplyRequest): Promise<IpcResponse<IpcExecuteApplyResponse>> => {
    return { success: false, errorCode: 'BLOCKED', error: 'Phase 6.4.1B Required' };
  });

  ipcMain.handle('sourceApply:rollbackApply', async (event, request: IpcRollbackApplyRequest & { workbenchSessionId: string, sessionCapabilityToken?: string }): Promise<IpcResponse<IpcRollbackApplyResponse>> => {
    return { success: false, errorCode: 'BLOCKED', error: 'Phase 6.4.1B Required' };
  });
}
