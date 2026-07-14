import { describe, it, expect } from 'vitest';
import { WorkbenchSessionManager } from '../../workbench/session/WorkbenchSessionManager';
import { WorkContract } from '../../workbench/domain/WorkbenchTypes';

describe('Phase6.1 WorkContract', () => {
  const baseContract: WorkContract = {
    objective: 'Do work',
    workbenchType: 'CODE',
    requiredInputs: [],
    expectedOutputs: ['out'],
    acceptanceCriteria: ['pass'],
    requiredChecks: ['FORMAT'],
    allowedFiles: ['*'],
    protectedFiles: ['protected'],
    allowedTools: [],
    approvalRequirements: [],
    executionPolicy: '',
    completionPolicy: ''
  };

  it('should fail if expectedOutputs is empty', () => {
    expect(() => WorkbenchSessionManager.createSession('m1', 't1', 'a1', { ...baseContract, expectedOutputs: [] }, '/'))
      .toThrow(/expectedOutputs must be defined/);
  });

  it('should fail if requiredChecks is empty', () => {
    expect(() => WorkbenchSessionManager.createSession('m1', 't1', 'a1', { ...baseContract, requiredChecks: [] }, '/'))
      .toThrow(/requiredChecks must be defined/);
  });

  it('should fail if acceptanceCriteria is empty', () => {
    expect(() => WorkbenchSessionManager.createSession('m1', 't1', 'a1', { ...baseContract, acceptanceCriteria: [] }, '/'))
      .toThrow(/acceptanceCriteria must be defined/);
  });
});
