import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import * as os from 'os';

import { SourceApplyService } from '../SourceApplyService';
import { MainProcessDocumentHostService } from '../MainProcessDocumentHostService';
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
    
    const traces = traceManager.getStore().getMissionTrace('m-1').map((e: any) => e.metadata?.event);
    expect(traces).not.toContain('POST_APPLY_VERIFICATION_STARTED');
    expect(traces).toContain('APPROVAL_CONSUMPTION_SUCCEEDED');
    expect(traces).toContain('APPLIED_CONFIRMED');
  });

  // NEW SCENARIOS for 6.4.2 COMPLETION:
  it('VERIFYING 중단 후 재시작 -> VERIFYING 전체 재수행', async () => {
    const { executionId, ticketId } = await setupMockApplyState('VERIFYING');
    
    // Should re-run verification properly
    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    if (!res.success) console.log('DOCX FAILS WITH:', res.errorCode, res.errorMessage);
    expect(res.success).toBe(true);
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
  });

  it('Document verification: DOCX/Markdown reopen/parse success path', async () => {
    const { executionId, ticketId, requestId, workspaceRoot } = await setupMockApplyState();
    
    const preview = await previewRepo.getSourceApplyPreview(requestId);
    preview!.requiredChecks = ['document-reopen'];
    preview!.affectedPaths = ['document.docx'];
    await previewRepo.saveSourceApplyPreview(preview!);
    const fsp = require('fs/promises');
    const recordWS = await applyExecRepo.getExecutionRecord(executionId);
    const docService = new MainProcessDocumentHostService();
    await docService.generateArtifact({
      type: 'DOCUMENT_GENERATE',
      artifactFormat: 'DOCX',
      outputLogicalPath: 'document.docx',
      integratedDocumentReference: 'Hello AMEVA!'
    } as any, recordWS.workspaceRoot);
    
    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    
    expect(res.success).toBe(true);
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
    
    const traces = traceManager.getStore().getMissionTrace('m-1').map((e: any) => e.metadata?.event);
    expect(traces).toContain('POST_APPLY_VERIFICATION_PASSED');
  });

  it('VERIFIED_PENDING_CONSUME 중단 후 재시작 -> CONSUMING_APPROVAL 재개', async () => {
    const { executionId, ticketId } = await setupMockApplyState('VERIFIED_PENDING_CONSUME');
    
    // Should skip verification and go directly to reconcileAndConsume
    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    expect(res.errorCode || 'success').toBe('success');
    expect(res.success).toBe(true);
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
  });

  it('CONSUME_FAILED 재진입 시 자동 재시도 금지 (AUTO_RETRY_FORBIDDEN)', async () => {
    const { executionId, ticketId } = await setupMockApplyState('CONSUME_FAILED');
    
    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('AUTO_RETRY_FORBIDDEN');
  });

  it('hold clear -> manual consume retry -> CONSUMING_APPROVAL 재진입', async () => {
    const { executionId, ticketId } = await setupMockApplyState('CONSUME_FAILED');
    await applyExecRepo.setWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING, 'failed');
    
    // Manual retry should clear hold and succeed
    const res = await service.manualRetryConsume(executionId);
    expect(res.success).toBe(true);
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
    expect(await applyExecRepo.hasWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING)).toBe(false);
  });

  it('hold clear -> manual rollback -> ROLLING_BACK 진입', async () => {
    const { executionId, ticketId } = await setupMockApplyState('CONSUME_FAILED');
    await applyExecRepo.setWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING, 'failed');
    
    const res = await service.manualRollbackApply(executionId);
    expect(res.success).toBe(true);
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('ROLLED_BACK');
    expect(await applyExecRepo.hasWorkspaceBlockFlag(workspaceRoot, WorkspaceBlockFlag.QUARANTINE_CONSUME_PENDING)).toBe(false);
  });

  it('SNAPSHOT_CLEANUP_WARNING 증거: cleanup 실패 강제 시 APPLIED 유지 및 trace 기록', async () => {
    // Setup with a specific workspace root that triggers the simulate fail branch
    workspaceRoot = path.join(testRoot, 'snapshot-fail');
    await fsp.mkdir(workspaceRoot, { recursive: true });
    
    const { executionId, ticketId } = await setupMockApplyState('VERIFIED_PENDING_CONSUME');
    
    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    expect(res.errorCode || 'success').toBe('success');
    expect(res.success).toBe(true);
    
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('APPLIED');
    
    // verify trace event
    const events = traceManager.getStore().getMissionTrace('m-1');
    const warningEvent = events.find((e: any) => e.metadata?.event === 'SNAPSHOT_CLEANUP_WARNING');
    expect(warningEvent).toBeDefined();
    expect(warningEvent?.metadata?.message).toBe('Failed to clean up snapshot');
  });

  it('Document verification: PDF creation blocked -> VERIFY_FAILED', async () => {
    const { executionId, ticketId, requestId, artifactId } = await setupMockApplyState();
    
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
      affectedPaths: ['test.pdf'],
      requiredChecks: ['document-reopen'],
      status: 'APPROVED',
      createdAt: Date.now(),
      schemaVersion: '1.0.0'
    });

    await fsp.writeFile(path.join(workspaceRoot, 'test.pdf'), 'fake');

    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('VERIFICATION_FAILED_ROLLED_BACK');
    
    // Check log for exact reason in real implementation, but here we can check if it rolled back
    const record = await applyExecRepo.getExecutionRecord(executionId);
    expect(record?.status).toBe('ROLLED_BACK');
  });

  it('Document verification: DOCX reopen/parse failure -> VERIFY_FAILED', async () => {
    const { executionId, ticketId, requestId, artifactId } = await setupMockApplyState();
    
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
      affectedPaths: ['fail-docx.docx'],
      requiredChecks: ['document-reopen'],
      status: 'APPROVED',
      createdAt: Date.now(),
      schemaVersion: '1.0.0'
    });

    await fsp.writeFile(path.join(workspaceRoot, 'fail-docx.docx'), 'fake');

    const res = await service.verifyApply({ executionId, authorizationTicketId: ticketId });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('VERIFICATION_FAILED_ROLLED_BACK');
  });

  it('Renderer forged verification/consume payload ignored (Main strictly controls state)', async () => {
    const { executionId, ticketId } = await setupMockApplyState();
    
    // Send a payload attempting to bypass logic. Notice we only pass IDs. We can't even send arbitrary booleans!
    // The type itself rejects it, but we cast it as any to simulate runtime IPC tampering.
    const fakePayload: any = {
      executionId,
      authorizationTicketId: ticketId,
      verified: true,
      applied: true,
      forceConsume: true
    };

    // Make local state fail verification by deleting the file
    await fsp.unlink(path.join(workspaceRoot, 'test.ts'));

    const res = await service.verifyApply(fakePayload);
    // Despite `verified: true` in the forged payload, Main Process ignores it and executes actual verification, which fails.
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('VERIFICATION_FAILED_ROLLED_BACK');
  });
});
