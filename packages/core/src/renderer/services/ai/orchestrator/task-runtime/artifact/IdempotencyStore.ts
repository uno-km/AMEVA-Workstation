export interface IdempotencyRecord {
  idempotencyKey: string;
  artifactId: string;
  revision: number;
  status: 'IN_PROGRESS' | 'COMMITTED' | 'CORRUPTED';
  contentHash?: string;
  leaseOwner: string;
  leaseExpiresAt?: number;
  committedResult?: any;
}

export interface IIdempotencyStore {
  acquireLease(key: string, artifactId: string, revision: number, missionId: string, taskId: string, attemptId: string, ttlMs: number): Promise<boolean>;
  getRecord(key: string): Promise<IdempotencyRecord | null>;
  markCommitted(key: string, contentHash: string): Promise<void>;
  markCorrupted(key: string): Promise<void>;
  releaseLease(key: string): Promise<void>;
}

export class PersistenceIdempotencyStore implements IIdempotencyStore {
  private readonly locks = new Set<string>();

  constructor(private adapter: import('./../persistence/RuntimePersistenceAdapter').IRuntimePersistenceAdapter) {}

  public async acquireLease(key: string, artifactId: string, revision: number, missionId: string, taskId: string, attemptId: string, ttlMs: number): Promise<boolean> {
    if (this.locks.has(key)) return false;
    this.locks.add(key);

    try {
      const existing = await this.adapter.loadIdempotencyRecord(key);
      const now = Date.now();

      if (existing) {
        if (existing.status === 'COMMITTED') {
          return false; // Already committed
        }
        if (existing.status === 'IN_PROGRESS' && existing.leaseExpiresAt && existing.leaseExpiresAt > now) {
          return false; // Valid lease exists
        }
        // If IN_PROGRESS but expired, or CORRUPTED, we can acquire
      }

      const leaseOwner = `${missionId}:${taskId}:${attemptId}`;
      const record: IdempotencyRecord = {
        idempotencyKey: key,
        artifactId,
        revision,
        status: 'IN_PROGRESS',
        leaseOwner,
        leaseExpiresAt: now + ttlMs
      };

      await this.adapter.saveIdempotencyRecord(record);
      return true;
    } finally {
      this.locks.delete(key);
    }
  }

  public async getRecord(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.adapter.loadIdempotencyRecord(key);
    if (!record) return null;
    
    // Check expiration
    if (record.status === 'IN_PROGRESS' && record.leaseExpiresAt && record.leaseExpiresAt <= Date.now()) {
      return null; // Consider it gone if expired
    }
    return record;
  }

  public async markCommitted(key: string, contentHash: string): Promise<void> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    if (existing) {
      existing.status = 'COMMITTED';
      existing.contentHash = contentHash;
      existing.leaseExpiresAt = undefined;
      // We can mock a committedResult for now
      existing.committedResult = { contentHash, timestamp: Date.now() };
      await this.adapter.saveIdempotencyRecord(existing);
    }
  }

  public async markCorrupted(key: string): Promise<void> {
    const existing = await this.adapter.loadIdempotencyRecord(key);
    if (existing) {
      existing.status = 'CORRUPTED';
      existing.leaseExpiresAt = undefined;
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
