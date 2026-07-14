export interface IdempotencyRecord {
  idempotencyKey: string;
  artifactId: string;
  revision: number;
  missionId: string;
  taskId: string;
  attemptId: string;
  status: 'IN_PROGRESS' | 'COMMITTED' | 'CORRUPTED';
  contentHash?: string;
  expiresAt?: number;
}

export interface IIdempotencyStore {
  acquireLease(key: string, artifactId: string, revision: number, missionId: string, taskId: string, attemptId: string, ttlMs: number): Promise<boolean>;
  getRecord(key: string): Promise<IdempotencyRecord | null>;
  markCommitted(key: string, contentHash: string): Promise<void>;
  markCorrupted(key: string): Promise<void>;
  releaseLease(key: string): Promise<void>;
}

export class PersistenceIdempotencyStore implements IIdempotencyStore {
  constructor(private adapter: import('./../persistence/RuntimePersistenceAdapter').IRuntimePersistenceAdapter) {}

  public async acquireLease(key: string, artifactId: string, revision: number, missionId: string, taskId: string, attemptId: string, ttlMs: number): Promise<boolean> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    const now = Date.now();

    if (existing) {
      if (existing.status === 'COMMITTED') {
        return false; // Already committed
      }
      if (existing.status === 'IN_PROGRESS' && existing.expiresAt && existing.expiresAt > now) {
        return false; // Valid lease exists
      }
      // If IN_PROGRESS but expired, or CORRUPTED, we can acquire
    }

    const record: IdempotencyRecord = {
      idempotencyKey: key,
      artifactId,
      revision,
      missionId,
      taskId,
      attemptId,
      status: 'IN_PROGRESS',
      expiresAt: now + ttlMs
    };

    await this.adapter.saveIdempotencyRecord(record);
    return true;
  }

  public async getRecord(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.adapter.loadIdempotencyRecord(key);
    if (!record) return null;
    
    // Check expiration
    if (record.status === 'IN_PROGRESS' && record.expiresAt && record.expiresAt <= Date.now()) {
      return null; // Consider it gone if expired
    }
    return record;
  }

  public async markCommitted(key: string, contentHash: string): Promise<void> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    if (existing) {
      existing.status = 'COMMITTED';
      existing.contentHash = contentHash;
      existing.expiresAt = undefined;
      await this.adapter.saveIdempotencyRecord(existing);
    }
  }

  public async markCorrupted(key: string): Promise<void> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    if (existing) {
      existing.status = 'CORRUPTED';
      existing.expiresAt = undefined;
      await this.adapter.saveIdempotencyRecord(existing);
    }
  }

  public async releaseLease(key: string): Promise<void> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    if (existing && existing.status === 'IN_PROGRESS') {
      await this.adapter.deleteIdempotencyRecord(key);
    }
  }
}
