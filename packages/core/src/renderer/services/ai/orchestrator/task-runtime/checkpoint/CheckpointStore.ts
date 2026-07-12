/**
 * @file orchestrator/task-runtime/checkpoint/CheckpointStore.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task 실행 Checkpoint를 저장·조회·무결성 검증하는 인메모리 저장소
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - CheckpointRuntime: 저장/조회/검증 위임
 * - DeepTaskExecutor: Turn 경계 및 Tool 성공 직후 저장 요청
 *
 * [STAGE F — Checkpoint Runtime 및 Resume]
 *
 * [설계 원칙]
 * - 인메모리 기반 (STAGE H에서 RuntimePersistenceAdapter로 교체 예정)
 * - SHA-256 무결성 Digest
 * - Schema Version 관리
 * - Checkpoint는 전체 Context 아님 — 요약/Action/Output 중심
 *
 * [보안]
 * - 원본 민감 Thought 전문 저장 금지
 * - Stack Trace 저장 금지
 * - 순환 참조 객체 저장 금지
 */

import { createHash } from 'crypto';

/**
 * Checkpoint 데이터 모델.
 * LLM 추론을 재시작할 수 있는 인지적 재개 지점.
 */
export interface TaskCheckpoint {
  /** Checkpoint 고유 ID */
  checkpointId: string;
  /** Mission ID */
  missionId: string;
  /** Task ID */
  taskId: string;
  /** Attempt ID */
  attemptId: string;
  /** 현재 Reasoning Turn 번호 */
  reasoningTurn: number;
  /** 완료된 Tool Call ID 목록 (재개 시 반복 방지) */
  completedToolCallIds: string[];
  /** 현재까지 생성된 부분 Output 텍스트 (요약/핵심 내용 중심) */
  partialOutputText: string;
  /** Plan Version */
  planVersion: number;
  /** Checkpoint 생성 이유 */
  reason: 'TURN_BOUNDARY' | 'TOOL_SUCCESS' | 'PRE_RECOVERY' | 'PAUSE' | 'APP_SHUTDOWN';
  /** 생성 시각 */
  createdAt: number;
  /** Schema Version (Migration 대비) */
  schemaVersion: number;
  /** SHA-256 무결성 Digest */
  integrityDigest: string;
  /** 동일 지점에서 반복 Crash 감지를 위한 Fingerprint (taskId+turn+outputSize) */
  crashFingerprint: string;
}

/**
 * Checkpoint 저장 요청.
 */
export interface SaveCheckpointRequest {
  missionId: string;
  taskId: string;
  attemptId: string;
  reasoningTurn: number;
  completedToolCallIds: string[];
  partialOutputText: string;
  planVersion: number;
  reason: TaskCheckpoint['reason'];
}

/*
 * [도메인 종속 지역 상수]
 */
const CHECKPOINT_SCHEMA_VERSION = 1;
const MAX_CHECKPOINTS_PER_TASK = 50;  // Task당 최대 Checkpoint 수
const MAX_PARTIAL_OUTPUT_CHARS = 5_000; // 부분 Output 최대 크기

/**
 * [무결성 Digest 계산]
 * Checkpoint 핵심 필드를 Canonical JSON으로 직렬화 후 SHA-256.
 */
function computeIntegrityDigest(cp: Omit<TaskCheckpoint, 'integrityDigest'>): string {
  const canonicalFields = {
    checkpointId: cp.checkpointId,
    missionId: cp.missionId,
    taskId: cp.taskId,
    attemptId: cp.attemptId,
    reasoningTurn: cp.reasoningTurn,
    completedToolCallIds: [...cp.completedToolCallIds].sort(),
    /*
     * [보안] partialOutputText를 digest에 포함하여 변조 탐지.
     * 이전 버전에서 누락되어 텍스트 변조를 탐지할 수 없었음.
     */
    partialOutputText: cp.partialOutputText,
    planVersion: cp.planVersion,
    reason: cp.reason,
    createdAt: cp.createdAt,
    schemaVersion: cp.schemaVersion
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalFields))
    .digest('hex');
}

/**
 * [Crash Fingerprint 계산]
 * 동일 지점에서 반복 Crash 감지용.
 */
function computeCrashFingerprint(taskId: string, reasoningTurn: number, outputSize: number): string {
  return `${taskId}:turn${reasoningTurn}:out${outputSize}`;
}

/**
 * CheckpointStore
 * Task Checkpoint를 인메모리에 저장하고 관리한다.
 */
export class CheckpointStore {
  /*
   * [내부 상태]
   * taskId → Checkpoint 배열 (최신 순 유지)
   */
  private readonly store: Map<string, TaskCheckpoint[]> = new Map();

  /*
   * [Crash 카운터]
   * fingerprint → crash count 추적
   */
  private readonly crashCounters: Map<string, number> = new Map();

  /**
   * Checkpoint를 저장한다.
   * MAX_CHECKPOINTS_PER_TASK 초과 시 오래된 것 삭제.
   */
  public save(request: SaveCheckpointRequest): TaskCheckpoint {
    const checkpointId = `cp-${crypto.randomUUID()}`;
    const now = Date.now();

    // 부분 Output 크기 제한
    const truncatedOutput = request.partialOutputText.length > MAX_PARTIAL_OUTPUT_CHARS
      ? request.partialOutputText.slice(-MAX_PARTIAL_OUTPUT_CHARS) // 최근 내용 우선 보존
      : request.partialOutputText;

    const crashFingerprint = computeCrashFingerprint(
      request.taskId,
      request.reasoningTurn,
      truncatedOutput.length
    );

    const cpWithoutDigest: Omit<TaskCheckpoint, 'integrityDigest'> = {
      checkpointId,
      missionId: request.missionId,
      taskId: request.taskId,
      attemptId: request.attemptId,
      reasoningTurn: request.reasoningTurn,
      completedToolCallIds: [...request.completedToolCallIds],
      partialOutputText: truncatedOutput,
      planVersion: request.planVersion,
      reason: request.reason,
      createdAt: now,
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      crashFingerprint
    };

    const checkpoint: TaskCheckpoint = {
      ...cpWithoutDigest,
      integrityDigest: computeIntegrityDigest(cpWithoutDigest)
    };

    const key = request.taskId;
    const existing = this.store.get(key) ?? [];
    existing.push(checkpoint);

    // 최대 수 초과 시 가장 오래된 것 삭제
    if (existing.length > MAX_CHECKPOINTS_PER_TASK) {
      existing.shift();
    }

    this.store.set(key, existing);
    return checkpoint;
  }

  /**
   * Task의 가장 최신 Checkpoint를 반환한다.
   */
  public getLatest(taskId: string): TaskCheckpoint | null {
    const checkpoints = this.store.get(taskId) ?? [];
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  }

  /**
   * Task의 모든 Checkpoint를 최신 순으로 반환한다.
   */
  public getAll(taskId: string): TaskCheckpoint[] {
    return [...(this.store.get(taskId) ?? [])].reverse();
  }

  /**
   * Checkpoint 무결성을 검증한다.
   *
   * @returns 검증 통과 여부
   */
  public verify(checkpoint: TaskCheckpoint): boolean {
    const { integrityDigest, ...rest } = checkpoint;
    const expectedDigest = computeIntegrityDigest(rest);
    return expectedDigest === integrityDigest;
  }

  /**
   * Crash 카운터를 증가시키고 현재 값을 반환한다.
   * 동일 Fingerprint에서 반복 실패 감지용.
   */
  public incrementCrashCount(crashFingerprint: string): number {
    const current = this.crashCounters.get(crashFingerprint) ?? 0;
    const next = current + 1;
    this.crashCounters.set(crashFingerprint, next);
    return next;
  }

  /**
   * Task의 Crash 카운터를 조회한다.
   */
  public getCrashCount(crashFingerprint: string): number {
    return this.crashCounters.get(crashFingerprint) ?? 0;
  }

  /**
   * Task 관련 모든 데이터를 삭제한다 (Mission 종료 시).
   */
  public clearTask(taskId: string): void {
    this.store.delete(taskId);
  }

  /**
   * 전체 초기화 (테스트용).
   */
  public reset(): void {
    this.store.clear();
    this.crashCounters.clear();
  }
}
