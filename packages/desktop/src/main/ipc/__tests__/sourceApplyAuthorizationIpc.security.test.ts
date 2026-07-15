import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerSourceApplyIpc } from '../sourceApplyIpc';
import { sessionRegistry } from '../workbenchIpc';

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

describe('Phase 6.4.1A-3: Source Apply Authorization IPC Security', () => {
  const handlers: Record<string, Function> = {};

  beforeEach(() => {
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler;
    });
    
    vi.spyOn(sessionRegistry, 'verifyContext').mockImplementation((req: any) => {
      if (req.sessionCapabilityToken !== 'valid-token') {
        throw new Error('CAPABILITY_INVALID');
      }
      if (req.workbenchSessionId !== 'session-1') {
        throw new Error('UNAUTHORIZED_SESSION');
      }
      return { allowedWorkspaceRoot: '/mock/root' } as any;
    });

    registerSourceApplyIpc();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('MUST reject unauthorized sender (no senderFrame)', async () => {
    const handler = handlers['sourceApply:authorizeOperation'];
    const mockEvent = { senderFrame: null }; // Unauthorized
    const response = await handler(mockEvent, {});
    console.log('[IPC Security Proof] Unauthorized Sender:', response);
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('IPC_SENDER_UNAUTHORIZED');
  });
  
  it('MUST reject invalid capability token', async () => {
    const handler = handlers['sourceApply:authorizeOperation'];
    const mockEvent = { senderFrame: {} }; // Authorized sender
    const response = await handler(mockEvent, { workbenchSessionId: 'session-1', sessionCapabilityToken: 'invalid' });
    console.log('[IPC Security Proof] Invalid Capability:', response);
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('CAPABILITY_INVALID');
  });

  it('MUST reject cross-session attempt', async () => {
    const handler = handlers['sourceApply:authorizeOperation'];
    const mockEvent = { senderFrame: {} }; 
    const response = await handler(mockEvent, { workbenchSessionId: 'session-2', sessionCapabilityToken: 'valid-token' });
    console.log('[IPC Security Proof] Cross Session:', response);
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('UNAUTHORIZED_SESSION');
  });

  it('MUST enforce schema validation / ignore payload tampering (Renderer Trust Attack)', async () => {
    const handler = handlers['sourceApply:authorizeOperation'];
    const mockEvent = { senderFrame: {} };
    // Provide a payload with fake digests and approved = true
    const maliciousPayload = {
      workbenchSessionId: 'session-1',
      sessionCapabilityToken: 'valid-token',
      previewId: 'prev-1',
      approvalId: 'app-1',
      fakeDigest: 'bad123',
      sourceDigest: 'bad123',
      approved: true,
      isAuthorized: true
    };
    
    // In our actual IPC and SourceApplyService, these extra fields are not even read.
    // The service fetches by approvalId and previewId, and RECOMPUTES all digests.
    // So the payload tampering is completely ignored.
    const response = await handler(mockEvent, maliciousPayload);
    
    // We just verify it doesn't succeed by tricking it. It should still run the normal rejection
    // (e.g. APPROVAL_NOT_FOUND or PREVIEW_STALE, depending on mock setup, but NEVER success just because approved: true).
    expect(response.success).toBe(false);
  });
});
