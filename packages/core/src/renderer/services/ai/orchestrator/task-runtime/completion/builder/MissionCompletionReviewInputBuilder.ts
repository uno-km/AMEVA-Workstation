/**
 * @file orchestrator/task-runtime/completion/builder/MissionCompletionReviewInputBuilder.ts
 * @system AMEVA OS Desktop Workstation
 * @role 분산된 Runtime Store와 상태들로부터 Readonly Snapshot인 MissionCompletionReviewInput을 생성
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import type { MissionCompletionReviewInput, TaskEntity, TaskResult, TaskVerificationResult } from '../../domain/types';

export class MissionCompletionReviewInputBuilder {
  constructor(
    private readonly taskStore: TaskRuntimeStore
  ) {}

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

      // Status 별 분류
      switch (state.status) {
        case 'COMPLETED':
          if (state.taskResult) successfulTaskResults.push(state.taskResult);
          if (state.verification) taskVerificationResults.push(state.verification);
          break;
        case 'FAILED':
        case 'CANCELLED':
          // Cancelled도 달성 실패로 간주하여 required/optional 분류
          if (definition.priority <= 5) {
            // 기준(priority <= 5)으로 Required로 취급한다. 실제 도메인 로직에 맞게 조정 가능.
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
        unresolvedIssues.push(`[${definition.id}] Last Failure: ${state.lastFailure.reason}`);
      }
      if (state.taskResult?.unresolvedIssues) {
        unresolvedIssues.push(...state.taskResult.unresolvedIssues.map(iss => `[${definition.id}] ${iss}`));
      }
    }

    // 예시용 하드코딩 값(실제로는 MissionBudgetLedger 등에서 가져와야 함)
    const totalReasoningTurns = 0; 
    const totalToolCalls = 0;
    const totalRepairs = 0;
    const totalRecoveries = 0;
    
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
      toolRuntimeStatus: 'FULLY_CONNECTED', // TODO: 실제 Tool Runtime Connection Status 맵핑
      completionCandidateStatus: 'READY_FOR_COMPLETION_REVIEW',
      createdAt: Date.now()
    };
  }
}
