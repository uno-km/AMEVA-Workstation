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

/**
 * Mission 상태 스냅샷 (영속화 대상).
 */
export interface MissionSnapshot {
  missionId: string;
  goalId: string;
  status: string;
  taskIds: string[];
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
}

/*
 * [도메인 종속 지역 상수]
 */
const DB_NAME = 'ameva_task_runtime_v2';
const DB_VERSION = 1;
const STORE_MISSIONS = 'missions';
const STORE_CHECKPOINTS = 'task_checkpoints';
const PERSISTENCE_SCHEMA_VERSION = 1;

/**
 * IndexedDB 연결 헬퍼.
 * 기존 ameva_agent_recovery와 다른 DB를 사용하여 V2 전용 저장소 분리.
 */
function openRuntimeDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MISSIONS)) {
        db.createObjectStore(STORE_MISSIONS, { keyPath: 'missionId' });
      }
      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        // 복합키: missionId + taskId
        db.createObjectStore(STORE_CHECKPOINTS, { keyPath: ['missionId', 'taskId'] });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('[RuntimePersistenceAdapter] IndexedDB 오픈 실패:', request.error);
      reject(request.error);
    };
  });
}

/**
 * IndexedDB 기반 RuntimePersistenceAdapter.
 * 기존 ameva_agent_recovery와 독립적인 ameva_task_runtime_v2 DB 사용.
 */
export class IndexedDBRuntimePersistenceAdapter implements IRuntimePersistenceAdapter {

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
}

/**
 * 인메모리 Persistence (테스트 및 IndexedDB 미지원 환경 폴백).
 */
export class InMemoryRuntimePersistenceAdapter implements IRuntimePersistenceAdapter {
  private readonly missions: Map<string, MissionSnapshot> = new Map();
  private readonly checkpoints: Map<string, object> = new Map();

  public async saveMissionSnapshot(snapshot: MissionSnapshot): Promise<void> {
    this.missions.set(snapshot.missionId, { ...snapshot, updatedAt: Date.now() });
  }

  public async loadMissionSnapshot(missionId: string): Promise<MissionSnapshot | null> {
    return this.missions.get(missionId) ?? null;
  }

  public async listIncompleteMissions(): Promise<MissionSnapshot[]> {
    const TERMINAL_STATUSES = new Set(['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']);
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
  }
}
