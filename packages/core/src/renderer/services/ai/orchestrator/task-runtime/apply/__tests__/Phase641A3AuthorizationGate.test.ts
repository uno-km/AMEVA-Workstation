import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import crypto from 'crypto';
import { SourceApplyDigestService } from '../SourceApplyDigestService';
import { ApprovalRepositoryInMemory, ArtifactRepositoryInMemory } from '../../persistence/InMemoryRepositories';
import { ExecutionTraceManager } from '../../trace/ExecutionTraceManager';

describe('Phase 6.4.1A-3: Authorization Gate Atomicity', () => {
  let approvalRepo: ApprovalRepositoryInMemory;
  let artifactRepo: ArtifactRepositoryInMemory;
  let traceManager: ExecutionTraceManager;
  let testRoot: string;
  let allowedWorkspaceRoot: string;

  beforeEach(async () => {
    approvalRepo = new ApprovalRepositoryInMemory();
    artifactRepo = new ArtifactRepositoryInMemory();
    traceManager = new ExecutionTraceManager();

    testRoot = path.join(__dirname, 'test-gate-' + crypto.randomUUID());
    allowedWorkspaceRoot = path.join(testRoot, 'workspace');
    await fsp.mkdir(allowedWorkspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('MUST use single authorization path compareAndReserveApproval ensuring ONLY 1 success among 10 concurrent requests', async () => {
    const targetFilePath = path.join(allowedWorkspaceRoot, 'test-file.txt');
    await fsp.writeFile(targetFilePath, 'Content');

    const affectedPaths = ['test-file.txt'];
    const digestBefore = await SourceApplyDigestService.createSourceDigest(allowedWorkspaceRoot, affectedPaths);
    
    const previewId = 'preview-1';
    const approvalId = 'approval-1';
    const artifactId = 'artifact-1';

    const mockPreview = {
      requestId: 'req-1',
      artifactId: artifactId,
      artifactRevision: 1,
      sourceDigest: digestBefore,
      artifactDigest: 'hash',
      addedFiles: [],
      modifiedFiles: ['test-file.txt'],
      deletedFiles: [],
      renamedCandidates: [],
      changedSymbols: [],
      changedRanges: [],
      protectedPathViolations: [],
      conflicts: [],
      riskLevel: 'MEDIUM',
      approvalRequired: true,
      requiredChecks: [],
      previewDigest: 'p-digest',
      affectedPaths
    };
    
    mockPreview.previewDigest = SourceApplyDigestService.createPreviewDigest(mockPreview as any);
    const operationDigest = SourceApplyDigestService.createOperationDigest(mockPreview as any);
    const affectedPathsDigest = SourceApplyDigestService.createAffectedPathsDigest(mockPreview.affectedPaths);

    await approvalRepo.saveApprovalRecord({
      approvalId,
      status: 'APPROVED',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'ws1',
      previewId,
      repositoryArtifactId: artifactId,
      artifactRevision: 1,
      sourceWorkspaceId: 'workspace1',
      sourceDigest: digestBefore,
      previewDigest: mockPreview.previewDigest,
      operationDigest: operationDigest,
      affectedPathsDigest: affectedPathsDigest,
      artifactDigest: 'hash',
      riskLevel: 'MEDIUM',
      expiresAt: Date.now() + 100000
    } as any);

    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(approvalRepo.compareAndReserveApproval({
        approvalId,
        sourceApplyRequestId: `req-${i}`,
        sourceApplyOperationId: `op-${i}`,
        missionId: 'm1',
        taskId: 't1',
        attemptId: 'a1',
        workbenchSessionId: 'ws1',
        repositoryArtifactId: artifactId,
        artifactRevision: 1,
        sourceWorkspaceId: 'workspace1',
        sourceDigest: digestBefore,
        previewDigest: mockPreview.previewDigest,
        operationDigest: operationDigest,
        affectedPathsDigest: affectedPathsDigest,
        riskLevel: 'MEDIUM',
        now: Date.now()
      }));
    }

    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    console.log(`[Atomic Reservation Proof] Concurrent attempts: 10`);
    console.log(`[Atomic Reservation Proof] Successes: ${successes.length}`);
    console.log(`[Atomic Reservation Proof] Failures:  ${failures.length}`);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);
    
    for (const f of failures) {
      expect(f.errorCode).toBe('APPROVAL_ALREADY_RESERVED');
    }
  });
});
