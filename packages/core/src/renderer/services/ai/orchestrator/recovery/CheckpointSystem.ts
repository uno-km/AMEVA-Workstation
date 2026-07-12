/**
 * @file orchestrator/recovery/CheckpointSystem.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/CheckpointSystem.ts
 * @role 비동기 IndexedDB 기반 에이전트 상태 백업 매니저
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AgentOrchestrator.ts: runSingleTurn() 및 턴 경계 시점에 saveCheckpoint() 호출.
 * - RecoveryEngine.ts: Checkpoint Resume 복구 시점에 loadCheckpoint() 호출.
 */

import type { RecoveryCheckpoint } from './types';

const DB_NAME = 'ameva_agent_recovery';
const DB_VERSION = 1;
const STORE_CHECKPOINTS = 'checkpoints';
const STORE_FAILURES = 'failures';

/**
 * openDB
 * IndexedDB 커넥션을 여는 헬퍼 함수.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // [RUN-TIME STATE / INVARIANT]
    // - Rationale: 미사용 event 매개변수 경고를 회피하기 위해 접두사 _event 로 명명한다.
    request.onupgradeneeded = (_event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
        db.createObjectStore(STORE_CHECKPOINTS, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(STORE_FAILURES)) {
        db.createObjectStore(STORE_FAILURES, { autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    // [RUN-TIME STATE / INVARIANT]
    // - Rationale: 미사용 event 매개변수 경고를 회피하기 위해 접두사 _event 로 명명한다.
    request.onerror = (_event) => {
      console.error('[CheckpointSystem] IndexedDB 오픈 실패:', request.error);
      reject(request.error);
    };
  });
}

/**
 * CheckpointSystem
 * 에이전트 세션의 체크포인트를 안전하게 보존하고 복원하는 싱글톤 지향 도메인 클래스.
 */
export class CheckpointSystem {
  /**
   * 특정 세션의 체크포인트를 비동기로 백업 저장합니다.
   *
   * @param sessionId - 에이전트 세션 ID
   * @param checkpoint - 저장할 스냅샷 데이터
   */
  public static async saveCheckpoint(sessionId: string, checkpoint: Omit<RecoveryCheckpoint, 'timestamp'>): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
      const store = tx.objectStore(STORE_CHECKPOINTS);

      const record: RecoveryCheckpoint = {
        ...checkpoint,
        timestamp: Date.now()
      };

      // 세션 ID를 키로 하여 덮어씁니다.
      await new Promise<void>((resolve, reject) => {
        const req = store.put({ sessionId, ...record });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
    } catch (err) {
      console.error('[CheckpointSystem] 체크포인트 저장 실패:', err);
    }
  }

  /**
   * 특정 세션의 마지막 백업 체크포인트를 로드합니다.
   *
   * @param sessionId - 조회할 에이전트 세션 ID
   * @returns 복원용 RecoveryCheckpoint 객체 (없을 경우 null)
   */
  public static async loadCheckpoint(sessionId: string): Promise<RecoveryCheckpoint | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_CHECKPOINTS, 'readonly');
      const store = tx.objectStore(STORE_CHECKPOINTS);

      const result = await new Promise<any>((resolve, reject) => {
        const req = store.get(sessionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return result || null;
    } catch (err) {
      console.error('[CheckpointSystem] 체크포인트 로드 실패:', err);
      return null;
    }
  }

  /**
   * 특정 세션의 체크포인트 데이터를 말소합니다.
   *
   * @param sessionId - 말소할 에이전트 세션 ID
   */
  public static async clearCheckpoint(sessionId: string): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_CHECKPOINTS, 'readwrite');
      const store = tx.objectStore(STORE_CHECKPOINTS);

      await new Promise<void>((resolve, reject) => {
        const req = store.delete(sessionId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
    } catch (err) {
      console.error('[CheckpointSystem] 체크포인트 삭폐 실패:', err);
    }
  }
}
