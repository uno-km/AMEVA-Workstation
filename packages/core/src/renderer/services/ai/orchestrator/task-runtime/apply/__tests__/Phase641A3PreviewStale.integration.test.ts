import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import crypto from 'crypto';
import { SourceApplyDigestService } from '../SourceApplyDigestService';
import { SourceApplyService } from '../../../../../../../../desktop/src/main/services/SourceApplyService';
import { ApprovalRepositoryInMemory, ArtifactRepositoryInMemory } from '../persistence/InMemoryRepositories';
import { InMemoryFileSystemAdapter } from '../persistence/InMemoryFileSystemAdapter';
import { ExecutionTraceManager } from '../trace/ExecutionTraceManager';

describe('Phase 6.4.1A-3: Preview Stale Detection', () => {
  let service: SourceApplyService;
  let approvalRepo: ApprovalRepositoryInMemory;
  let previewRepo: any; // Using a mock or another repo
  let artifactRepo: ArtifactRepositoryInMemory;
  let traceManager: ExecutionTraceManager;
  let testRoot: string;
  let allowedWorkspaceRoot: string;

  beforeEach(async () => {
    approvalRepo = new ApprovalRepositoryInMemory();
    artifactRepo = new ArtifactRepositoryInMemory();
    traceManager = new ExecutionTraceManager();
    // Create a mock for previewRepo that conforms to ISourceApplyRepositoryPersistence
    previewRepo = {
      updatePreviewStatus: vi.fn(),
      getPreview: vi.fn()
    };

    service = new SourceApplyService(approvalRepo, previewRepo, artifactRepo, traceManager);

    testRoot = path.join(__dirname, 'test-stale-' + crypto.randomUUID());
    allowedWorkspaceRoot = path.join(testRoot, 'workspace');
    await fsp.mkdir(allowedWorkspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('MUST detect if the source digest has changed since the preview was created and return PREVIEW_STALE', async () => {
    // 1. Setup external file
    const targetFilePath = path.join(allowedWorkspaceRoot, 'test-file.txt');
    await fsp.writeFile(targetFilePath, 'Original content');

    // 2. Compute BEFORE digest
    const affectedPaths = ['test-file.txt'];
    const digestBefore = await SourceApplyDigestService.computeSourceDigest(allowedWorkspaceRoot, affectedPaths);
    
    // 3. Setup mock Preview and Approval with the BEFORE digest
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
      operationDigest: 'op-digest',
      affectedPathsDigest: 'path-digest',
      artifactDigest: 'hash',
      riskLevel: 'MEDIUM'
    } as any);

    // 4. External file modification (BEFORE authorization attempt)
    await fsp.writeFile(targetFilePath, 'Modified content');
    const digestAfter = await SourceApplyDigestService.computeSourceDigest(allowedWorkspaceRoot, affectedPaths);

    console.log(`[Stale Execution Proof] digestBefore: ${digestBefore}`);
    console.log(`[Stale Execution Proof] digestAfter:  ${digestAfter}`);
    expect(digestBefore).not.toBe(digestAfter);

    // 5. Authorization attempt
    const response = await service.authorizeOperation({
      approvalId,
      previewId,
      sourceApplyRequestId: 'req-1',
      sourceApplyOperationId: 'op-1',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'ws1',
      repositoryArtifactId: artifactId,
      artifactRevision: 1,
      sourceWorkspaceReference: 'workspace1',
      sessionCapabilityToken: 'token'
    }, { allowedWorkspaceRoot });

    // 6. Verify result
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('PREVIEW_STALE');
    
    const record = (await approvalRepo.getApprovalRecord(approvalId)).record;
    expect(record?.status).toBe('INVALIDATED');
    expect((record as any)?.invalidationReason).toBe('SOURCE_DIGEST_MISMATCH');
  });
});
