/**
 * @file orchestrator/task-runtime/completion/builder/MissionCompletionReviewInputBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role 분산된 Runtime Store와 상태들로부터 Readonly Snapshot인 MissionCompletionReviewInput을 생성
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - MissionCompletionRuntime: Completion Review 실행 전 Snapshot 생성
 *
 * [FINAL REMEDIATION 수정 — STAGE A]
 * - toolRuntimeStatus 하드코딩('FULLY_CONNECTED') 제거
 * - CapabilityCatalog.getToolRuntimeStatus()로 실제 상태 조회
 * - totalReasoningTurns를 MissionExecutionState.budget에서 실제 값으로 추출
 * - goalId를 MissionExecutionState에서 전달받도록 수정
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { CapabilityCatalog } from '../../dispatch/CapabilityCatalog';
import type { MissionCompletionReviewInput, TaskEntity, TaskResult, TaskVerificationResult } from '../../domain/types';

export class MissionCompletionReviewInputBuilder {
  private readonly taskStore: TaskRuntimeStore;
  /*
   * [CapabilityCatalog]
   * toolRuntimeStatus를 실제 상태로 조회하기 위해 주입.
   * 기본값은 새로 생성된 인스턴스를 사용하여 기존 API 호환성 유지.
   */
  private readonly capabilityCatalog: CapabilityCatalog;

  constructor(taskStore: TaskRuntimeStore, capabilityCatalog?: CapabilityCatalog) {
    this.taskStore = taskStore;
    this.capabilityCatalog = capabilityCatalog ?? new CapabilityCatalog();
  }

  public buildSnapshot(missionId: string, planVersion: number): MissionCompletionReviewInput {
    const missionState = this.taskStore.getMissionState(missionId);
    if (!missionState) {
      throw new Error(`Cannot build completion review snapshot: Mission ${missionId} not found.`);
    }

    const allTasks = this.taskStore.getAllTasks(missionId);

    // 기본 분류
    const allTaskDefinitions = allTasks.map(t => t.definition);
    const allTaskRuntimeStates = allTasks.map(t => t.state);

    const successfulTaskResults: TaskResult[] = [];
    const taskVerificationResults: TaskVerificationResult[] = [];

    const failedRequiredTasks: TaskEntity[] = [];
    const failedOptionalTasks: TaskEntity[] = [];
    const skippedOptionalTasks: TaskEntity[] = [];
    const blockedTasks: TaskEntity[] = [];
    const waitingUserTasks: TaskEntity[] = [];

    const warnings: string[] = [];
    const unresolvedIssues: string[] = [];

    let totalAttempts = 0;
    let totalRetries = 0;

    for (const task of allTasks) {
      const { state, definition } = task;

      totalAttempts += Object.keys(state.attempts).length;
      totalRetries += state.retries;

      const isRequired = typeof definition.required === 'boolean'
        ? definition.required
        : ((definition.requirementIds && definition.requirementIds.length > 0)
          || (definition.expectedOutputs && definition.expectedOutputs.length > 0)
          || definition.priority === 1);

      // Status 별 분류
      switch (state.status) {
        case 'COMPLETED':
          if (state.taskResult) successfulTaskResults.push(state.taskResult);
          if (state.verification) taskVerificationResults.push(state.verification);
          break;
        case 'FAILED':
        case 'CANCELLED':
          if (isRequired) {
            failedRequiredTasks.push(task);
          } else {
            failedOptionalTasks.push(task);
          }
          break;
        case 'SKIPPED':
          skippedOptionalTasks.push(task);
          break;
        case 'BLOCKED':
          blockedTasks.push(task);
          break;
        case 'WAITING_USER':
          waitingUserTasks.push(task);
          break;
      }

      // 이슈 수집
      if (state.lastFailure) {
        unresolvedIssues.push(`[${definition.id}] Last Failure: ${state.lastFailure.message}`);
      }
      if (state.taskResult?.unresolvedIssues) {
        unresolvedIssues.push(...state.taskResult.unresolvedIssues.map(iss => `[${definition.id}] ${iss}`));
      }
    }

    /*
     * [실제 Budget 값 추출 — STAGE A 수정]
     * 이전 코드는 하드코딩 0을 사용했음.
     * MissionExecutionState.budget에서 실제 소비량을 추출한다.
     */
    const totalReasoningTurns = missionState.budget.consumedReasoningTurns;
    const totalToolCalls = missionState.budget.consumedToolCalls;
    const totalRepairs = 0;   // RecoveryRequestStore 미연결 시 0 유지 (P2 범위)
    const totalRecoveries = missionState.budget.consumedRecoveries;

    /*
     * [toolRuntimeStatus — STAGE A 수정]
     * 하드코딩 'FULLY_CONNECTED' 제거.
     * CapabilityCatalog.getToolRuntimeStatus()로 실제 상태를 조회.
     * 현재 값: 'PARTIALLY_CONNECTED' (llm.reasoning만 활성, Tool Call Parsing 구현 중)
     */
    const toolRuntimeStatus = this.capabilityCatalog.getToolRuntimeStatus();

    // Review Input 생성
    return {
      missionId,
      planVersion,
      missionExecutionState: missionState,
      allTaskDefinitions,
      allTaskRuntimeStates,
      successfulTaskResults,
      taskVerificationResults,
      failedRequiredTasks,
      failedOptionalTasks,
      skippedOptionalTasks,
      blockedTasks,
      waitingUserTasks,
      totalReasoningTurns,
      totalToolCalls,
      totalAttempts,
      totalRepairs,
      totalRetries,
      totalRecoveries,
      warnings,
      unresolvedIssues,
      toolRuntimeStatus,
      completionCandidateStatus: 'READY_FOR_COMPLETION_REVIEW',
      createdAt: Date.now()
    };
  }
}
