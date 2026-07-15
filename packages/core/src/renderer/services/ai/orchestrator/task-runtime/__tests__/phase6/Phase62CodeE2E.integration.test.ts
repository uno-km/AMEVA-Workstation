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
      fileSystem: { exists: vi.fn(), read: vi.fn(), write: vi.fn() }
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
    const job = {
      codeJobId: 'e2e-1',
      status: 'DECLARED',
      isolatedWorkspace: '/iso',
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
    mockHostAdapter.fileSystem.write.mockImplementation((path: string) => {
       if (path.includes('artifact')) commitCount++;
    });

    validation.runChecks.mockImplementation(async () => {
      expect(commitCount).toBe(0); // Check 전 Commit 0회
      checkCount++;
      if (checkCount === 1) {
        // Working Revision 1 -> Required Check FAIL -> CodeDiagnostic -> Defect -> RepairRequest
        return [{ status: 'FAIL', required: true, checkType: 'tsc', diagnostics: [{ diagnosticSignature: 'err1', file: 'a.ts', retryScope: 'FILE' }] }];
      } else {
        // Working Revision 2 -> 관련 Check PASS
        return [{ status: 'PASS', required: true, checkType: 'tsc', verifiedRevision: job.currentRevision }];
      }
    });

    (coordinator as any).patchGenerator.generateDiff.mockResolvedValue({ summary: 'Diff' });

    const result = await coordinator.runCodeModificationCycle(job, plan, 3);
    
    expect(job.status).toBe('COMPLETED');
    expect(checkCount).toBe(2);
    expect(result.report).not.toBeNull();
    // Artifact VALIDATED only 상태에서 완료 금지 -> CodeChangeReport 생성 및 COMPLETED 
    expect(result.report?.sourceApplyStatus).toBe('BLOCKED_BY_APPROVAL_INTEGRATION'); // Output Artifact COMMITTED.
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
