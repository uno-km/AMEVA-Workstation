import { describe, it, expect } from 'vitest';
import { WorkbenchSessionManager } from '../../workbench/session/WorkbenchSessionManager';
import { WorkContract } from '../../workbench/domain/WorkbenchTypes';

describe('Phase6.1 WorkbenchSession', () => {
  const baseContract: WorkContract = {
    objective: 'Test objective',
    workbenchType: 'CODE',
    requiredInputs: [],
    expectedOutputs: ['output.txt'],
    acceptanceCriteria: ['pass tests'],
    requiredChecks: ['FORMAT', 'LINT'],
    allowedFiles: ['src/'],
    protectedFiles: ['src/protected.ts'],
    allowedTools: ['write_file'],
    approvalRequirements: [],
    executionPolicy: 'strict',
    completionPolicy: 'all_passed'
  };

  it('should prevent DECLARED -> RUNNING transition directly', () => {
    const session = WorkbenchSessionManager.createSession('m1', 't1', 'a1', baseContract, '/tmp/src');
    expect(() => WorkbenchSessionManager.start(session)).toThrow(/Invalid state transition/);
  });

  it('should distinguish CODE, DOCUMENT, MIXED workbench types', () => {
    const codeSession = WorkbenchSessionManager.createSession('m1', 't1', 'a1', baseContract, '/tmp/src');
    expect(codeSession.workbenchType).toBe('CODE');

    const docContract = { ...baseContract, workbenchType: 'DOCUMENT' as const };
    const docSession = WorkbenchSessionManager.createSession('m1', 't1', 'a2', docContract, '/tmp/src');
    expect(docSession.workbenchType).toBe('DOCUMENT');
  });

  it('should enforce WorkContract validation on creation', () => {
    const invalidContract = { ...baseContract, objective: '' };
    expect(() => WorkbenchSessionManager.createSession('m1', 't1', 'a1', invalidContract, '/tmp/src'))
      .toThrow(/objective cannot be empty/);
  });

  it('should detect allowedFiles and protectedFiles conflict', () => {
    const conflictContract = { ...baseContract, allowedFiles: ['src/file.ts'], protectedFiles: ['src/file.ts'] };
    expect(() => WorkbenchSessionManager.createSession('m1', 't1', 'a1', conflictContract, '/tmp/src'))
      .toThrow(/Conflict between allowed and protected files/);
  });
});
