/**
 * @file orchestrator/task-runtime/completion/audit/AuditPackageBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role PHASE 6 심층 감사를 위한 Mission의 전체 상태, 결과, 이벤트 Snapshot 패키지 생성
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionCompletionRuntime: 미션 완료 후 감사 패키지 생성
 * - RuntimeDisposalCoordinator: 종료 시 패키지 최종화
 *
 * [FINAL REMEDIATION 수정 — STAGE A]
 * - integrityDigest 'computed_hash_placeholder' 제거
 * - Node.js crypto를 통한 실제 SHA-256 계산으로 교체
 * - 민감 데이터(원문 Result 등)를 Digest/Reference만 포함하도록 Canonical JSON 생성
 * - computeDigest() 정적 메서드 추가 (검증 API)
 */

import type { MissionCompletionDecision, MissionCompletionSnapshot } from '../domain/MissionCompletionTypes';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { sha256Sync } from '../../utils/sha256';

export class AuditPackageBuilder {
  private readonly taskStore: TaskRuntimeStore;

  constructor(taskStore: TaskRuntimeStore) {
    this.taskStore = taskStore;
  }

  /**
   * 미션 종료 시점의 전체 정보를 캡처하여 감사 패키지로 묶어냅니다.
   * integrityDigest는 실제 SHA-256으로 계산됩니다.
   */
  public buildAuditPackage(decision: MissionCompletionDecision): MissionCompletionSnapshot {
    const allTasks = this.taskStore.getAllTasks(decision.missionId);
    const taskStateSummary: Record<string, unknown> = {};

    allTasks.forEach(task => {
      taskStateSummary[task.definition.id] = {
        status: task.state.status,
        attemptsCount: Object.keys(task.state.attempts).length,
        retries: task.state.retries,
        hasResult: !!task.state.taskResult,
        hasVerification: !!task.state.verification,
        latestAttemptId: task.state.taskResult?.attemptId || null,
        unresolvedIssuesCount: task.state.taskResult?.unresolvedIssues?.length || 0,
        consumedReasoningTurns: task.state.taskResult?.metrics?.reasoningTurns || 0
      };
    });

    const now = Date.now();

    /*
     * [Canonical JSON 생성 — STAGE A]
     * 민감한 원문(Prompt, Tool Input, 전체 Result 텍스트)은 제외하고
     * 식별자·상태·통계·Digest만 포함한 정렬된 Canonical JSON을 구성.
     * 이 JSON에 대해 SHA-256을 계산하여 integrityDigest를 생성.
     */
    const canonicalPayload = {
      missionId: decision.missionId,
      goalId: decision.goalId,
      planVersion: decision.planVersion,
      outcome: decision.outcome,
      decisionId: decision.decisionId,
      taskStateSummary,
      requiredTaskCompletionRate: decision.requiredTaskCompletionRate,
      unresolvedIssuesCount: decision.unresolvedIssues.length,
      createdAt: now
    };

    const integrityDigest = AuditPackageBuilder.computeDigest(canonicalPayload);

    const snapshot: MissionCompletionSnapshot = {
      packageId: `audit-pkg-${crypto.randomUUID()}`,
      missionId: decision.missionId,
      goalId: decision.goalId,
      planId: decision.planId,
      planVersion: decision.planVersion,
      outcome: decision.outcome,
      completionDecisionId: decision.decisionId,
      taskStateSummary,
      resultReferences: allTasks.filter(t => t.state.taskResult).map(t => t.state.taskResult!.attemptId),
      verificationReferences: allTasks.filter(t => t.state.verification).map(t => t.state.verification!.verificationId),
      artifactReferences: decision.finalArtifactReferences.map(a => a.referencePath),
      budgetSummary: decision.budgetSummary,
      recoverySummary: decision.recoverySummary,
      unresolvedIssues: decision.unresolvedIssues,
      toolRuntimeStatus: 'UNKNOWN',
      semanticRuntimeStatus: 'UNKNOWN',
      createdAt: now,
      finalizedAt: now,
      schemaVersion: 2,
      integrityDigest  // [STAGE A] 실제 SHA-256 해시값
    };

    return snapshot;
  }

  /**
   * [신규 - STAGE A] Canonical 데이터에 대해 SHA-256을 계산합니다.
   * Audit Package의 변조 여부를 검증할 때 이 메서드를 재호출합니다.
   *
   * @param payload - 정렬·직렬화할 Canonical 데이터
   * @returns hex 인코딩된 SHA-256 해시 문자열
   */
  public static computeDigest(payload: unknown): string {
    try {
      /*
       * JSON.stringify의 키 순서 불안정 문제를 해결하기 위해
       * 재귀적 키 정렬 직렬화 함수를 사용합니다.
       */
      const stableJson = AuditPackageBuilder.stableStringify(payload);
      return sha256Sync(stableJson);
    } catch (error) {
      // Node crypto 환경에서 예외 발생 시 런타임 오류를 전파
      throw new Error(`[AuditPackageBuilder] Failed to compute integrity digest: ${error}`);
    }
  }

  /**
   * [신규 - STAGE A] 키를 정렬하여 안정적인 JSON 문자열을 생성합니다.
   * 동일 데이터에 대해 항상 동일한 해시를 보장합니다.
   */
  private static stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(AuditPackageBuilder.stableStringify).join(',') + ']';
    }
    // 객체 키를 알파벳 순서로 정렬
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = sortedKeys.map(k =>
      `${JSON.stringify(k)}:${AuditPackageBuilder.stableStringify((value as Record<string, unknown>)[k])}`
    );
    return '{' + pairs.join(',') + '}';
  }
}
