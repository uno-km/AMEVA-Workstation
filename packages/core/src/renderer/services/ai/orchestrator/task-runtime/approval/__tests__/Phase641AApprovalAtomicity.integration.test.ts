import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalRepositoryInMemory } from '../../persistence/InMemoryRepositories';
import type { ApprovalRecord } from '../types';

describe('Phase 6.4.1A-1: Approval Atomicity Integration', () => {
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
    status: 'APPROVED',
    requestedAt: now,
    expiresAt: now + 10000,
    singleUse: true,
    schemaVersion: 3,
    createdAt: now,
    updatedAt: now,
    approvedBy: 'user',
    approvedAt: now
  };

  beforeEach(() => {
    repo = new ApprovalRepositoryInMemory();
  });

  it('handles 20 concurrent Reservation requests, exactly 1 succeeds', async () => {
    await repo.saveApprovalRecord(validRecord);

    const promises = Array.from({ length: 20 }).map((_, idx) => {
      return repo.compareAndReserveApproval({
        approvalId: 'app_1',
        sourceApplyRequestId: `req_${idx}`,
        sourceApplyOperationId: `op_${idx}`,
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
    });

    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(19);

    for (const f of failures) {
      expect(f.errorCode).toBe('APPROVAL_ALREADY_RESERVED');
    }

    const finalRecord = await repo.getApprovalRecord('app_1');
    expect(finalRecord.record?.status).toBe('RESERVED');
    expect(finalRecord.record?.reservedByOperationId).toBeDefined();
  });

  it('handles 20 concurrent Consumption requests, exactly 1 succeeds', async () => {
    await repo.saveApprovalRecord(validRecord);
    const reserveRes = await repo.compareAndReserveApproval({
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

    expect(reserveRes.success).toBe(true);

    const promises = Array.from({ length: 20 }).map(() => {
      return repo.compareAndConsumeApproval({
        approvalId: 'app_1',
        authorizationTicketId: reserveRes.ticket!.authorizationTicketId,
        sourceApplyOperationId: 'op_1',
        expectedReservedByOperationId: 'op_1',
        sourceDigest: 'sd',
        previewDigest: 'pd',
        operationDigest: 'od',
        affectedPathsDigest: 'apd',
        now: now + 2000
      });
    });

    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(19);

    for (const f of failures) {
      expect(f.errorCode).toBe('APPROVAL_ALREADY_CONSUMED');
    }

    const finalRecord = await repo.getApprovalRecord('app_1');
    expect(finalRecord.record?.status).toBe('CONSUMED');
  });
});
