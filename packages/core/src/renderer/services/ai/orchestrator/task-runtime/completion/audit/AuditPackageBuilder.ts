/**
 * @file orchestrator/task-runtime/completion/audit/AuditPackageBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role PHASE 6 심층 감사를 위한 Mission의 전체 상태, 결과, 이벤트 Snapshot 패키지 생성
 */

import type { MissionCompletionDecision, MissionCompletionSnapshot } from '../domain/MissionCompletionTypes';
import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';

export class AuditPackageBuilder {
  constructor(private readonly taskStore: TaskRuntimeStore) {}

  /**
   * 미션 종료 시점의 전체 정보를 캡처하여 감사 패키지로 묶어냅니다.
   */
  public buildAuditPackage(decision: MissionCompletionDecision): MissionCompletionSnapshot {
    const allTasks = this.taskStore.getAllTasks(decision.missionId);
    const taskStateSummary: Record<string, any> = {};

    allTasks.forEach(task => {
      taskStateSummary[task.definition.id] = {
        status: task.state.status,
        attemptsCount: Object.keys(task.state.attempts).length,
        retries: task.state.retries,
        hasResult: !!task.state.taskResult,
        hasVerification: !!task.state.verification
      };
    });

    const snapshot: MissionCompletionSnapshot = {
      missionId: decision.missionId,
      goalId: decision.goalId,
      planId: decision.planId,
      planVersion: decision.planVersion,
      outcome: decision.outcome,
      completionDecisionId: decision.decisionId,
      taskStateSummary,
      resultReferences: [], // 실제 구현 시 DB 레퍼런스 ID 리스트 기록
      verificationReferences: [],
      artifactReferences: decision.finalArtifactReferences.map(a => a.referencePath),
      budgetSummary: decision.budgetSummary,
      recoverySummary: decision.recoverySummary,
      unresolvedIssues: decision.unresolvedIssues,
      createdAt: Date.now(),
      finalizedAt: Date.now(),
      schemaVersion: 1,
      integrityDigest: 'computed_hash_placeholder' // TODO: 데이터 위변조 방지를 위한 해시 생성
    };

    return snapshot;
  }
}
