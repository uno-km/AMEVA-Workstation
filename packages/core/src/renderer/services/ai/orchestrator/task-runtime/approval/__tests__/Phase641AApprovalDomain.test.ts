import { describe, it, expect } from 'vitest';
import { validateApprovalRecord } from '../validator';
import type { ApprovalRecord } from '../types';

describe('Phase 6.4.1A-1: Approval Domain', () => {
  const validBase: any = {
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
    requestedAt: Date.now(),
    expiresAt: Date.now() + 10000,
    singleUse: true,
    schemaVersion: 3,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('validates a correct REQUESTED record', () => {
    expect(validateApprovalRecord({ ...validBase })).toBe(true);
  });

  it('rejects if sensitive info is present', () => {
    const recordWithToken = { ...validBase, approvalToken: 'secret' };
    expect(validateApprovalRecord(recordWithToken)).toBe(false);
  });

  it('rejects CORRUPTED_PERSISTED_STATE (missing digest)', () => {
    const corrupted = { ...validBase };
    delete corrupted.previewDigest;
    expect(validateApprovalRecord(corrupted)).toBe(false);
  });

  it('rejects invalid artifactRevision', () => {
    const corrupted = { ...validBase, artifactRevision: -1 };
    expect(validateApprovalRecord(corrupted)).toBe(false);
  });

  it('validates APPROVED record constraints', () => {
    const approved = { ...validBase, status: 'APPROVED', approvedBy: 'user', approvedAt: Date.now() };
    expect(validateApprovalRecord(approved)).toBe(true);

    const missingApprovedBy = { ...approved };
    delete missingApprovedBy.approvedBy;
    expect(validateApprovalRecord(missingApprovedBy)).toBe(false);
    
    const invalidWithReservedAt = { ...approved, reservedAt: Date.now() };
    expect(validateApprovalRecord(invalidWithReservedAt)).toBe(false);
  });

  it('validates RESERVED record constraints', () => {
    const reserved = { 
      ...validBase, 
      status: 'RESERVED', 
      approvedBy: 'user', 
      approvedAt: Date.now(),
      reservedAt: Date.now(),
      reservedByOperationId: 'op_1'
    };
    expect(validateApprovalRecord(reserved)).toBe(true);

    const missingReservedBy = { ...reserved };
    delete missingReservedBy.reservedByOperationId;
    expect(validateApprovalRecord(missingReservedBy)).toBe(false);
  });

  it('validates CONSUMED record constraints', () => {
    const consumed = { 
      ...validBase, 
      status: 'CONSUMED', 
      approvedBy: 'user', 
      approvedAt: Date.now(),
      reservedAt: Date.now(),
      reservedByOperationId: 'op_1',
      consumedAt: Date.now()
    };
    expect(validateApprovalRecord(consumed)).toBe(true);

    const missingConsumedAt = { ...consumed };
    delete missingConsumedAt.consumedAt;
    expect(validateApprovalRecord(missingConsumedAt)).toBe(false);
  });
});
