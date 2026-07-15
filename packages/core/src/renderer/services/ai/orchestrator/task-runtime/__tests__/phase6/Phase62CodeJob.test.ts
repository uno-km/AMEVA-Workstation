import { describe, it, expect } from 'vitest';
import { CodeWorkbenchJob } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2: CodeWorkbenchJob', () => {
  it('1. Initializes with DECLARED state', () => {
    const job: CodeWorkbenchJob = {
      codeJobId: 'job-1',
      workbenchSessionId: 'sess-1',
      missionId: 'm-1',
      taskId: 't-1',
      attemptId: 'a-1',
      objective: 'Fix bug',
      repositoryRoot: '/repo',
      isolatedWorkspace: '/iso',
      baseRevision: 'r-0',
      sourceDigest: 'd-0',
      targetFiles: [],
      allowedFiles: [],
      protectedFiles: [],
      expectedChanges: [],
      acceptanceCriteria: [],
      requiredChecks: [],
      commandPolicy: 'STRICT',
      networkPolicy: 'DENY',
      resourceLimits: {} as any,
      routingProfile: 'CODE_EDIT',
      status: 'DECLARED',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    expect(job.status).toBe('DECLARED');
  });
});
