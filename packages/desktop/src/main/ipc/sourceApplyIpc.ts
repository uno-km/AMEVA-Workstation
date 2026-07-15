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
  IpcRollbackApplyResponse
} from '../../../../core/src/shared/ipc/sourceApplyIpcContract.js';
import { SourceApplyService } from '../services/SourceApplyService.js';
import { sessionRegistry } from './workbenchIpc.js';

const sourceApplyService = new SourceApplyService();

function verifySender(event: Electron.IpcMainInvokeEvent): void {
  if (!event.senderFrame) {
    throw new Error('IPC_SENDER_UNAUTHORIZED');
  }
}

function handleSafeError(e: any, defaultCode: any): any {
  let errorCode = defaultCode;
  const msg = e.message || '';
  if (msg.includes('INVALID_PATH') || msg.includes('UNAUTHORIZED')) {
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

  ipcMain.handle('sourceApply:executeApply', async (event, request: IpcExecuteApplyRequest): Promise<IpcResponse<IpcExecuteApplyResponse>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext({ 
        workbenchSessionId: request.applyRequest.workbenchSessionId, 
        sessionCapabilityToken: request.applyRequest.sessionCapabilityToken 
      } as any);

      const operation = await sourceApplyService.executeApply(
        request.operationId,
        request.applyRequest,
        request.preview,
        request.targetArtifact,
        session.allowedWorkspaceRoot
      );

      return { success: true, result: { success: true, operation } };
    } catch (e: any) {
      return handleSafeError(e, 'EXECUTE_ERROR');
    }
  });

  ipcMain.handle('sourceApply:rollbackApply', async (event, request: IpcRollbackApplyRequest & { workbenchSessionId: string, sessionCapabilityToken?: string }): Promise<IpcResponse<IpcRollbackApplyResponse>> => {
    try {
      verifySender(event);
      const session = sessionRegistry.verifyContext({ 
        workbenchSessionId: request.workbenchSessionId, 
        sessionCapabilityToken: request.sessionCapabilityToken 
      } as any);

      await sourceApplyService.rollbackApply(request.operationId, request.rollbackSnapshotId, session.allowedWorkspaceRoot);
      return { success: true, result: { success: true } };
    } catch (e: any) {
      return handleSafeError(e, 'ROLLBACK_ERROR');
    }
  });
}
