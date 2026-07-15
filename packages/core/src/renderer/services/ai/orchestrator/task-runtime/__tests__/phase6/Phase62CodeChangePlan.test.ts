import { describe, it, expect } from 'vitest';
import { CodeChangePlanner } from '../../workbench/execution/CodeChangePlanner';
import { CodeChangePlan, CodeWorkbenchJob } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2: Code Change Plan Validation', () => {
  const planner = new CodeChangePlanner();

  const dummyJob: CodeWorkbenchJob = {
    codeJobId: 'job-1',
    workbenchSessionId: 'sess-1',
    missionId: 'm-1',
    taskId: 't-1',
    attemptId: 'a-1',
    objective: 'Test',
    repositoryRoot: '/repo',
    isolatedWorkspace: '/iso',
    baseRevision: 'r-0',
    sourceDigest: 'd-0',
    targetFiles: [],
    allowedFiles: ['src/'],
    protectedFiles: ['src/protected.ts'],
    expectedChanges: [],
    acceptanceCriteria: [],
    requiredChecks: [],
    commandPolicy: 'STRICT',
    networkPolicy: 'DENY',
    resourceLimits: {} as any,
    routingProfile: 'CODE_EDIT',
    status: 'PLANNING',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('1. Rejects unallowed files', () => {
    const plan: CodeChangePlan = {
      planId: 'p1', objective: 'A', affectedSymbols: [], filesToRead: [], filesToModify: [], filesToCreate: [], filesToDelete: [], protectedFiles: [],
      plannedChanges: [
        {
          changeId: 'c1', targetFile: 'dist/bundle.js', scope: 'FILE', changeType: 'UPDATE', rationale: '', expectedBehavior: '', sourceRevision: 'r-0', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
        }
      ],
      expectedBehavior: '', requiredChecks: [], riskLevel: 'LOW', approvalRequired: false, rollbackStrategy: '', modelId: '', confidence: 100
    };

    const res = planner.validatePlan(plan, dummyJob);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('UNPLANNED_CHANGE_DETECTED');
  });

  it('2. Rejects protected files', () => {
    const plan: CodeChangePlan = {
      planId: 'p1', objective: 'A', affectedSymbols: [], filesToRead: [], filesToModify: [], filesToCreate: [], filesToDelete: [], protectedFiles: [],
      plannedChanges: [
        {
          changeId: 'c1', targetFile: 'src/protected.ts', scope: 'FILE', changeType: 'UPDATE', rationale: '', expectedBehavior: '', sourceRevision: 'r-0', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
        }
      ],
      expectedBehavior: '', requiredChecks: [], riskLevel: 'LOW', approvalRequired: false, rollbackStrategy: '', modelId: '', confidence: 100
    };

    const res = planner.validatePlan(plan, dummyJob);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('PROTECTED_FILE_VIOLATION');
  });

  it('3. Rejects revision mismatch', () => {
    const plan: CodeChangePlan = {
      planId: 'p1', objective: 'A', affectedSymbols: [], filesToRead: [], filesToModify: [], filesToCreate: [], filesToDelete: [], protectedFiles: [],
      plannedChanges: [
        {
          changeId: 'c1', targetFile: 'src/valid.ts', scope: 'FILE', changeType: 'UPDATE', rationale: '', expectedBehavior: '', sourceRevision: 'r-OLD', expectedOldHash: '', allowedRanges: [], protectedRanges: [], requiredChecks: [], dependencies: [], riskLevel: 'LOW'
        }
      ],
      expectedBehavior: '', requiredChecks: [], riskLevel: 'LOW', approvalRequired: false, rollbackStrategy: '', modelId: '', confidence: 100
    };

    const res = planner.validatePlan(plan, dummyJob);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('REVISION_MISMATCH');
  });
});
