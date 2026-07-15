import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import * as os from 'os';

import { SourceApplyService } from '../SourceApplyService';
import { 
  ApprovalRepositoryInMemory, 
  SourceApplyRepositoryInMemory, 
  ArtifactRepositoryInMemory, 
  ApplyExecutionPersistenceInMemory 
} from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/persistence/InMemoryRepositories';
import { ExecutionTraceManager } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/trace/ExecutionTraceManager';
import { SourceApplyDigestService } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/SourceApplyDigestService';

describe('SourceApplyService Execution (Phase 6.4.1B)', () => {
  let service: SourceApplyService;
  let testRoot: string;
  let workspaceRoot: string;
  let artifactStorageRef: string;

  let approvalRepo: ApprovalRepositoryInMemory;
  let previewRepo: SourceApplyRepositoryInMemory;
  let artifactRepo: ArtifactRepositoryInMemory;
  let applyExecRepo: ApplyExecutionPersistenceInMemory;
  let traceManager: ExecutionTraceManager;

  beforeEach(async () => {
    approvalRepo = new ApprovalRepositoryInMemory();
    previewRepo = new SourceApplyRepositoryInMemory();
    artifactRepo = new ArtifactRepositoryInMemory();
    applyExecRepo = new ApplyExecutionPersistenceInMemory();
    traceManager = new ExecutionTraceManager();

    service = new SourceApplyService(
      approvalRepo,
      previewRepo,
      artifactRepo,
      traceManager,
      applyExecRepo
    );

    testRoot = path.join(os.tmpdir(), 'ameva-test-exec-' + crypto.randomUUID());
    workspaceRoot = path.join(testRoot, 'workspace');
    artifactStorageRef = path.join(testRoot, 'artifacts', 'test-artifact.ts');

    await fsp.mkdir(workspaceRoot, { recursive: true });
    await fsp.mkdir(path.dirname(artifactStorageRef), { recursive: true });
    await fsp.writeFile(artifactStorageRef, 'console.log("hello new world");', 'utf8');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
  });

  async function setupStandardTestTicket() {
    const ticketId = crypto.randomUUID();
    const approvalId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();

    // 1. Setup Preview
    const affectedPaths = ['target.ts'];
    await fsp.writeFile(path.join(workspaceRoot, 'target.ts'), 'original', 'utf8');
    const sourceDigest = await SourceApplyDigestService.createSourceDigest(workspaceRoot, affectedPaths);
    
    const preview: any = {
      requestId,
      sourceApplyRequestId: requestId,
      affectedPaths,
      addedFiles: [],
      modifiedFiles: ['target.ts'],
      deletedFiles: []
    };
    const previewDigest = await SourceApplyDigestService.createPreviewDigest(preview);
    const operationDigest = await SourceApplyDigestService.createOperationDigest(preview);
    const affectedPathsDigest = await SourceApplyDigestService.createAffectedPathsDigest(affectedPaths);

    previewRepo.saveSourceApplyPreview(preview);

    // 2. Setup Artifact
    const contentHash = crypto.createHash('sha256').update('console.log("hello new world");').digest('hex');
    const artifactDigest = await SourceApplyDigestService.createArtifactDigest(1, contentHash);
    artifactRepo.saveRepositoryArtifact({
      repositoryArtifactId: artifactId,
      revision: 1,
      contentHash,
      storageReference: artifactStorageRef
    } as any);

    // 3. Setup Approval
    const approval: any = {
      approvalId,
      status: 'APPROVED',
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'w1',
      sourceDigest,
      previewDigest,
      operationDigest,
      affectedPathsDigest,
      artifactDigest,
      riskLevel: 'LOW'
    };
    approvalRepo['records'].set(approvalId, approval);

    // 4. Setup Ticket
    const ticket: any = {
      authorizationTicketId: ticketId,
      approvalId,
      sourceApplyRequestId: requestId,
      repositoryArtifactId: artifactId,
      status: 'RESERVED',
      expiresAt: Date.now() + 60000,
      missionId: 'm1',
      taskId: 't1',
      attemptId: 'a1',
      workbenchSessionId: 'w1',
      riskLevel: 'LOW',
      sourceApplyOperationId: crypto.randomUUID()
    };
    approvalRepo['tickets'].set(ticketId, ticket);

    return ticketId;
  }

  it('MUST execute apply and mark APPLY_WRITTEN_PENDING_VERIFICATION', async () => {
    const ticketId = await setupStandardTestTicket();
    
    const res = await service.executeApply({
      authorizationTicketId: ticketId,
      workbenchSessionId: 'w1',
      sessionCapabilityToken: 'w1'
    }, { allowedWorkspaceRoot: workspaceRoot, workbenchSessionId: 'w1' });

    if (!res.success) {
      console.log('Test Failed. ErrorCode:', res.errorCode);
    }
    expect(res.success).toBe(true);
    
    // Check execution status
    const execId = res.executionId;
    const exec = await applyExecRepo.getExecutionRecord(execId);
    expect(exec).toBeDefined();
    expect(exec?.status).toBe('APPLY_WRITTEN_PENDING_VERIFICATION');

    // Check file applied
    const targetContent = await fsp.readFile(path.join(workspaceRoot, 'target.ts'), 'utf8');
    expect(targetContent).toBe('console.log("hello new world");');
  });

  it('MUST return idempotent success on duplicate executeApply', async () => {
    const ticketId = await setupStandardTestTicket();
    
    const req = {
      authorizationTicketId: ticketId,
      workbenchSessionId: 'w1',
      sessionCapabilityToken: 'w1'
    };
    const session = { allowedWorkspaceRoot: workspaceRoot, workbenchSessionId: 'w1' };

    const res1 = await service.executeApply(req, session);
    expect(res1.success).toBe(true);

    const res2 = await service.executeApply(req, session);
    expect(res2.success).toBe(true);
    expect(res2.executionId).toBe(res1.executionId);
  });

  it('MUST abort and invalidate ticket on snapshot failure (PRE_APPLY_ABORT)', async () => {
    const ticketId = await setupStandardTestTicket();
    
    // Induce snapshot failure by forcing invalid tmpdir
    const origTmp = process.env.TMP;
    
    try {
      process.env.TMP = 'Z:\\invalid_volume_not_exists\\path_123';
      process.env.TEMP = 'Z:\\invalid_volume_not_exists\\path_123';

      const res = await service.executeApply({
        authorizationTicketId: ticketId,
        workbenchSessionId: 'w1',
        sessionCapabilityToken: 'w1'
      }, { allowedWorkspaceRoot: workspaceRoot, workbenchSessionId: 'w1' });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('PRE_APPLY_ABORT');

      // Ticket should be invalidated
      const ticket = await approvalRepo.getAuthorizationTicket(ticketId);
      expect(ticket?.status).toBe('INVALIDATED');
      
      const approvalRes = await approvalRepo.getApprovalRecord(ticket!.approvalId);
      expect(approvalRes.record?.invalidationReason).toBe('PRE_APPLY_ABORT');

      // Lease should be released
      const lease = await applyExecRepo.getLease(workspaceRoot);
      expect(lease).toBeNull();
    } finally {
      if (origTmp) {
        process.env.TMP = origTmp;
        process.env.TEMP = origTmp;
      }
    }
  });

  it('MUST quarantine workspace on ROLLBACK_FAILED', async () => {
    const ticketId = await setupStandardTestTicket();
    
    // Induce apply failure by pointing artifact to a directory (EISDIR on readFile)
    const artifactId = Array.from(artifactRepo['artifacts'].values())[0].repositoryArtifactId;
    artifactRepo['artifacts'].get(artifactId)!.storageReference = workspaceRoot;

    // Induce rollback failure
    vi.spyOn(applyExecRepo, 'getJournalEntries').mockRejectedValueOnce(new Error('Rollback read mock'));

    const res = await service.executeApply({
      authorizationTicketId: ticketId,
      workbenchSessionId: 'w1',
      sessionCapabilityToken: 'w1'
    }, { allowedWorkspaceRoot: workspaceRoot, workbenchSessionId: 'w1' });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('EXECUTION_FAILED_ROLLBACK_FAILED');
    
    // Let's check the execution record instead of the response
    const execs = Array.from(applyExecRepo['executions'].values());
    const exec = execs.find(e => e.authorizationTicketId === ticketId);
    expect(exec?.status).toBe('ROLLBACK_FAILED');

    // Workspace quarantined
    const isQuarantined = await applyExecRepo.isWorkspaceQuarantined(workspaceRoot);
    expect(isQuarantined).toBe(true);
  });

  it('MUST block execution if workspace is quarantined', async () => {
    const ticketId = await setupStandardTestTicket();
    await applyExecRepo.quarantineWorkspace(workspaceRoot, 'TEST');

    const res = await service.executeApply({
      authorizationTicketId: ticketId,
      workbenchSessionId: 'w1',
      sessionCapabilityToken: 'w1'
    }, { allowedWorkspaceRoot: workspaceRoot, workbenchSessionId: 'w1' });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('WORKSPACE_QUARANTINED');
  });
});
