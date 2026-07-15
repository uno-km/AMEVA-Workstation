/**
 * @file orchestrator/task-runtime/persistence/RuntimePersistenceAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task Runtime 상태의 영속화 인터페이스 및 IndexedDB 기반 구현체
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionExecutionRuntime: Mission 상태 저장/복원
 * - RuntimeRestoreCoordinator: 앱 재시작 시 복원
 *
 * [STAGE H — Persistence 및 앱 재시작 복원]
 *
 * [설계 원칙]
 * - 기존 IndexedDB 인프라(ameva_agent_recovery) 재사용 — 중복 엔진 생성 금지
 * - LocalStorage를 핵심 Runtime 저장소로 사용하지 않음 (LocalStorage = 비핵심 메타데이터만)
 * - 원자성: 상태 저장 실패 시 기존 데이터 삭제 금지
 * - Mission별 독립적인 Object Store 관리
 *
 * [현재 상태]
 * - PARTIALLY_CONNECTED: Mission Snapshot과 Checkpoint 영속화 구현됨
 * - NOT_IMPLEMENTED: Schema Migration, Event Compaction (추후 구현)
 * - DISABLED_SAFELY: Event Retention 상한 (인메모리 EventLog로 대체)
 */

export interface TaskBudgetSnapshot {
  maxExecutionRetries: number;
  executionRetryCount: number;
  maxSemanticCriticCalls: number;
  semanticCriticCallCount: number;
  maxRepairAttempts: number;
  repairAttemptCount: number;
  maxSameDefectRepeats: number;
  sameDefectRepeatCount: number;
  maxTotalVerificationTimeMs: number;
  verificationStartedAt?: number;
}

/**
 * Mission 상태 스냅샷 (영속화 대상).
 */
export interface MissionSnapshot {
  missionId: string;
  goalId: string;
  status: string;
  taskIds: string[];
  taskBudgets?: Record<string, TaskBudgetSnapshot>; // Phase 3.1
  taskRoutingDecisions?: Record<string, unknown>; // Phase 5.1
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  integrityDigest: string;
}

/**
 * Runtime Persistence 인터페이스.
 * 구현체를 교체 가능하도록 분리함 (In-Memory / IndexedDB / SQLite 등).
 */
export interface IRuntimePersistenceAdapter {
  saveMissionSnapshot(snapshot: MissionSnapshot): Promise<void>;
  loadMissionSnapshot(missionId: string): Promise<MissionSnapshot | null>;
  listIncompleteMissions(): Promise<MissionSnapshot[]>;
  saveCheckpointData(missionId: string, taskId: string, data: object): Promise<void>;
  loadCheckpointData(missionId: string, taskId: string): Promise<object | null>;
  deleteMission(missionId: string): Promise<void>;
  
  // Artifact Manifests
  saveArtifactManifest(manifest: unknown): Promise<void>; // using unknown here to avoid circular dep or we can import ArtifactManifest
  loadArtifactManifest(missionId: string, artifactId: string): Promise<any | null>;
  listArtifactManifests(missionId: string): Promise<any[]>;

  // Idempotency
  saveIdempotencyRecord(record: unknown): Promise<void>;
  loadIdempotencyRecord(key: string): Promise<any | null>;
  deleteIdempotencyRecord(key: string): Promise<void>;

  // Domain-specific Repositories (Phase 6.4)
  readonly artifacts: import('./RepositoryInterfaces').IArtifactRepositoryPersistence;
  readonly approvals: import('./RepositoryInterfaces').IApprovalRepositoryPersistence;
  readonly sourceApply: import('./RepositoryInterfaces').ISourceApplyRepositoryPersistence;
}

/*
 * [도메인 종속 지역 상수]
 */
const DB_NAME = 'ameva_task_runtime_v2';
const DB_VERSION = 3; // [Item 4] V3로 버전 업 (Phase 6.4 Domain Repositories 추가)
const STORE_MISSIONS = 'missions';
const STORE_CHECKPOINTS = 'task_checkpoints';
const PERSISTENCE_SCHEMA_VERSION = 3;

import { SchemaMigrationEngine } from './SchemaMigration';

const STORE_ARTIFACT_MANIFESTS = 'artifact_manifests';

/**
 * IndexedDB 연결 헬퍼.
 * [Item 4] onupgradeneeded에서 SchemaMigrationEngine을 호출한다.
 */
export function openRuntimeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion ?? DB_VERSION;

      // Object Store 생성 (최초 생성 시)
      if (!db.objectStoreNames.contains(STORE_MISSIONS)) {
        db.createObjectStore(STORE_MISSIONS, { keyPath: 'missionId' });
      }
      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        db.createObjectStore(STORE_CHECKPOINTS, { keyPath: ['missionId', 'taskId'] });
      }
      if (!db.objectStoreNames.contains(STORE_ARTIFACT_MANIFESTS)) {
        db.createObjectStore(STORE_ARTIFACT_MANIFESTS, { keyPath: ['missionId', 'artifactId'] });
      }
      if (!db.objectStoreNames.contains('idempotency_records')) {
        db.createObjectStore('idempotency_records', { keyPath: 'idempotencyKey' });
      }

      // Phase 6.4 Domain Repositories Object Stores
      if (!db.objectStoreNames.contains('artifact_repository')) {
        db.createObjectStore('artifact_repository', { keyPath: 'repositoryArtifactId' });
      }
      if (!db.objectStoreNames.contains('artifact_retention_metadata')) {
        db.createObjectStore('artifact_retention_metadata', { keyPath: 'repositoryArtifactId' });
      }
      if (!db.objectStoreNames.contains('approval_records')) {
        db.createObjectStore('approval_records', { keyPath: 'approvalId' });
      }
      if (!db.objectStoreNames.contains('source_apply_requests')) {
        db.createObjectStore('source_apply_requests', { keyPath: 'sourceApplyRequestId' });
      }
      if (!db.objectStoreNames.contains('source_apply_previews')) {
        db.createObjectStore('source_apply_previews', { keyPath: 'requestId' });
      }
      if (!db.objectStoreNames.contains('source_apply_operations')) {
        db.createObjectStore('source_apply_operations', { keyPath: 'operationId' });
      }
      if (!db.objectStoreNames.contains('rollback_snapshots')) {
        db.createObjectStore('rollback_snapshots', { keyPath: 'rollbackSnapshotId' });
      }
      if (!db.objectStoreNames.contains('apply_verifications')) {
        db.createObjectStore('apply_verifications', { keyPath: 'verificationId' });
      }

      if (!db.objectStoreNames.contains('approval_authorization_tickets')) {
        db.createObjectStore('approval_authorization_tickets', { keyPath: 'authorizationTicketId' });
      }

      // Add indexes to approval_records if not exist
      if (db.objectStoreNames.contains('approval_records')) {
        const store = (event.target as IDBOpenDBRequest).transaction!.objectStore('approval_records');
        if (!store.indexNames.contains('missionId')) store.createIndex('missionId', 'missionId', { unique: false });
        if (!store.indexNames.contains('workbenchSessionId')) store.createIndex('workbenchSessionId', 'workbenchSessionId', { unique: false });
        if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
        if (!store.indexNames.contains('expiresAt')) store.createIndex('expiresAt', 'expiresAt', { unique: false });
        if (!store.indexNames.contains('reservedByOperationId')) store.createIndex('reservedByOperationId', 'reservedByOperationId', { unique: false });
        if (!store.indexNames.contains('updatedAt')) store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Add indexes to approval_authorization_tickets if not exist
      if (db.objectStoreNames.contains('approval_authorization_tickets')) {
        const store = (event.target as IDBOpenDBRequest).transaction!.objectStore('approval_authorization_tickets');
        if (!store.indexNames.contains('approvalId')) store.createIndex('approvalId', 'approvalId', { unique: false });
        if (!store.indexNames.contains('sourceApplyOperationId')) store.createIndex('sourceApplyOperationId', 'sourceApplyOperationId', { unique: false });
        if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
        if (!store.indexNames.contains('expiresAt')) store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      // [Item 4] Schema Migration 실행
      SchemaMigrationEngine.runMigrations(db, transaction, oldVersion, newVersion)
        .catch((migErr: unknown) => {
          const msg = migErr instanceof Error ? migErr.message : String(migErr);
          console.error('[RuntimePersistenceAdapter] Schema migration failed:', msg);
          // migration 실패는 transaction에서 abort되지 않으나 경고 기록
        });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[RuntimePersistenceAdapter] IndexedDB 오픈 실패:', request.error);
      reject(request.error);
    };
  });
}

import { ArtifactRepositoryIndexedDB, ApprovalRepositoryIndexedDB, SourceApplyRepositoryIndexedDB } from './IndexedDBRepositories';

/**
 * IndexedDB 기반 RuntimePersistenceAdapter.
 * 기존 ameva_agent_recovery와 독립적인 ameva_task_runtime_v2 DB 사용.
 */
export class IndexedDBRuntimePersistenceAdapter implements IRuntimePersistenceAdapter {
  public readonly artifacts = new ArtifactRepositoryIndexedDB(openRuntimeDB);
  public readonly approvals = new ApprovalRepositoryIndexedDB(openRuntimeDB);
  public readonly sourceApply = new SourceApplyRepositoryIndexedDB(openRuntimeDB);

  /**
   * Mission 스냅샷을 저장한다.
   * 저장 실패 시 기존 데이터를 삭제하지 않는다 (원자성).
   */
  public async saveMissionSnapshot(snapshot: MissionSnapshot): Promise<void> {
    const record: MissionSnapshot = {
      ...snapshot,
      updatedAt: Date.now(),
      schemaVersion: PERSISTENCE_SCHEMA_VERSION
    };

    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MISSIONS, 'readwrite');
        const req = tx.objectStore(STORE_MISSIONS).put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Mission 스냅샷 저장 실패 (${snapshot.missionId}):`, msg);
      // 저장 실패해도 기존 데이터 삭제하지 않음 — 원자성 보장
      throw new Error(`Mission snapshot save failed: ${msg}`);
    }
  }

  /**
   * Mission 스냅샷을 조회한다.
   */
  public async loadMissionSnapshot(missionId: string): Promise<MissionSnapshot | null> {
    try {
      const db = await openRuntimeDB();
      const result = await new Promise<MissionSnapshot | null>((resolve, reject) => {
        const tx = db.transaction(STORE_MISSIONS, 'readonly');
        const req = tx.objectStore(STORE_MISSIONS).get(missionId);
        req.onsuccess = () => resolve((req.result as MissionSnapshot) ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Mission 스냅샷 조회 실패 (${missionId}):`, msg);
      return null;
    }
  }

  /**
   * 미완료 Mission 목록을 조회한다.
   * 앱 재시작 복원에 사용됨.
   */
  public async listIncompleteMissions(): Promise<MissionSnapshot[]> {
    try {
      const db = await openRuntimeDB();
      const allMissions = await new Promise<MissionSnapshot[]>((resolve, reject) => {
        const tx = db.transaction(STORE_MISSIONS, 'readonly');
        const req = tx.objectStore(STORE_MISSIONS).getAll();
        req.onsuccess = () => resolve((req.result as MissionSnapshot[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      db.close();

      // 완료/취소 상태 제외
      const TERMINAL_STATUSES = new Set(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']);
      return allMissions.filter(m => !TERMINAL_STATUSES.has(m.status));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RuntimePersistenceAdapter] 미완료 Mission 목록 조회 실패:', msg);
      return [];
    }
  }

  /**
   * Task Checkpoint 데이터를 저장한다.
   */
  public async saveCheckpointData(missionId: string, taskId: string, data: object): Promise<void> {
    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
        const req = tx.objectStore(STORE_CHECKPOINTS).put({ missionId, taskId, data, savedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Checkpoint 저장 실패 (${taskId}):`, msg);
      throw new Error(`Checkpoint save failed: ${msg}`);
    }
  }

  /**
   * Task Checkpoint 데이터를 조회한다.
   */
  public async loadCheckpointData(missionId: string, taskId: string): Promise<object | null> {
    try {
      const db = await openRuntimeDB();
      const result = await new Promise<{ data: object } | null>((resolve, reject) => {
        const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
        const req = tx.objectStore(STORE_CHECKPOINTS).get([missionId, taskId]);
        req.onsuccess = () => resolve((req.result as { data: object }) ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result?.data ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Checkpoint 조회 실패 (${taskId}):`, msg);
      return null;
    }
  }

  /**
   * Mission 관련 모든 데이터를 삭제한다.
   * Finalized Mission의 경우 Audit Package는 삭제하지 않아야 함 (호출자 책임).
   */
  public async deleteMission(missionId: string): Promise<void> {
    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_MISSIONS, STORE_CHECKPOINTS], 'readwrite');
        tx.objectStore(STORE_MISSIONS).delete(missionId);
        // Checkpoint는 복합키라 커서로 삭제
        const cpStore = tx.objectStore(STORE_CHECKPOINTS);
        const req = cpStore.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            if ((cursor.key as string[])[0] === missionId) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Mission 삭제 실패 (${missionId}):`, msg);
      throw new Error(`Mission delete failed: ${msg}`);
    }
  }

  // Artifact Manifests
  public async saveArtifactManifest(manifest: unknown): Promise<void> {
    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTIFACT_MANIFESTS, 'readwrite');
        const req = tx.objectStore(STORE_ARTIFACT_MANIFESTS).put(manifest);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] ArtifactManifest 저장 실패 (${manifest.artifactId}):`, msg);
      throw new Error(`ArtifactManifest save failed: ${msg}`);
    }
  }

  public async loadArtifactManifest(missionId: string, artifactId: string): Promise<any | null> {
    try {
      const db = await openRuntimeDB();
      const result = await new Promise<any | null>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTIFACT_MANIFESTS, 'readonly');
        const req = tx.objectStore(STORE_ARTIFACT_MANIFESTS).get([missionId, artifactId]);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] ArtifactManifest 조회 실패 (${artifactId}):`, msg);
      return null;
    }
  }

  public async listArtifactManifests(missionId: string): Promise<any[]> {
    try {
      const db = await openRuntimeDB();
      const manifests = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTIFACT_MANIFESTS, 'readonly');
        const req = tx.objectStore(STORE_ARTIFACT_MANIFESTS).getAll();
        req.onsuccess = () => {
          const all = (req.result as unknown[]) ?? [];
          resolve(all.filter(m => m.missionId === missionId));
        };
        req.onerror = () => reject(req.error);
      });
      db.close();
      return manifests;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] ArtifactManifest 목록 조회 실패 (${missionId}):`, msg);
      return [];
    }
  }

  // Idempotency
  public async saveIdempotencyRecord(record: unknown): Promise<void> {
    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('idempotency_records', 'readwrite');
        const req = tx.objectStore('idempotency_records').put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RuntimePersistenceAdapter] Idempotency 저장 실패 (${record.idempotencyKey}):`, msg);
      throw new Error(`Idempotency save failed: ${msg}`);
    }
  }

  public async loadIdempotencyRecord(key: string): Promise<any | null> {
    try {
      const db = await openRuntimeDB();
      const result = await new Promise<any | null>((resolve, reject) => {
        const tx = db.transaction('idempotency_records', 'readonly');
        const req = tx.objectStore('idempotency_records').get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    } catch (err: unknown) {
      console.error(`[RuntimePersistenceAdapter] Idempotency 조회 실패 (${key}):`, err);
      return null;
    }
  }

  public async deleteIdempotencyRecord(key: string): Promise<void> {
    try {
      const db = await openRuntimeDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('idempotency_records', 'readwrite');
        const req = tx.objectStore('idempotency_records').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (err: unknown) {
      console.error(`[RuntimePersistenceAdapter] Idempotency 삭제 실패 (${key}):`, err);
    }
  }
}

import { ArtifactRepositoryInMemory, ApprovalRepositoryInMemory, SourceApplyRepositoryInMemory } from './InMemoryRepositories';

/**
 * 인메모리 Persistence (테스트 및 IndexedDB 미지원 환경 폴백).
 */
export class InMemoryRuntimePersistenceAdapter implements IRuntimePersistenceAdapter {
  public readonly artifacts = new ArtifactRepositoryInMemory();
  public readonly approvals = new ApprovalRepositoryInMemory();
  public readonly sourceApply = new SourceApplyRepositoryInMemory();
  private readonly missions: Map<string, MissionSnapshot> = new Map();
  private readonly checkpoints: Map<string, object> = new Map();
  private readonly manifests: Map<string, any> = new Map();

  public async saveMissionSnapshot(snapshot: MissionSnapshot): Promise<void> {
    this.missions.set(snapshot.missionId, { ...snapshot, updatedAt: Date.now() });
  }

  public async loadMissionSnapshot(missionId: string): Promise<MissionSnapshot | null> {
    return this.missions.get(missionId) ?? null;
  }

  public async listIncompleteMissions(): Promise<MissionSnapshot[]> {
    const TERMINAL_STATUSES = new Set(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED', 'COMPLETED']);
    return [...this.missions.values()].filter(m => !TERMINAL_STATUSES.has(m.status));
  }

  public async saveCheckpointData(missionId: string, taskId: string, data: object): Promise<void> {
    this.checkpoints.set(`${missionId}:${taskId}`, data);
  }

  public async loadCheckpointData(missionId: string, taskId: string): Promise<object | null> {
    return this.checkpoints.get(`${missionId}:${taskId}`) ?? null;
  }

  public async deleteMission(missionId: string): Promise<void> {
    this.missions.delete(missionId);
    for (const key of this.checkpoints.keys()) {
      if (key.startsWith(`${missionId}:`)) {
        this.checkpoints.delete(key);
      }
    }
    for (const key of this.manifests.keys()) {
      if (key.startsWith(`${missionId}:`)) {
        this.manifests.delete(key);
      }
    }
  }

  // Artifact Manifests
  public async saveArtifactManifest(manifest: unknown): Promise<void> {
    this.manifests.set(`${manifest.missionId}:${manifest.artifactId}`, manifest);
  }

  public async loadArtifactManifest(missionId: string, artifactId: string): Promise<any | null> {
    return this.manifests.get(`${missionId}:${artifactId}`) ?? null;
  }

  public async listArtifactManifests(missionId: string): Promise<any[]> {
    const results: unknown[] = [];
    for (const [key, val] of this.manifests.entries()) {
      if (key.startsWith(`${missionId}:`)) {
        results.push(val);
      }
    }
    return results;
  }

  // Idempotency
  private readonly idempotencyRecords = new Map<string, any>();

  public async saveIdempotencyRecord(record: unknown): Promise<void> {
    this.idempotencyRecords.set(record.idempotencyKey, record);
  }

  public async loadIdempotencyRecord(key: string): Promise<any | null> {
    return this.idempotencyRecords.get(key) ?? null;
  }

  public async deleteIdempotencyRecord(key: string): Promise<void> {
    this.idempotencyRecords.delete(key);
  }
}
