import { describe, it, expect, vi } from 'vitest';
import { SchemaMigrationEngine } from '../../persistence/SchemaMigration';

describe('Phase 6.4.1A-2: Schema Migration V2 -> V3', () => {
  const createMockTransaction = (records: any[]) => {
    const store = {
      openCursor: vi.fn().mockImplementation(() => {
        let index = 0;
        const req: any = {
          result: null,
          onsuccess: null,
          onerror: null
        };
        
        setTimeout(() => {
          const next = () => {
            if (index < records.length) {
              req.result = {
                value: records[index],
                update: vi.fn(),
                continue: () => {
                  index++;
                  setTimeout(next, 0);
                }
              };
            } else {
              req.result = null;
            }
            if (req.onsuccess) req.onsuccess();
          };
          next();
        }, 0);
        
        return req;
      })
    };

    return {
      objectStore: vi.fn().mockReturnValue(store)
    } as unknown as IDBTransaction;
  };

  const db = {
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(true)
    }
  } as unknown as IDBDatabase;

  it('migrates valid V2 record to V3', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).resolves.toBeUndefined();
    expect(records[0].schemaVersion).toBe(3);
  });

  it('rejects if previewDigest is missing', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      operationDigest: 'od',
      affectedPathsDigest: 'apd'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('NEW_PREVIEW_REQUIRED');
  });

  it('rejects if operationDigest is missing', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      previewDigest: 'pd',
      affectedPathsDigest: 'apd'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('NEW_APPROVAL_REQUIRED');
  });

  it('rejects if affectedPathsDigest is missing', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      previewDigest: 'pd',
      operationDigest: 'od'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('NEW_APPROVAL_REQUIRED');
  });

  it('rejects if RESERVED state lacks reservedAt', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'RESERVED',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('CORRUPTED_PERSISTED_STATE');
  });

  it('rejects if CONSUMED state lacks consumedAt', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'CONSUMED',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('CORRUPTED_PERSISTED_STATE');
  });

  it('rejects if unsupported schemaVersion is present', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      schemaVersion: 4
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('rejects if sensitive tokens are present', async () => {
    const records = [{
      approvalId: 'app_1',
      status: 'REQUESTED',
      previewDigest: 'pd',
      operationDigest: 'od',
      affectedPathsDigest: 'apd',
      someField: 'my approvalToken is secret'
    }];
    const tx = createMockTransaction(records);
    await expect(SchemaMigrationEngine.runMigrations(db, tx, 2, 3)).rejects.toThrow('SENSITIVE_VALUE_NOT_ALLOWED');
  });
});
