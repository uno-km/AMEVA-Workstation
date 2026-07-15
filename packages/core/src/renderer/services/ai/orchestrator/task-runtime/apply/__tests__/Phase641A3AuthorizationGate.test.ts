import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import crypto from 'crypto';
import { SourceApplyDigestService } from '../SourceApplyDigestService';
import { SourceApplyService } from '../../../../../../../../desktop/src/main/services/SourceApplyService';
import { ApprovalRepositoryInMemory, ArtifactRepositoryInMemory } from '../persistence/InMemoryRepositories';
import { ExecutionTraceManager } from '../trace/ExecutionTraceManager';

describe('Phase 6.4.1A-3: Authorization Gate Atomicity', () => {
  let service: SourceApplyService;
  let approvalRepo: ApprovalRepositoryInMemory;
  let previewRepo: any;
  let artifactRepo: ArtifactRepositoryInMemory;
  let traceManager: ExecutionTraceManager;
  let testRoot: string;
  let allowedWorkspaceRoot: string;

  beforeEach(async () => {
    approvalRepo = new ApprovalRepositoryInMemory();
    artifactRepo = new ArtifactRepositoryInMemory();
    traceManager = new ExecutionTraceManager();
    previewRepo = {
      updatePreviewStatus: vi.fn(),
      getPreview: vi.fn()
    };

    service = new SourceApplyService(approvalRepo, previewRepo, artifactRepo, traceManager);

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
    const digestBefore = await SourceApplyDigestService.computeSourceDigest(allowedWorkspaceRoot, affectedPaths);
    
    const previewId = 'preview-1';
    const approvalId = 'approval-1';
    const artifactId = 'artifact-1';

    await artifactRepo.saveRepositoryArtifact({
      repositoryArtifactId: artifactId,
      missionId: 'm1',
      revision: 1,
      contentHash: 'hash',
      logicalPath: 'test-file.txt',
      createdAt: Date.now(),
      status: 'AVAILABLE',
      storageReference: 'none'
    } as any);

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
    
    // We must mock the recomputed values exactly
    mockPreview.previewDigest = SourceApplyDigestService.computePreviewDigest(mockPreview as any);
    const operationDigest = SourceApplyDigestService.computeOperationDigest(mockPreview as any);
    const affectedPathsDigest = SourceApplyDigestService.computeAffectedPathsDigest(mockPreview.affectedPaths);
    const artifactDigest = SourceApplyDigestService.computeArtifactDigest(1, 'hash');

    previewRepo.getPreview.mockResolvedValue(mockPreview);

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
      artifactDigest: artifactDigest,
      riskLevel: 'MEDIUM',
      expiresAt: Date.now() + 100000
    } as any);

    // Run 10 concurrent authorizations
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(service.authorizeOperation({
        approvalId,
        previewId,
        sourceApplyRequestId: `req-${i}`,
        sourceApplyOperationId: `op-${i}`,
        missionId: 'm1',
        taskId: 't1',
        attemptId: 'a1',
        workbenchSessionId: 'ws1',
        repositoryArtifactId: artifactId,
        artifactRevision: 1,
        sourceWorkspaceReference: 'workspace1',
        sessionCapabilityToken: 'token'
      }, { allowedWorkspaceRoot }));
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
      expect(f.errorCode).toBe('APPROVAL_INVALIDATED');
    }
  });
});
