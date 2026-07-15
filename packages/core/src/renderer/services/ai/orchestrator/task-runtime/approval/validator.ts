import { ApprovalRecord, ApprovalRecordStatus } from './types';

const VALID_STATUSES = new Set<ApprovalRecordStatus>([
  'REQUESTED', 'APPROVED', 'RESERVED', 'RELEASED', 'CONSUMED', 'REJECTED', 'EXPIRED', 'REVOKED', 'INVALIDATED'
]);

export function validateApprovalRecord(record: any): record is ApprovalRecord {
  if (!record || typeof record !== 'object') return false;
  
  // Basic Fields
  if (!record.approvalId || typeof record.approvalId !== 'string') return false;
  if (!record.missionId || typeof record.taskId !== 'string') return false;
  if (!record.status || !VALID_STATUSES.has(record.status)) return false;
  if (typeof record.requestedAt !== 'number') return false;
  if (typeof record.expiresAt !== 'number') return false;
  if (typeof record.schemaVersion !== 'number') return false;
  if (typeof record.artifactRevision !== 'number' || record.artifactRevision < 0) return false;
  
  if (!record.sourceDigest || !record.previewDigest || !record.operationDigest || !record.affectedPathsDigest) {
    return false;
  }
  
  // Sensitive Data Check
  const restrictedKeys = ['approvalToken', 'capabilityToken', 'accessToken', 'authorizationHeader', 'apiKey', 'password', 'privateKey', 'cookie'];
  for (const key of Object.keys(record)) {
    if (restrictedKeys.includes(key)) return false;
  }

  // Status specific constraints
  switch (record.status) {
    case 'APPROVED':
      if (!record.approvedBy || typeof record.approvedAt !== 'number') return false;
      if (record.reservedAt) return false;
      if (record.consumedAt) return false;
      break;
    case 'RESERVED':
      if (!record.approvedBy || typeof record.approvedAt !== 'number') return false;
      if (typeof record.reservedAt !== 'number' || !record.reservedByOperationId) return false;
      if (record.consumedAt) return false;
      break;
    case 'CONSUMED':
      if (!record.approvedBy || typeof record.approvedAt !== 'number') return false;
      if (typeof record.reservedAt !== 'number' || !record.reservedByOperationId) return false;
      if (typeof record.consumedAt !== 'number') return false;
      break;
    case 'INVALIDATED':
      if (typeof record.invalidatedAt !== 'number' || !record.invalidationReason) return false;
      break;
  }
  
  return true;
}
