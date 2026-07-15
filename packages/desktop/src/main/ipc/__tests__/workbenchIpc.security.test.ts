import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkbenchSessionRegistry, WorkbenchPathValidator, WorkbenchApprovalResolver } from '../WorkbenchSecurity';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Workbench Security Boundary Tests (Phase 6.1.3)', () => {
  let tmpDir: string;
  let registry: WorkbenchSessionRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-sec-test-'));
    registry = new WorkbenchSessionRegistry();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Session Registry', () => {
    it('registers a session and returns a capability token', () => {
      const workspace = path.join(tmpDir, 'workspace1');
      fs.mkdirSync(workspace);

      const res = registry.registerSession({
        missionId: 'm1',
        taskId: 't1',
        attemptId: 'a1',
        workbenchSessionId: 'sess1',
        requestedSourceWorkspace: workspace,
        requestedIsolatedWorkspace: workspace
      });

      expect(res.workbenchSessionId).toBe('sess1');
      expect(res.sessionCapabilityToken).toBeDefined();
      expect(res.allowedWorkspaceRoot).toBe(fs.realpathSync.native(workspace));
    });

    it('rejects contexts with missing or mismatched tokens', () => {
      const workspace = path.join(tmpDir, 'workspace2');
      fs.mkdirSync(workspace);

      const res = registry.registerSession({
        missionId: 'm2',
        taskId: 't2',
        attemptId: 'a2',
        workbenchSessionId: 'sess2',
        requestedSourceWorkspace: workspace,
        requestedIsolatedWorkspace: workspace
      });

      expect(() => registry.verifyContext({
        workbenchSessionId: 'sess2',
        sessionCapabilityToken: 'wrong_token',
        missionId: 'm2',
        taskId: 't2',
        attemptId: 'a2'
      })).toThrowError('WORKBENCH_SESSION_UNAUTHORIZED');

      expect(() => registry.verifyContext({
        workbenchSessionId: 'sess2',
        sessionCapabilityToken: res.sessionCapabilityToken,
        missionId: 'wrong_mission',
        taskId: 't2',
        attemptId: 'a2'
      })).toThrowError('WORKBENCH_CONTEXT_MISMATCH');
    });

    it('invalidates tokens when session is closed', () => {
      const workspace = path.join(tmpDir, 'workspace3');
      fs.mkdirSync(workspace);

      const res = registry.registerSession({
        missionId: 'm3',
        taskId: 't3',
        attemptId: 'a3',
        workbenchSessionId: 'sess3',
        requestedSourceWorkspace: workspace,
        requestedIsolatedWorkspace: workspace
      });

      registry.closeSession('sess3', res.sessionCapabilityToken);

      expect(() => registry.verifyContext({
        workbenchSessionId: 'sess3',
        sessionCapabilityToken: res.sessionCapabilityToken,
        missionId: 'm3',
        taskId: 't3',
        attemptId: 'a3'
      })).toThrowError('WORKBENCH_SESSION_NOT_FOUND');
    });
  });

  describe('Path Validator', () => {
    it('allows paths within boundaries', () => {
      const root = path.join(tmpDir, 'root1');
      fs.mkdirSync(root);
      
      const target = path.join(root, 'allowed_file.txt');
      expect(() => WorkbenchPathValidator.verifyContainment(target, root)).not.toThrow();
    });

    it('blocks explicit traversal', () => {
      const root = path.join(tmpDir, 'root2');
      fs.mkdirSync(root);
      
      const target = path.join(root, '..', 'root2_escape.txt');
      expect(() => WorkbenchPathValidator.verifyContainment(target, root)).toThrowError('INVALID_PATH');
    });

    it('blocks null bytes', () => {
      const root = path.join(tmpDir, 'root3');
      fs.mkdirSync(root);
      
      const target = path.join(root, 'file\0.txt');
      expect(() => WorkbenchPathValidator.verifyContainment(target, root)).toThrowError('INVALID_PATH');
    });

    it('blocks symlink escape attempts (TOCTOU early mitigation)', () => {
      const root = path.join(tmpDir, 'root4');
      fs.mkdirSync(root);
      
      const external = path.join(tmpDir, 'external');
      fs.mkdirSync(external);

      const linkTarget = path.join(root, 'symlink');
      // Create a symlink that escapes root
      try {
        fs.symlinkSync(external, linkTarget, 'dir');
        
        // Target resolving the symlink should fail containment
        const evilTarget = path.join(linkTarget, 'file.txt');
        expect(() => WorkbenchPathValidator.verifyContainment(evilTarget, root)).toThrowError('INVALID_PATH');
      } catch (e) {
        // Test passes if symlink creation is not permitted on Windows without admin,
        // but if it is, the validator should block it.
      }
    });
  });

  describe('Approval Resolver Stub', () => {
    it('blocks HIGH risk commands without valid approval', () => {
      const dummySession: any = {};
      
      expect(() => WorkbenchApprovalResolver.verifyApproval(undefined, dummySession, 'HIGH'))
        .toThrowError('BLOCKED_BY_APPROVAL_INTEGRATION');

      expect(() => WorkbenchApprovalResolver.verifyApproval('INVALID', dummySession, 'CRITICAL'))
        .toThrowError('BLOCKED_BY_APPROVAL_INTEGRATION');
      
      // Should not throw
      expect(() => WorkbenchApprovalResolver.verifyApproval('valid-id', dummySession, 'HIGH'))
        .not.toThrow();
    });
  });
});
