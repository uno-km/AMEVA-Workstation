import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import { IpcRegisterSessionRequest, IpcRegisterSessionResponse, IpcSessionContext } from '../../../../core/src/shared/ipc/workbenchIpcContract';

export interface RegisteredSession {
  workbenchSessionId: string;
  missionId: string;
  taskId: string;
  attemptId: string;
  sessionCapabilityToken: string;
  allowedWorkspaceRoot: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'CLOSED';
  createdAt: number;
  expiresAt: number;
}

export class WorkbenchSessionRegistry {
  private sessions = new Map<string, RegisteredSession>();

  public registerSession(request: IpcRegisterSessionRequest): IpcRegisterSessionResponse {
    const token = crypto.randomBytes(32).toString('hex');
    const root = fs.existsSync(request.requestedIsolatedWorkspace) 
      ? fs.realpathSync.native(request.requestedIsolatedWorkspace) 
      : path.resolve(request.requestedIsolatedWorkspace);
      
    const session: RegisteredSession = {
      workbenchSessionId: request.workbenchSessionId,
      missionId: request.missionId,
      taskId: request.taskId,
      attemptId: request.attemptId,
      sessionCapabilityToken: token,
      allowedWorkspaceRoot: root,
      status: 'ACTIVE',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 // 24 hours
    };

    this.sessions.set(request.workbenchSessionId, session);

    return {
      workbenchSessionId: session.workbenchSessionId,
      sessionCapabilityToken: token,
      allowedWorkspaceRoot: session.allowedWorkspaceRoot
    };
  }

  public verifyContext(context: IpcSessionContext): RegisteredSession {
    if (!context || !context.workbenchSessionId) {
      throw new Error('INVALID_WORKBENCH_CONTEXT');
    }

    const session = this.sessions.get(context.workbenchSessionId);
    if (!session) {
      throw new Error('WORKBENCH_SESSION_NOT_FOUND');
    }

    if (session.sessionCapabilityToken !== context.sessionCapabilityToken) {
      throw new Error('WORKBENCH_SESSION_UNAUTHORIZED');
    }

    if (session.missionId !== context.missionId || session.attemptId !== context.attemptId) {
      throw new Error('WORKBENCH_CONTEXT_MISMATCH');
    }

    if (session.status !== 'ACTIVE' || Date.now() > session.expiresAt) {
      throw new Error('WORKBENCH_SESSION_UNAUTHORIZED');
    }

    return session;
  }

  public closeSession(workbenchSessionId: string, token: string): void {
    const session = this.sessions.get(workbenchSessionId);
    if (session && session.sessionCapabilityToken === token) {
      session.status = 'CLOSED';
      session.sessionCapabilityToken = ''; // invalidate
      this.sessions.delete(workbenchSessionId);
    }
  }
}

export class WorkbenchPathValidator {
  public static verifyContainment(targetPath: string, allowedRoot: string): string {
    if (targetPath.indexOf('\0') !== -1) {
      throw new Error('INVALID_PATH');
    }

    let current = path.resolve(targetPath);
    while (!fs.existsSync(current) && current !== path.dirname(current)) {
      current = path.dirname(current);
    }

    let realTargetParent = current;
    if (fs.existsSync(current)) {
      realTargetParent = fs.realpathSync.native(current);
    }

    const realRoot = fs.existsSync(allowedRoot) ? fs.realpathSync.native(allowedRoot) : path.resolve(allowedRoot);

    if (!realTargetParent.startsWith(realRoot + path.sep) && realTargetParent !== realRoot) {
      throw new Error('INVALID_PATH'); // Traversal outside root
    }

    const relativePart = path.relative(current, path.resolve(targetPath));
    if (relativePart.includes('..')) {
      throw new Error('INVALID_PATH');
    }

    return path.resolve(targetPath);
  }
}

export class WorkbenchApprovalResolver {
  public static verifyApproval(approvalId: string | undefined, session: RegisteredSession, riskLevel?: string): void {
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      if (!approvalId) {
        throw new Error('BLOCKED_BY_APPROVAL_INTEGRATION');
      }
      if (approvalId === 'INVALID' || approvalId === 'EXPIRED') {
        throw new Error('BLOCKED_BY_APPROVAL_INTEGRATION');
      }
    }
  }
}
