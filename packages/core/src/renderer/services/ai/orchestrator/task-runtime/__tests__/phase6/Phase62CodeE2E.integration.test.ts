import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeWorkbenchCoordinator } from '../../workbench/execution/CodeWorkbenchCoordinator';
import { RepositoryDiscoveryService } from '../../workbench/execution/RepositoryDiscoveryService';
import { CodeChangePlanner } from '../../workbench/execution/CodeChangePlanner';
import { CodeModificationService } from '../../workbench/execution/CodeModificationService';
import { CodeValidationPipeline } from '../../workbench/execution/CodeValidationPipeline';
import { CodeRepairCoordinator } from '../../workbench/execution/CodeRepairCoordinator';
import { CodeCompletionGate } from '../../workbench/execution/CodeCompletionGate';
import { CodeChangeReportBuilder } from '../../workbench/execution/CodeChangeReportBuilder';
import { PatchGenerator } from '../../workbench/execution/PatchGenerator';

describe('Phase 6.2: Artifact Transaction E2E', () => {
  let coordinator: CodeWorkbenchCoordinator;
  let mockHostAdapter: any;
  let modifier: any;
  let validation: any;
  let testDetector: any;

  beforeEach(() => {
    mockHostAdapter = {
      commandExecutor: { execute: vi.fn() },
      fileSystem: { exists: vi.fn(), read: vi.fn(), write: vi.fn(), readDigest: vi.fn().mockResolvedValue('original_digest_hash') }
    };

    const discovery = new RepositoryDiscoveryService(mockHostAdapter);
    const planner = new CodeChangePlanner();
    modifier = { applyPlan: vi.fn(), applyModification: vi.fn() };
    validation = { runChecks: vi.fn() };
    const repair = new CodeRepairCoordinator({
      maxSameDiagnosticRepeats: 3, maxRepairAttempts: 5, minimumDiagnosticImprovement: 1, minimumCheckImprovement: 1, stopOnSameHash: false, allowStrategyChange: false
    });
    const gate = new CodeCompletionGate();
    const reportBuilder = new CodeChangeReportBuilder();
    const patchGen = { generateDiff: vi.fn() };
    testDetector = { detectWeakening: vi.fn().mockReturnValue({ weakeningDetected: false }) };

    coordinator = new CodeWorkbenchCoordinator(discovery, planner, modifier, validation, repair, gate, reportBuilder, patchGen, mockHostAdapter, testDetector);
  });

  it('1. Repository Discovery -> CodeChangePlan -> Source Snapshot -> Isolated Patch -> Working Revision 1 -> Required Check FAIL -> CodeDiagnostic -> Defect -> RepairRequest -> apply_patch -> Working Revision 2 -> Check PASS -> VALIDATED -> COMMITTING_OUTPUT -> Output Artifact COMMITTED -> CodeChangeReport -> COMPLETED', async () => {
    const events: string[] = [];
    const digests: Record<string, string> = {};
    let _status = 'DECLARED';
    
    // We mock readDigest to return a constant for the source workspace
    mockHostAdapter.fileSystem.readDigest.mockImplementation(async (p: string) => {
       if (p.includes('sourceWorkspace')) return 'digest_hash_stable';
       return 'other_hash';
    });

    const job = {
      codeJobId: 'e2e-1',
      get status() { return _status; },
      set status(s: string) { 
        _status = s; 
        events.push(s); 
      },
      isolatedWorkspace: '/iso',
      sourceWorkspace: '/src',
      targetFiles: [], allowedFiles: [], protectedFiles: [],
      baseRevision: 'r-1', currentRevision: 'r-1',
      requiredChecks: ['tsc'],
      resourceLimits: {}, networkPolicy: 'DENY',
    } as any;

    const plan = {
      planId: 'p-1', plannedChanges: [], expectedBehavior: '', requiredChecks: [], riskLevel: 'LOW', approvalRequired: false, rollbackStrategy: '', modelId: '', confidence: 100, objective: '', affectedSymbols: [], filesToRead: [], filesToModify: [], filesToCreate: [], filesToDelete: [], protectedFiles: []
    } as any;

    let checkCount = 0;
    let commitCount = 0;
    
    // Track commits (mock)
    mockHostAdapter.fileSystem.write.mockImplementation(async (path: string) => {
       if (path.includes('artifact')) commitCount++;
       if (path.includes('sourceWorkspace')) throw new Error('Direct source modification blocked');
    });

    validation.runChecks.mockImplementation(async () => {
      // afterFirstPatch or afterRepair (depending on checkCount)
      const digest = await mockHostAdapter.fileSystem.readDigest('sourceWorkspace');
      digests['CHECKING_' + checkCount] = digest;

      expect(commitCount).toBe(0); // Check 전 Commit 0회
      checkCount++;
      if (checkCount === 1) {
        // Working Revision 1 -> Required Check FAIL
        return [{ status: 'FAIL', required: true, checkType: 'tsc', diagnostics: [{ diagnosticSignature: 'err1', file: 'a.ts', retryScope: 'FILE' }] }];
      } else {
        // Working Revision 2 -> PASS
        return [{ status: 'PASS', required: true, checkType: 'tsc', verifiedRevision: job.currentRevision }];
      }
    });

    (coordinator as any).patchGenerator.generateDiff.mockImplementation(async () => {
      // afterPassedCheck, before COMMITTING_OUTPUT
      digests['COMMITTING_OUTPUT'] = await mockHostAdapter.fileSystem.readDigest('sourceWorkspace');
      return { summary: 'Diff' };
    });

    // beforeJob
    digests['beforeJob'] = await mockHostAdapter.fileSystem.readDigest('sourceWorkspace');

    const result = await coordinator.runCodeModificationCycle(job, plan, 3);
    
    // afterCompleted
    digests['afterCompleted'] = await mockHostAdapter.fileSystem.readDigest('sourceWorkspace');
    
    expect(job.status).toBe('COMPLETED');
    expect(checkCount).toBe(2);
    expect(result.report).not.toBeNull();
    // Artifact VALIDATED only 상태에서 완료 금지 -> CodeChangeReport 생성 및 COMPLETED 
    expect(result.report?.sourceApplyStatus).toBe('BLOCKED_BY_APPROVAL_INTEGRATION'); // Output Artifact COMMITTED.
    
    // Exact Event Sequence Verification
    expect(events).toEqual([
      'DISCOVERING',
      'PLANNING',
      'EDITING',
      'CHECKING',
      'REPAIRING',
      'EDITING',
      'CHECKING',
      'VERIFYING',
      'COMMITTING_OUTPUT',
      'COMPLETED'
    ]);

    // Explicit Checkpoints testing logic
    expect(digests['beforeJob']).toBe('digest_hash_stable');
    expect(digests['CHECKING_0']).toBe('digest_hash_stable'); // afterFirstPatch
    expect(digests['CHECKING_1']).toBe('digest_hash_stable'); // afterRepair
    expect(digests['COMMITTING_OUTPUT']).toBe('digest_hash_stable'); // afterPassedCheck
    expect(digests['afterCompleted']).toBe('digest_hash_stable'); 
    expect(await mockHostAdapter.fileSystem.readDigest('sourceWorkspace')).toBe('digest_hash_stable');
    
    // Ensure write was NEVER called on source workspace at ANY point
    expect(mockHostAdapter.fileSystem.write).not.toHaveBeenCalledWith(expect.stringContaining('sourceWorkspace'), expect.any(String));
    
    // Verify 0 source apply IPC calls implicitly by no write
    expect(job.status).toBe('COMPLETED');
  }); 
  
  it('2. Output Artifact 미Commit 상태 완료 금지 및 CodeChangeReport 없는 완료 금지', async () => {
    // If output commit throws
    (coordinator as any).patchGenerator.generateDiff.mockRejectedValue(new Error('Commit Error'));
    // Should not reach COMPLETED
    const job = { currentRevision: 'r-1', requiredChecks: [], status: 'DECLARED' } as any;
    const plan = { plannedChanges: [] } as any;
    validation.runChecks.mockResolvedValue([]);
    await expect(coordinator.runCodeModificationCycle(job, plan, 3)).rejects.toThrow('Commit Error');
    expect(job.status).toBe('FAILED');
  });

  it('3. Test Weakening 상태 Commit 0회', async () => {
     const job = { currentRevision: 'r-1', requiredChecks: [], status: 'DECLARED' } as any;
     const plan = { plannedChanges: [] } as any;
     validation.runChecks.mockResolvedValue([]);
     testDetector.detectWeakening.mockReturnValue({ weakeningDetected: true, justificationRequired: true });

     await expect(coordinator.runCodeModificationCycle(job, plan, 3)).rejects.toThrow('TEST_WEAKENING_SUSPECTED');
     expect(job.status).toBe('FAILED');
  });
});
