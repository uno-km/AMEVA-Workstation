/**
 * @file orchestrator/task-runtime/checkpoint/CheckpointRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role Checkpoint 저장 정책 집행, Resume 조건 검증, 반복 Crash 방지
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - DeepTaskExecutor: Reasoning Turn 경계 및 Tool 성공 직후 저장 트리거
 * - MissionExecutionRuntime: Resume 실행 전 Checkpoint 조회
 *
 * [STAGE F — Checkpoint Runtime 및 Resume 완전 통합]
 *
 * [CheckpointRuntime 책임]
 * 1. Turn 경계에서 Checkpoint 저장 (매 N턴마다)
 * 2. Tool 성공 직후 Checkpoint 저장
 * 3. Pause/Recovery 직전 Checkpoint 저장
 * 4. 반복 Crash 감지 (동일 Fingerprint 3회 초과 → User Assist 권고)
 * 5. Resume 전 무결성 검증
 * 6. Resume 실행: 완료된 Tool 제외, 남은 컨텍스트 복원
 *
 * [반복 Crash 방지]
 * 동일 Fingerprint(taskId:turn:outputSize)에서 MAX_CRASH_BEFORE_USER_ASSIST회 이상
 * Resume이 실패하면 자동 Resume을 중단하고 UserAssistRuntime 호출을 권고한다.
 */

import { CheckpointStore, type SaveCheckpointRequest, type TaskCheckpoint } from './CheckpointStore';

/**
 * Checkpoint 저장 정책 상수.
 */
const CHECKPOINT_EVERY_N_TURNS = 5;  // N턴마다 Turn 경계 저장
const MAX_CRASH_BEFORE_USER_ASSIST = 3; // 이 횟수 초과 시 User Assist 권고

/**
 * Resume 요청.
 */
export interface CheckpointResumeRequest {
  missionId: string;
  taskId: string;
  attemptId: string;
  checkpointId: string;
  planVersion: number;
}

/**
 * Resume 결과.
 */
export interface CheckpointResumeResult {
  success: boolean;
  /** 복원된 부분 Output 텍스트 */
  restoredOutputText: string;
  /** 이미 완료된 Tool Call ID 목록 (재실행 차단용) */
  completedToolCallIds: Set<string>;
  /** 재개 시작 Turn 번호 */
  resumeFromTurn: number;
  /** User Assist 권고 여부 (반복 Crash) */
  requiresUserAssist: boolean;
  reason?: string;
}

/**
 * CheckpointRuntime
 */
export class CheckpointRuntime {
  private readonly store: CheckpointStore;

  constructor() {
    this.store = new CheckpointStore();
  }

  /**
   * Turn 경계 Checkpoint 저장.
   * CHECKPOINT_EVERY_N_TURNS의 배수 턴마다 저장한다.
   * Tool 성공 직후 호출 시에는 forceNow=true로 강제 저장.
   */
  public maybeSaveOnTurnBoundary(
    missionId: string,
    taskId: string,
    attemptId: string,
    reasoningTurn: number,
    partialOutputText: string,
    completedToolCallIds: string[],
    planVersion: number,
    forceNow: boolean = false
  ): TaskCheckpoint | null {
    const shouldSave = forceNow || (reasoningTurn > 0 && reasoningTurn % CHECKPOINT_EVERY_N_TURNS === 0);
    if (!shouldSave) return null;

    const request: SaveCheckpointRequest = {
      missionId,
      taskId,
      attemptId,
      reasoningTurn,
      completedToolCallIds: [...completedToolCallIds],
      partialOutputText,
      planVersion,
      reason: forceNow ? 'TOOL_SUCCESS' : 'TURN_BOUNDARY'
    };

    const checkpoint = this.store.save(request);
    console.log(
      `[CheckpointRuntime] Checkpoint saved (${checkpoint.reason}): ` +
      `Task=${taskId}, Turn=${reasoningTurn}, ID=${checkpoint.checkpointId}`
    );
    return checkpoint;
  }

  /**
   * Pre-Recovery Checkpoint 저장 (Recovery 전 안전 지점).
   */
  public savePreRecovery(
    missionId: string,
    taskId: string,
    attemptId: string,
    reasoningTurn: number,
    partialOutputText: string,
    completedToolCallIds: string[],
    planVersion: number
  ): TaskCheckpoint {
    const request: SaveCheckpointRequest = {
      missionId,
      taskId,
      attemptId,
      reasoningTurn,
      completedToolCallIds: [...completedToolCallIds],
      partialOutputText,
      planVersion,
      reason: 'PRE_RECOVERY'
    };
    return this.store.save(request);
  }

  /**
   * Resume 전 Checkpoint 무결성 검증 및 재개 결과 반환.
   *
   * [검증 단계]
   * 1. 최신 Checkpoint 조회
   * 2. 무결성 Digest 검사
   * 3. planVersion 일치 확인
   * 4. 반복 Crash Fingerprint 초과 확인
   * 5. 통과 시 복원 데이터 반환
   */
  public prepareResume(request: CheckpointResumeRequest): CheckpointResumeResult {
    // 지정 checkpointId가 없으면 최신 Checkpoint 사용
    const allCheckpoints = this.store.getAll(request.taskId);
    const checkpoint = request.checkpointId
      ? allCheckpoints.find(cp => cp.checkpointId === request.checkpointId) ?? null
      : allCheckpoints[0] ?? null;  // getAll은 최신 순

    if (!checkpoint) {
      return {
        success: false,
        restoredOutputText: '',
        completedToolCallIds: new Set(),
        resumeFromTurn: 0,
        requiresUserAssist: false,
        reason: `No checkpoint found for task ${request.taskId}`
      };
    }

    // 무결성 검증
    if (!this.store.verify(checkpoint)) {
      return {
        success: false,
        restoredOutputText: '',
        completedToolCallIds: new Set(),
        resumeFromTurn: 0,
        requiresUserAssist: true,
        reason: `Checkpoint integrity check failed for ${checkpoint.checkpointId}. Digest mismatch.`
      };
    }

    // planVersion 일치 확인
    if (checkpoint.planVersion !== request.planVersion) {
      return {
        success: false,
        restoredOutputText: '',
        completedToolCallIds: new Set(),
        resumeFromTurn: 0,
        requiresUserAssist: false,
        reason: `Plan version mismatch: checkpoint=${checkpoint.planVersion}, current=${request.planVersion}`
      };
    }

    // 반복 Crash 카운터 확인
    const crashCount = this.store.getCrashCount(checkpoint.crashFingerprint);
    if (crashCount >= MAX_CRASH_BEFORE_USER_ASSIST) {
      return {
        success: false,
        restoredOutputText: checkpoint.partialOutputText,
        completedToolCallIds: new Set(checkpoint.completedToolCallIds),
        resumeFromTurn: checkpoint.reasoningTurn,
        requiresUserAssist: true,
        reason: `Repeated crash at same checkpoint (${crashCount}/${MAX_CRASH_BEFORE_USER_ASSIST}). User assist required.`
      };
    }

    return {
      success: true,
      restoredOutputText: checkpoint.partialOutputText,
      completedToolCallIds: new Set(checkpoint.completedToolCallIds),
      resumeFromTurn: checkpoint.reasoningTurn,
      requiresUserAssist: false
    };
  }

  /**
   * 실패한 Resume의 Crash 카운터를 증가시킨다.
   * Resume 실패 직후 호출.
   */
  public recordCrash(taskId: string): void {
    const latest = this.store.getLatest(taskId);
    if (latest) {
      const count = this.store.incrementCrashCount(latest.crashFingerprint);
      console.warn(
        `[CheckpointRuntime] Crash recorded for Task=${taskId}, ` +
        `Fingerprint=${latest.crashFingerprint}, Count=${count}/${MAX_CRASH_BEFORE_USER_ASSIST}`
      );
    }
  }

  /**
   * 최신 Checkpoint를 반환한다 (UI 표시 및 User Assist 카드용).
   */
  public getLatestCheckpoint(taskId: string): TaskCheckpoint | null {
    return this.store.getLatest(taskId);
  }

  /**
   * Task 종료 시 Checkpoint 데이터 정리.
   */
  public clearTask(taskId: string): void {
    this.store.clearTask(taskId);
  }

  /**
   * 테스트용 전체 초기화.
   */
  public reset(): void {
    this.store.reset();
  }
}
