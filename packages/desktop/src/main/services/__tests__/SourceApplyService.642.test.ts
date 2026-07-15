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
import { WorkspaceBlockFlag } from '../../../../../core/src/renderer/services/ai/orchestrator/task-runtime/apply/types';

describe('SourceApplyService Phase 6.4.2 Verification and Reconciliation', () => {
  let service: SourceApplyService;
  let testRoot: string;
  let workspaceRoot: string;
  
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

    testRoot = path.join(os.tmpdir(), 'ameva-test-verify-' + crypto.randomUUID());
    workspaceRoot = path.join(testRoot, 'workspace');
    await fsp.mkdir(workspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
  });

  const setupMockApplyState = async (status: any = 'APPLY_WRITTEN_PENDING_VERIFICATION') => {
    const approvalId = 'app-1';
    const requestId = 'req-1';
    const executionId = 'exec-1';
    const ticketId = 'ticket-1';
    const artifactId = 'art-1';

    await approvalRepo.saveApprovalRecord({
      approvalId,
      status: 'RESERVED',
      missionId: 'm-1',
      taskId: 't-1',
      attemptId: 'a-1',
      workbenchSessionId: 'ws-1',
      repositoryArtifactId: artifactId,
      artifactRevision: 1,
      sourceWorkspaceId: 'w-1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      artifactDigest: 'ad',
      riskLevel: 'LOW',
      reservedByOperationId: executionId,
      expiresAt: Date.now() + 100000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schemaVersion: '1.0.0',
      requiredChecks: []
    });

    // Need to insert it into tickets map inside ApprovalRepo, since InMemory exposes comparison methods
    // We can just reserve it properly.
    await approvalRepo.updateApprovalStatus(approvalId, 'APPROVED');
    const reserveRes = await approvalRepo.compareAndReserveApproval({
      approvalId,
      sourceApplyRequestId: requestId,
      sourceApplyOperationId: executionId,
      missionId: 'm-1',
      taskId: 't-1',
      attemptId: 'a-1',
      workbenchSessionId: 'ws-1',
      repositoryArtifactId: artifactId,
      artifactRevision: 1,
      sourceWorkspaceId: 'w-1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: Date.now()
    });
    
    const actualTicketId = reserveRes.ticket!.authorizationTicketId;

    await previewRepo.saveSourceApplyPreview({
      sourceApplyRequestId: requestId,
      missionId: 'm-1',
      taskId: 't-1',
      attemptId: 'a-1',
      workbenchSessionId: 'ws-1',
      repositoryArtifactId: artifactId,
      artifactRevision: 1,
      sourceWorkspaceReference: 'w-1',
      operations: [],
      affectedPaths: ['test.ts'],
      requiredChecks: [],
      status: 'APPROVED',
      createdAt: Date.now(),
      schemaVersion: '1.0.0'
    });

    await applyExecRepo.saveExecutionRecord({
      executionId,
      authorizationTicketId: actualTicketId,
      workspaceRoot,
      status,
      startedAt: Date.now(),
      updatedAt: Date.now()
    });
    
    // Create actual file to pass verify
    await fsp.writeFile(path.join(workspaceRoot, 'test.ts'), 'content');

    return { executionId, ticketId: actualTicketId, approvalId, requestId };
  };

  it('MUST succeed verification and consume ticket if file matches', async () => {
    const { executionId, ticketId } = await setupMockApplyState();
    
    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(true);
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
    
    const ticket = await approvalRepo.getAuthorizationTicket(ticketId);
    expect(ticket?.status).toBe('CONSUMED');
  });

  it('MUST rollback if verification fails and restore is safe', async () => {
    const { executionId, ticketId } = await setupMockApplyState();
    
    // Delete file to cause verification failure
    await fsp.unlink(path.join(workspaceRoot, 'test.ts'));

    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('VERIFICATION_FAILED_ROLLED_BACK');
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('ROLLED_BACK');
  });

  it('MUST quarantine if verification fails and restore is unsafe (e.g. symlink drift / out of bounds path)', async () => {
    const { executionId, ticketId, requestId, artifactId } = await setupMockApplyState();
    
    // Inject out of bounds path in preview to simulate unsafe restore
    await previewRepo.saveSourceApplyPreview({
      sourceApplyRequestId: requestId,
      missionId: 'm-1',
      taskId: 't-1',
      attemptId: 'a-1',
      workbenchSessionId: 'ws-1',
      repositoryArtifactId: artifactId || '',
      artifactRevision: 1,
      sourceWorkspaceReference: 'w-1',
      operations: [],
      affectedPaths: ['../unsafe.ts'],
      requiredChecks: [],
      status: 'APPROVED',
      createdAt: Date.now(),
      schemaVersion: '1.0.0'
    });

    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('WORKSPACE_QUARANTINED');
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('QUARANTINED');
    
    const isQuarantined = await applyExecRepo.isWorkspaceQuarantined(workspaceRoot);
    expect(isQuarantined).toBe(true);
  });

  it('MUST mark CONSUME_FAILED and set QUARANTINE_CONSUME_PENDING if consumption fails due to digest mismatch', async () => {
    const { executionId, ticketId, approvalId } = await setupMockApplyState();
    
    // Sabotage approval digest so consume fails
    const approvalRes = await approvalRepo.getApprovalRecord(approvalId);
    approvalRes.record!.sourceDigest = 'tampered';
    await approvalRepo.saveApprovalRecord(approvalRes.record!);
    
    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('APPROVAL_CONTEXT_MISMATCH');
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('CONSUME_FAILED');
    
    const hasBlock = await applyExecRepo.hasWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    expect(hasBlock).toBe(true);
  });

  it('MUST reconcile split-brain: local APPLIED but ticket NOT CONSUMED => CONSUME_FAILED block', async () => {
    const { executionId, ticketId, approvalId } = await setupMockApplyState('APPLIED');
    
    // Ticket is RESERVED (not consumed), local is APPLIED (split brain)
    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('RECONCILIATION_FAILED');
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('CONSUME_FAILED'); // Corrected locally
    
    const hasBlock = await applyExecRepo.hasWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING);
    expect(hasBlock).toBe(true);
  });
  
  it('MUST reconcile split-brain: local NOT APPLIED but ticket IS CONSUMED => APPLIED', async () => {
    const { executionId, ticketId, approvalId } = await setupMockApplyState('CONSUMING_APPROVAL');
    
    // Fake the ticket as CONSUMED manually
    const recordRes = await approvalRepo.getApprovalRecord(approvalId);
    await approvalRepo.updateApprovalStatus(approvalId, 'CONSUMED');
    const ticket = await approvalRepo.getAuthorizationTicket(ticketId);
    if(ticket) ticket.status = 'CONSUMED';

    const res = await service.verifyApply({
      executionId,
      authorizationTicketId: ticketId
    });

    expect(res.success).toBe(true);
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
  });
});
