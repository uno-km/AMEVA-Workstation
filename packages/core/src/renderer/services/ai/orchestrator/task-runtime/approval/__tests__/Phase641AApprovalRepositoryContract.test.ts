import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalRepositoryInMemory } from '../../persistence/InMemoryRepositories';
import type { ApprovalRecord } from '../types';

describe('Phase 6.4.1A-1: Approval Repository Contract', () => {
  let repo: ApprovalRepositoryInMemory;
  const now = Date.now();
  
  const validRecord: ApprovalRecord = {
    approvalId: 'app_1',
    missionId: 'm_1',
    taskId: 't_1',
    attemptId: 'a_1',
    workbenchSessionId: 'ws_1',
    repositoryArtifactId: 'ra_1',
    artifactRevision: 1,
    sourceWorkspaceId: 'sw_1',
    sourceDigest: 'sd',
    previewDigest: 'pd',
    operationDigest: 'od',
    affectedPathsDigest: 'apd',
    riskLevel: 'LOW',
    requestType: 'UPDATE',
    status: 'REQUESTED',
    requestedAt: now,
    expiresAt: now + 10000,
    singleUse: true,
    schemaVersion: 3,
    createdAt: now,
    updatedAt: now
  };

  beforeEach(() => {
    repo = new ApprovalRepositoryInMemory();
  });

  it('saves and retrieves an approval record', async () => {
    await repo.saveApprovalRecord(validRecord);
    const res = await repo.getApprovalRecord('app_1');
    expect(res.success).toBe(true);
    expect(res.record?.approvalId).toBe('app_1');
  });

  it('updates approval status', async () => {
    await repo.saveApprovalRecord(validRecord);
    await repo.updateApprovalStatus('app_1', 'APPROVED');
    const res = await repo.getApprovalRecord('app_1');
    expect(res.record?.status).toBe('APPROVED');
    expect(res.record?.approvedAt).toBeDefined();
  });

  it('prevents reservation of non-APPROVED records', async () => {
    await repo.saveApprovalRecord(validRecord);
    const res = await repo.compareAndReserveApproval({
      approvalId: 'app_1',
      sourceApplyRequestId: 'req_1',
      sourceApplyOperationId: 'op_1',
      missionId: 'm_1',
      taskId: 't_1',
      attemptId: 'a_1',
      workbenchSessionId: 'ws_1',
      repositoryArtifactId: 'ra_1',
      artifactRevision: 1,
      sourceWorkspaceId: 'sw_1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: now + 1000
    });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('APPROVAL_STATE_TRANSITION_INVALID');
  });

  it('reserves an APPROVED record successfully', async () => {
    const approvedRecord = { ...validRecord, status: 'APPROVED' as const, approvedBy: 'user', approvedAt: now };
    await repo.saveApprovalRecord(approvedRecord);
    const res = await repo.compareAndReserveApproval({
      approvalId: 'app_1',
      sourceApplyRequestId: 'req_1',
      sourceApplyOperationId: 'op_1',
      missionId: 'm_1',
      taskId: 't_1',
      attemptId: 'a_1',
      workbenchSessionId: 'ws_1',
      repositoryArtifactId: 'ra_1',
      artifactRevision: 1,
      sourceWorkspaceId: 'sw_1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: now + 1000
    });
    expect(res.success).toBe(true);
    expect(res.record?.status).toBe('RESERVED');
    expect(res.ticket?.status).toBe('RESERVED');
  });

  it('fails reservation if digest mismatch', async () => {
    const approvedRecord = { ...validRecord, status: 'APPROVED' as const, approvedBy: 'user', approvedAt: now };
    await repo.saveApprovalRecord(approvedRecord);
    const res = await repo.compareAndReserveApproval({
      approvalId: 'app_1',
      sourceApplyRequestId: 'req_1',
      sourceApplyOperationId: 'op_1',
      missionId: 'm_1',
      taskId: 't_1',
      attemptId: 'a_1',
      workbenchSessionId: 'ws_1',
      repositoryArtifactId: 'ra_1',
      artifactRevision: 1,
      sourceWorkspaceId: 'sw_1',
      sourceDigest: 'WRONG_DIGEST',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: now + 1000
    });
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('APPROVAL_CONTEXT_MISMATCH');
  });

  it('consumes a reserved approval successfully', async () => {
    const approvedRecord = { ...validRecord, status: 'APPROVED' as const, approvedBy: 'user', approvedAt: now };
    await repo.saveApprovalRecord(approvedRecord);
    const res1 = await repo.compareAndReserveApproval({
      approvalId: 'app_1',
      sourceApplyRequestId: 'req_1',
      sourceApplyOperationId: 'op_1',
      missionId: 'm_1',
      taskId: 't_1',
      attemptId: 'a_1',
      workbenchSessionId: 'ws_1',
      repositoryArtifactId: 'ra_1',
      artifactRevision: 1,
      sourceWorkspaceId: 'sw_1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: now + 1000
    });
    
    expect(res1.success).toBe(true);
    
    const res2 = await repo.compareAndConsumeApproval({
      approvalId: 'app_1',
      authorizationTicketId: res1.ticket!.authorizationTicketId,
      sourceApplyOperationId: 'op_1',
      expectedReservedByOperationId: 'op_1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      now: now + 2000
    });
    expect(res2.success).toBe(true);
    expect(res2.record?.status).toBe('CONSUMED');
  });

  it('releases a reservation', async () => {
    const approvedRecord = { ...validRecord, status: 'APPROVED' as const, approvedBy: 'user', approvedAt: now };
    await repo.saveApprovalRecord(approvedRecord);
    const res1 = await repo.compareAndReserveApproval({
      approvalId: 'app_1',
      sourceApplyRequestId: 'req_1',
      sourceApplyOperationId: 'op_1',
      missionId: 'm_1',
      taskId: 't_1',
      attemptId: 'a_1',
      workbenchSessionId: 'ws_1',
      repositoryArtifactId: 'ra_1',
      artifactRevision: 1,
      sourceWorkspaceId: 'sw_1',
      sourceDigest: 'sd',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      riskLevel: 'LOW',
      now: now + 1000
    });
    
    const res2 = await repo.releaseApprovalReservation({
      approvalId: 'app_1',
      authorizationTicketId: res1.ticket!.authorizationTicketId,
      sourceApplyOperationId: 'op_1',
      releaseReason: 'Failed apply',
      now: now + 2000
    });
    expect(res2.success).toBe(true);
    expect(res2.record?.status).toBe('RELEASED');
  });

  it('invalidates an approval', async () => {
    const approvedRecord = { ...validRecord, status: 'APPROVED' as const, approvedBy: 'user', approvedAt: now };
    await repo.saveApprovalRecord(approvedRecord);
    
    const res = await repo.invalidateApproval({
      approvalId: 'app_1',
      invalidationReason: 'SOURCE_CHANGED',
      now: now + 1000
    });
    
    expect(res.success).toBe(true);
    expect(res.record?.status).toBe('INVALIDATED');
  });

  it('expires pending approvals', async () => {
    await repo.saveApprovalRecord(validRecord);
    const res = await repo.expireApprovals(now + 20000);
    expect(res.success).toBe(true);
    expect(res.data).toBe(1);
    
    const expiredRecord = await repo.getApprovalRecord('app_1');
    expect(expiredRecord.record?.status).toBe('EXPIRED');
  });
});
