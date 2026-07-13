/**
 * @file orchestrator/task-runtime/persistence/RuntimeRestoreCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 앱 재시작 시 미완료 Mission을 안전한 상태로 복원하는 코디네이터
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 앱 초기화 시 (main renderer 진입점 또는 AI 패널 마운트 시)
 *
 * [STAGE H — Persistence 및 앱 재시작 복원]
 *
 * [복원 원칙]
 * 1. RUNNING 상태 Task를 그대로 재개하지 않음 (이전 ExecutionHandle이 소멸했으므로)
 * 2. RUNNING → PAUSED 또는 RECOVERING으로 안전하게 전환
 * 3. 오래된 Lease 만료 처리
 * 4. Checkpoint가 있으면 Resume 옵션 제공 (자동 재개 아님)
 * 5. 사용자 또는 명시적 정책 승인 후에만 Scheduler 시작
 *
 * [현재 상태]
 * - PARTIALLY_CONNECTED: Mission 목록 조회 및 상태 표시 구현됨
 * - NOT_IMPLEMENTED: 자동 Scheduler 재시작 (사용자 승인 필요)
 */

import type { IRuntimePersistenceAdapter, MissionSnapshot } from './RuntimePersistenceAdapter';
import type { ArtifactTransactionManager } from '../artifact/ArtifactTransactionManager';

/**
 * 복원된 Mission 정보.
 */
export interface RestoredMissionInfo {
  missionId: string;
  goalId: string;
  status: string;
  hasCheckpoint: boolean;
  recommendedAction: 'RESUME_FROM_CHECKPOINT' | 'RESTART' | 'CANCEL';
  createdAt: number;
  updatedAt: number;
}

/**
 * RuntimeRestoreCoordinator
 * 앱 재시작 시 미완료 Mission을 안전하게 복원한다.
 */
export class RuntimeRestoreCoordinator {
  private readonly persistence: IRuntimePersistenceAdapter;
  private readonly artifactTxManager?: ArtifactTransactionManager;

  constructor(
    persistence: IRuntimePersistenceAdapter,
    artifactTxManager?: ArtifactTransactionManager
  ) {
    this.persistence = persistence;
    this.artifactTxManager = artifactTxManager;
  }

  /**
   * 앱 시작 시 미완료 Mission 목록을 조회하고 복원 정보를 반환한다.
   *
   * [복원 흐름]
   * 1. 미완료 Mission 목록 조회
   * 2. Schema Digest 검사 (손상 감지)
   * 3. 각 Mission의 권장 복원 액션 결정
   * 4. UI에 표시할 복원 정보 반환
   * 5. 실제 Scheduler 시작은 사용자 승인 후 별도 처리
   *
   * @returns 복원 가능한 Mission 목록
   */
  public async detectIncompleteMissions(): Promise<RestoredMissionInfo[]> {
    let snapshots: MissionSnapshot[];
    try {
      snapshots = await this.persistence.listIncompleteMissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[RuntimeRestoreCoordinator] 미완료 Mission 조회 실패:', msg);
      return [];
    }

    const results: RestoredMissionInfo[] = [];

    for (const snapshot of snapshots) {
      // Checkpoint 존재 여부 확인
      let hasCheckpoint = false;
      try {
        // 첫 번째 Task에 대해 Checkpoint 존재 여부만 확인
        const firstTaskId = snapshot.taskIds[0];
        if (firstTaskId) {
          const cpData = await this.persistence.loadCheckpointData(snapshot.missionId, firstTaskId);
          hasCheckpoint = cpData !== null;
        }
      } catch {
        // Checkpoint 조회 실패는 무시 (복원 불가로 간주)
      }

      // [Item 6] Artifact Hash Verification
      // 만약 COMMITTED된 Artifact가 디스크상에서 변조(STALE/CORRUPTED)되었다면 경고
      let artifactCorrupted = false;
      if (this.artifactTxManager) {
        try {
          const manifests = await this.artifactTxManager['store'].listManifests(snapshot.missionId);
          for (const m of manifests) {
            if (m.status === 'COMMITTED' && m.finalPath && m.contentHash) {
              const currentHash = await this.artifactTxManager['fsAdapter'].hash(m.finalPath);
              if (currentHash !== m.contentHash) {
                console.error(`[RuntimeRestoreCoordinator] Artifact corrupted or stale detected during restore: ${m.artifactId}`);
                artifactCorrupted = true;
                // Optional: Update status to CORRUPTED here or let user decide
              }
            }
          }
        } catch (e) {
          console.error(`[RuntimeRestoreCoordinator] Artifact verification failed for mission ${snapshot.missionId}`, e);
        }
      }

      // 권장 복원 액션 결정
      let recommendedAction: RestoredMissionInfo['recommendedAction'];
      if (artifactCorrupted) {
         // Artifact가 손상되었으므로 처음부터 재시작하거나 사용자가 파일 복구를 하도록 유도
         recommendedAction = 'RESTART';
      } else if (hasCheckpoint) {
        recommendedAction = 'RESUME_FROM_CHECKPOINT';
      } else if (snapshot.status === 'PAUSED' || snapshot.status === 'WAITING_USER') {
        recommendedAction = 'RESTART';
      } else {
        // RUNNING이었던 경우 — 이전 Executor가 소멸했으므로 재시작 필요
        recommendedAction = 'RESTART';
      }

      results.push({
        missionId: snapshot.missionId,
        goalId: snapshot.goalId,
        status: snapshot.status,
        hasCheckpoint,
        recommendedAction,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt
      });
    }

    if (results.length > 0) {
      console.log(`[RuntimeRestoreCoordinator] ${results.length}개 미완료 Mission 감지.`);
    }

    return results;
  }

  /**
   * Mission 상태를 저장한다.
   * Mission 상태 변경 시 호출 (RUNNING, PAUSED, WAITING_USER 등).
   */
  public async saveMissionState(
    missionId: string,
    goalId: string,
    status: string,
    taskIds: string[]
  ): Promise<void> {
    const { createHash } = await import('crypto');

    const canonical = JSON.stringify({ missionId, goalId, status, taskIds });
    const integrityDigest = createHash('sha256').update(canonical).digest('hex');

    const snapshot: MissionSnapshot = {
      missionId,
      goalId,
      status,
      taskIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schemaVersion: 1,
      integrityDigest
    };

    try {
      await this.persistence.saveMissionSnapshot(snapshot);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // 저장 실패는 경고만 남기고 Runtime을 중단하지 않음 (Best-effort persistence)
      console.warn(`[RuntimeRestoreCoordinator] Mission 상태 저장 실패 (${missionId}): ${msg}`);
    }
  }
}
