/**
 * @file orchestrator/recovery/FailureMemory.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/orchestrator/recovery/FailureMemory.ts
 * @role IndexedDB 기반 복구/실패 이력 ReadOnly 기록 저장소
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - RecoveryEngine.ts: 복구 액션 결과 기록 시 recordFailure() 호출.
 * - SupervisorAgent.ts: 복구 실패 카운트를 쿼리하여 모니터링 및 진단 정보로 참조.
 */

import type { FailureEvent } from './types';

const DB_NAME = 'ameva_agent_recovery';
const DB_VERSION = 1;
const STORE_FAILURES = 'failures';

/**
 * openDB
 * IndexedDB 커넥션을 여는 내부 헬퍼.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * FailureMemory
 * 에이전트 오동작 복구 시도 이력을 안전하게 영속 보존하는 데이터 레이어 매니저.
 * 나쁜 자동 학습(오버피팅)을 유발하는 지능형 임계치 변경 정책을 배제하고,
 * 시스템 무결성 유지를 위해 철저히 ReadOnly 관점의 통계와 이력 로깅 역할만을 수행합니다.
 */
export class FailureMemory {
  /**
   * 발생한 장애/복구 이벤트를 기록합니다.
   *
   * @param event - 기록할 실패 이벤트 데이터 (timestamp 자동 추가)
   */
  public static async recordFailure(event: Omit<FailureEvent, 'timestamp'>): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_FAILURES, 'readwrite');
      const store = tx.objectStore(STORE_FAILURES);

      const record: FailureEvent = {
        ...event,
        timestamp: Date.now()
      };

      await new Promise<void>((resolve, reject) => {
        const req = store.add(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
      console.info(`[FailureMemory] 장애 이력 기록 완료: ${event.reason} (성공여부: ${event.success})`);
    } catch (err) {
      console.error('[FailureMemory] 장애 이력 기록 실패:', err);
    }
  }

  /**
   * 최근 지정한 시간 범위(밀리초) 내에 발생한 특정 오류의 누적 횟수를 조회합니다.
   *
   * @param milliseconds - 탐색할 시간 범위 (예: 최근 5분 = 300,000)
   * @returns 해당 기간 내 기록된 FailureEvent 배열
   */
  public static async getRecentFailures(milliseconds: number): Promise<FailureEvent[]> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_FAILURES, 'readonly');
      const store = tx.objectStore(STORE_FAILURES);

      const list: FailureEvent[] = await new Promise<FailureEvent[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      db.close();

      const limitTime = Date.now() - milliseconds;
      return list.filter(e => e.timestamp >= limitTime);
    } catch (err) {
      console.error('[FailureMemory] 최근 장애 이력 조회 실패:', err);
      return [];
    }
  }

  /**
   * 누적된 모든 장애 이력을 삭제합니다.
   */
  public static async clearAllHistory(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_FAILURES, 'readwrite');
      const store = tx.objectStore(STORE_FAILURES);

      await new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      db.close();
      console.info('[FailureMemory] 모든 장애 이력 삭제 완료');
    } catch (err) {
      console.error('[FailureMemory] 이력 삭제 중 오류:', err);
    }
  }
}
