import { describe, it, expect, beforeEach } from 'vitest';
import { CodeRepairCoordinator } from '../../workbench/execution/CodeRepairCoordinator';
import { CodeRepairPolicy } from '../../workbench/domain/WorkbenchTypes';

describe('Phase 6.2.2: Repair Loop NO_PROGRESS', () => {
  it('1. stops the same repair strategy when configured diagnostic repeat limit is reached (limit = 2)', async () => {
    const policy: CodeRepairPolicy = {
      maxSameDiagnosticRepeats: 2,
      maxRepairAttempts: 10,
      minimumDiagnosticImprovement: 1,
      minimumCheckImprovement: 1,
      stopOnSameHash: false,
      allowStrategyChange: false
    };
    const coordinator = new CodeRepairCoordinator(policy);

    const job = { currentRevision: 'rev-1' } as any;
    const checkResult = {
      checkId: 'c1',
      status: 'FAIL',
      diagnostics: [
        { signature: 'tsc:typecheck:TS2322:src/index.ts:10', file: 'src/index.ts', retryScope: 'FILE' }
      ]
    } as any;

    await coordinator.createRepairRequests(job, [checkResult], 'hash-1'); // count = 1
    await expect(coordinator.createRepairRequests(job, [checkResult], 'hash-2')).rejects.toThrow('NO_PROGRESS'); // count = 2 -> throws because >= 2
  });

  it('2. stops the same repair strategy when configured diagnostic repeat limit is reached (limit = 4)', async () => {
    const policy: CodeRepairPolicy = {
      maxSameDiagnosticRepeats: 4,
      maxRepairAttempts: 10,
      minimumDiagnosticImprovement: 1,
      minimumCheckImprovement: 1,
      stopOnSameHash: false,
      allowStrategyChange: false
    };
    const coordinator = new CodeRepairCoordinator(policy);

    const job = { currentRevision: 'rev-1' } as any;
    const checkResult = {
      checkId: 'c1',
      status: 'FAIL',
      diagnostics: [
        { signature: 'tsc:typecheck:TS2322:src/index.ts:10', file: 'src/index.ts', retryScope: 'FILE' }
      ]
    } as any;

    await coordinator.createRepairRequests(job, [checkResult], 'hash-1'); // 1
    await coordinator.createRepairRequests(job, [checkResult], 'hash-2'); // 2
    await coordinator.createRepairRequests(job, [checkResult], 'hash-3'); // 3
    await expect(coordinator.createRepairRequests(job, [checkResult], 'hash-4')).rejects.toThrow('NO_PROGRESS'); // 4
  });

  it('3. Throws if stopOnSameHash is true and hash is same', async () => {
     const policy: CodeRepairPolicy = {
      maxSameDiagnosticRepeats: 4,
      maxRepairAttempts: 10,
      minimumDiagnosticImprovement: 1,
      minimumCheckImprovement: 1,
      stopOnSameHash: true, // This is true
      allowStrategyChange: false
    };
    const coordinator = new CodeRepairCoordinator(policy);
    const job = { currentRevision: 'rev-1' } as any;
    const checkResult = {
      checkId: 'c1', status: 'FAIL',
      diagnostics: [ { signature: 'tsc', file: 'src/index.ts', retryScope: 'FILE' } ]
    } as any;

    await coordinator.createRepairRequests(job, [checkResult], 'hash-same'); // 1
    await expect(coordinator.createRepairRequests(job, [checkResult], 'hash-same')).rejects.toThrow('NO_PROGRESS: Identical artifact hash'); // Same hash
  });

  it('4. Resets repeat count if progress is made (fewer diagnostics)', async () => {
    const policy: CodeRepairPolicy = {
      maxSameDiagnosticRepeats: 2, maxRepairAttempts: 10,
      minimumDiagnosticImprovement: 1, minimumCheckImprovement: 1,
      stopOnSameHash: false, allowStrategyChange: false
    };
    const coordinator = new CodeRepairCoordinator(policy);
    const job = { currentRevision: 'rev-1' } as any;
    
    // First try: 2 diagnostics
    let checkResult = { checkId: 'c1', status: 'FAIL', diagnostics: [ { signature: 'tsc', file: 'a.ts' }, { signature: 'tsc', file: 'b.ts' } ] } as any;
    await coordinator.createRepairRequests(job, [checkResult], 'hash-1'); 
    
    // Second try: 1 diagnostic (PROGRESS MADE!)
    checkResult = { checkId: 'c1', status: 'FAIL', diagnostics: [ { signature: 'tsc', file: 'a.ts' } ] } as any;
    await coordinator.createRepairRequests(job, [checkResult], 'hash-2');
    
    // Third try: still 1 diagnostic (count is 2 -> throws!)
    await expect(coordinator.createRepairRequests(job, [checkResult], 'hash-3')).rejects.toThrow('NO_PROGRESS');
  });

  it('5. Allows strategy change up to maxStrategyChanges before throwing', async () => {
    const policy: CodeRepairPolicy = {
      maxSameDiagnosticRepeats: 2, maxRepairAttempts: 10,
      minimumDiagnosticImprovement: 1, minimumCheckImprovement: 1,
      stopOnSameHash: false, allowStrategyChange: true, maxStrategyChanges: 1
    };
    const coordinator = new CodeRepairCoordinator(policy);
    const job = { currentRevision: 'rev-1' } as any;
    const checkResult = { checkId: 'c1', status: 'FAIL', diagnostics: [ { signature: 'tsc', file: 'a.ts' } ] } as any;

    await coordinator.createRepairRequests(job, [checkResult], 'hash-1'); // count 1 ("tsc")
    await coordinator.createRepairRequests(job, [checkResult], 'hash-2'); // count 2 -> triggers strategy change (allowed), count reset to 1
    
    await expect(coordinator.createRepairRequests(job, [checkResult], 'hash-3')).rejects.toThrow('NO_PROGRESS: Maximum strategy changes reached (1).');
  });
});
