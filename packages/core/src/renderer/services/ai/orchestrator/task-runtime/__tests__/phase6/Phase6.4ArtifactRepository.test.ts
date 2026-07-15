import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';
import { ArtifactRepository } from '../../artifact/repository/ArtifactRepository';
import { ApprovalResolver } from '../../approval/ApprovalResolver';
import { SourceApplyRepositoryInMemory } from '../../persistence/InMemoryRepositories';

describe('Phase 6.4: Artifact Repository & Approval Resolver', () => {
  let adapter: InMemoryRuntimePersistenceAdapter;
  let artifactRepo: ArtifactRepository;
  let approvalResolver: ApprovalResolver;

  beforeEach(() => {
    adapter = new InMemoryRuntimePersistenceAdapter();
    artifactRepo = new ArtifactRepository(adapter.artifacts);
    approvalResolver = new ApprovalResolver(adapter.approvals);
  });

  afterEach(() => {
    // cleanup if necessary
  });

  it('1. should register a new artifact with status REGISTERING and revision 1', async () => {
    const artifact = await artifactRepo.registerArtifact({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'ws1',
      sourceArtifactId: 'sa1',
      artifactKind: 'CODE',
      artifactFormat: 'PATCH',
      logicalPath: 'src/index.ts',
      storageReference: '/vfs/m1/ws1/src/index.ts',
      contentHash: 'hash1',
      sizeBytes: 100,
      mimeType: 'text/typescript',
      provenance: {
        producerType: 'CODE_WORKBENCH',
        producerId: 'agent-1',
        createdAt: Date.now()
      }
    });

    expect(artifact.repositoryArtifactId).toBeDefined();
    expect(artifact.status).toBe('REGISTERING');
    expect(artifact.revision).toBe(1);
    expect(artifact.parentRevision).toBeUndefined();

    const loaded = await artifactRepo.getArtifact(artifact.repositoryArtifactId);
    expect(loaded).toBeDefined();
    expect(loaded?.status).toBe('REGISTERING');
  });

  it('2. should increment revision when registering an artifact at the same logical path', async () => {
    await artifactRepo.registerArtifact({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'ws1',
      sourceArtifactId: 'sa1',
      artifactKind: 'CODE',
      artifactFormat: 'PATCH',
      logicalPath: 'src/index.ts',
      storageReference: '/vfs/m1/ws1/src/index.ts',
      contentHash: 'hash1',
      sizeBytes: 100,
      mimeType: 'text/typescript',
      provenance: { producerType: 'CODE_WORKBENCH', producerId: 'agent-1', createdAt: Date.now() }
    });

    const artifact2 = await artifactRepo.registerArtifact({
      missionId: 'm1',
      taskId: 't2',
      attemptId: 'a2',
      workbenchSessionId: 'ws1',
      sourceArtifactId: 'sa2',
      artifactKind: 'CODE',
      artifactFormat: 'PATCH',
      logicalPath: 'src/index.ts',
      storageReference: '/vfs/m1/ws1/src/index.ts',
      contentHash: 'hash2',
      sizeBytes: 120,
      mimeType: 'text/typescript',
      provenance: { producerType: 'CODE_WORKBENCH', producerId: 'agent-1', createdAt: Date.now() }
    });

    expect(artifact2.revision).toBe(2);
    expect(artifact2.parentRevision).toBe(1);
  });

  it('3. should commit artifact and update status to AVAILABLE', async () => {
    const artifact = await artifactRepo.registerArtifact({
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'ws1',
      sourceArtifactId: 'sa1',
      artifactKind: 'CODE',
      artifactFormat: 'PATCH',
      logicalPath: 'src/index.ts',
      storageReference: '/vfs/m1/ws1/src/index.ts',
      contentHash: 'hash1',
      sizeBytes: 100,
      mimeType: 'text/typescript',
      provenance: { producerType: 'CODE_WORKBENCH', producerId: 'agent-1', createdAt: Date.now() }
    });

    await artifactRepo.commitArtifact(artifact.repositoryArtifactId, {
      passed: true,
      checks: [{ name: 'syntax_check', status: 'PASS' }]
    });

    const loaded = await artifactRepo.getArtifact(artifact.repositoryArtifactId);
    expect(loaded?.status).toBe('AVAILABLE');
    expect(loaded?.verificationSummary?.passed).toBe(true);
  });

  it('4. should request and resolve an approval record', async () => {
    const approval = await approvalResolver.requestApproval({
      missionId: 'm1',
      taskId: 't1',
      workbenchSessionId: 'ws1',
      requestType: 'SOURCE_APPLY',
      operationDigest: 'op1',
      previewDigest: 'pre1',
      affectedPaths: ['src/index.ts'],
      riskLevel: 'HIGH'
    });

    expect(approval.status).toBe('REQUESTED');

    await approvalResolver.resolveApproval(approval.approvalId, 'APPROVED', 'user-1');

    const status = await approvalResolver.getApprovalStatus(approval.approvalId);
    expect(status).toBe('APPROVED');

    const consumed = await approvalResolver.consumeApproval(approval.approvalId, 'op1', 'pre1');
    expect(consumed).toBe(true);

    const postConsumeStatus = await approvalResolver.getApprovalStatus(approval.approvalId);
    expect(postConsumeStatus).toBe('CONSUMED');
  });
  
  it('5. should reject approval consumption if digests do not match', async () => {
    const approval = await approvalResolver.requestApproval({
      missionId: 'm1',
      taskId: 't1',
      workbenchSessionId: 'ws1',
      requestType: 'SOURCE_APPLY',
      operationDigest: 'op1',
      previewDigest: 'pre1',
      affectedPaths: ['src/index.ts'],
      riskLevel: 'HIGH'
    });
    await approvalResolver.resolveApproval(approval.approvalId, 'APPROVED', 'user-1');
    
    const consumed = await approvalResolver.consumeApproval(approval.approvalId, 'op-wrong', 'pre1');
    expect(consumed).toBe(false); // Digest mismatch
  });
});
