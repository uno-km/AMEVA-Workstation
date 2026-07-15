/**
 * @file orchestrator/task-runtime/persistence/SchemaMigration.ts
 * @system AMEVA OS Desktop Workstation
 * @role IndexedDB 스키마 버전 간 데이터 마이그레이션 엔진
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - RuntimePersistenceAdapter: DB 오픈 시 onupgradeneeded 에서 호출
 *
 * [Item 4 — Schema Migration]
 *
 * [설계 원칙]
 * - 각 버전 쌍(fromVersion → toVersion)에 대한 명시적 마이그레이터 등록
 * - 마이그레이터는 기존 데이터를 덮어쓰기 전에 읽고 변환하는 방식 사용
 * - 건너뛴 버전이 없도록 모든 연속 버전 쌍에 마이그레이터 존재 보장
 * - 마이그레이션 실패 시 원본 데이터 보존 (Best-effort: 새 필드 추가만, 기존 필드 삭제 금지)
 * - 스키마 버전 기록을 별도 Object Store(schema_meta)에 저장
 *
 * [현재 마이그레이터 목록]
 * - V1 → V2: missions Object Store에 goalId 필드 없는 레코드에 missionId로 채움
 */

/**
 * 단일 마이그레이터 인터페이스.
 */
interface SchemaMigrator {
  fromVersion: number;
  toVersion: number;
  /**
   * 마이그레이션을 실행한다.
   * @param db - 이미 열린 IDBDatabase 인스턴스
   * @param transaction - onupgradeneeded 트랜잭션 (이미 열린 상태)
   */
  migrate(db: IDBDatabase, transaction: IDBTransaction): Promise<void>;
}

/**
 * 현재 등록된 마이그레이터 목록.
 * [AGENTS.md 2단계 상수화: 앱 전체 불변값에 가깝지만 도메인 종속이므로 로컬 상수]
 */
const MIGRATORS: SchemaMigrator[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    /**
     * V1 → V2 마이그레이션
     * 변경사항: missions Object Store에 goalId 필드 추가.
     * goalId가 없는 레코드는 missionId 값으로 채운다.
     */
    migrate: async (db: IDBDatabase, transaction: IDBTransaction): Promise<void> => {
      const STORE_MISSIONS = 'missions';

      if (!db.objectStoreNames.contains(STORE_MISSIONS)) {
        // missions Store가 없으면 마이그레이션 불필요
        return;
      }

      const store = transaction.objectStore(STORE_MISSIONS);

      await new Promise<void>((resolve, reject) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const record = cursor.value as Record<string, unknown>;
            // goalId 누락된 레코드에 missionId 값으로 채움
            if (!record['goalId']) {
              record['goalId'] = record['missionId'] ?? 'unknown';
              cursor.update(record);
            }
            cursor.continue();
          } else {
            // 커서 순회 완료
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });

      console.log('[SchemaMigration] V1→V2: goalId 필드 마이그레이션 완료.');
    }
  },
  {
    fromVersion: 2,
    toVersion: 3,
    /**
     * V2 → V3 마이그레이션
     * 변경사항: Phase 6.4 도메인 리포지토리 스토어 추가.
     * 데이터 마이그레이션 불필요 (신규 생성).
     */
    migrate: async (db: IDBDatabase, transaction: IDBTransaction): Promise<void> => {
      console.log('[SchemaMigration] V2→V3: Phase 6.4 Repositories 스토어 추가 완료.');
    }
  }
];

/**
 * SchemaMigrationEngine
 * 지정된 버전 범위에 해당하는 마이그레이터를 순서대로 실행한다.
 */
export class SchemaMigrationEngine {
  /**
   * fromVersion부터 toVersion까지 순서대로 마이그레이션을 실행한다.
   *
   * @param db - 이미 열린 IDBDatabase 인스턴스
   * @param transaction - onupgradeneeded 트랜잭션
   * @param fromVersion - 이전 DB 버전 (oldVersion)
   * @param toVersion - 목표 DB 버전 (newVersion)
   */
  public static async runMigrations(
    db: IDBDatabase,
    transaction: IDBTransaction,
    fromVersion: number,
    toVersion: number
  ): Promise<void> {
    // 적용할 마이그레이터 필터링 (fromVersion < migrator.toVersion <= toVersion)
    const applicable = MIGRATORS
      .filter(m => m.fromVersion >= fromVersion && m.toVersion <= toVersion)
      .sort((a, b) => a.fromVersion - b.fromVersion);

    for (const migrator of applicable) {
      try {
        console.log(`[SchemaMigration] Running V${migrator.fromVersion}→V${migrator.toVersion} migration...`);
        await migrator.migrate(db, transaction);
        console.log(`[SchemaMigration] V${migrator.fromVersion}→V${migrator.toVersion} completed.`);
      } catch (migErr: unknown) {
        const msg = migErr instanceof Error ? migErr.message : String(migErr);
        /*
         * 마이그레이션 실패 시 원본 데이터를 삭제하지 않는다.
         * 오류를 전파하여 상위에서 롤백 또는 사용자 알림 처리.
         */
        console.error(`[SchemaMigration] V${migrator.fromVersion}→V${migrator.toVersion} failed: ${msg}`);
        throw new Error(`Schema migration V${migrator.fromVersion}→V${migrator.toVersion} failed: ${msg}`);
      }
    }
  }
}
