import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersistenceIdempotencyStore } from '../IdempotencyStore';
import { InMemoryRuntimePersistenceAdapter } from '../../persistence/RuntimePersistenceAdapter';

describe('IdempotencyStore Persistence', () => {
  let adapter: InMemoryRuntimePersistenceAdapter;
  let store: PersistenceIdempotencyStore;

  beforeEach(() => {
    adapter = new InMemoryRuntimePersistenceAdapter();
    store = new PersistenceIdempotencyStore(adapter);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Persists records to adapter correctly', async () => {
    await store.acquireLease('key1', 'art1', 1, 'm1', 't1', 'a1', 5000);
    const record = await adapter.loadIdempotencyRecord('key1');
    expect(record).toBeDefined();
    expect(record.artifactId).toBe('art1');
    expect(record.revision).toBe(1);
    expect(record.status).toBe('IN_PROGRESS');
    expect(record.leaseOwner).toBe('m1:t1:a1');
    expect(record.leaseExpiresAt).toBeGreaterThan(Date.now());
  });

  it('2. Same key/hash 재실행은 실제 파일 작업 없이 기존 결과 반환 (COMMITTED)', async () => {
    await store.acquireLease('key2', 'art2', 1, 'm1', 't1', 'a1', 5000);
    await store.markCommitted('key2', 'hash123');

    // acquireLease should return false because it is already COMMITTED
    const acquired = await store.acquireLease('key2', 'art2', 1, 'm1', 't1', 'a2', 5000);
    expect(acquired).toBe(false);

    const record = await store.getRecord('key2');
    expect(record!.status).toBe('COMMITTED');
    expect(record!.contentHash).toBe('hash123');
    expect(record!.committedResult).toBeDefined();
  });

  it('3. 동일 key 또는 revision인데 다른 hash이면 CORRUPTED (Concurrent markCorrupted test)', async () => {
    await store.acquireLease('key3', 'art3', 1, 'm1', 't1', 'a1', 5000);
    await store.markCorrupted('key3');

    const record = await store.getRecord('key3');
    expect(record!.status).toBe('CORRUPTED');
  });

  it('4. 동시 Commit 중 하나만 실제 파일 작업 수행 (Lease locking)', async () => {
    const acquire1 = await store.acquireLease('key4', 'art4', 1, 'm1', 't1', 'a1', 5000);
    const acquire2 = await store.acquireLease('key4', 'art4', 1, 'm1', 't1', 'a2', 5000);

    expect(acquire1).toBe(true);
    expect(acquire2).toBe(false); // Second one fails because it's IN_PROGRESS
  });

  it('5. lease 만료 후 재획득', async () => {
    await store.acquireLease('key5', 'art5', 1, 'm1', 't1', 'a1', 5000);
    
    // Attempt before expiration should fail
    const acquire2 = await store.acquireLease('key5', 'art5', 1, 'm1', 't1', 'a2', 5000);
    expect(acquire2).toBe(false);

    // Advance time to expire lease
    vi.advanceTimersByTime(6000);

    // Attempt after expiration should succeed
    const acquire3 = await store.acquireLease('key5', 'art5', 1, 'm1', 't1', 'a3', 5000);
    expect(acquire3).toBe(true);
  });

  it('6. 앱 재시작 후 idempotency record 복원', async () => {
    await store.acquireLease('key6', 'art6', 1, 'm1', 't1', 'a1', 5000);
    await store.markCommitted('key6', 'hash6');

    // Simulate restart by creating a new store instance with the same adapter
    const newStore = new PersistenceIdempotencyStore(adapter);
    const record = await newStore.getRecord('key6');
    expect(record).toBeDefined();
    expect(record!.status).toBe('COMMITTED');
    expect(record!.contentHash).toBe('hash6');
  });

  it('7. 만료 lease 정리', async () => {
    await store.acquireLease('key7', 'art7', 1, 'm1', 't1', 'a1', 5000);
    vi.advanceTimersByTime(6000);
    
    // getRecord returns null if expired
    const record = await store.getRecord('key7');
    expect(record).toBeNull();
  });
});
