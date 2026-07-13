/**
 * @file orchestrator/task-runtime/completion/runtime/MissionCompletionRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role Completion Review 프로세스의 파이프라인을 조율하는 핵심 런타임 (Lock, Precondition 검사 포함)
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { MissionCompletionReviewInputBuilder } from '../builder/MissionCompletionReviewInputBuilder';
import { RequiredTaskEvaluator } from '../evaluators/RequiredTaskEvaluator';
import { OptionalTaskPolicyEvaluator } from '../evaluators/OptionalTaskPolicyEvaluator';
import { GoalRequirementCoverageEvaluator } from '../evaluators/GoalRequirementCoverageEvaluator';
import { DeliverableCoverageEvaluator } from '../evaluators/DeliverableCoverageEvaluator';
import { FinalArtifactValidator } from '../evaluators/FinalArtifactValidator';
import { GoalLevelVerifier } from '../verifier/GoalLevelVerifier';
import { MissionOutcomeEvaluator } from '../evaluators/MissionOutcomeEvaluator';
import type { MissionCompletionDecision } from '../domain/MissionCompletionTypes';

export class MissionCompletionRuntime {
  private activeLocks: Set<string> = new Set(); // in-memory 락 (reviewId 또는 missionId 기준)
  private decisionCache: Map<string, MissionCompletionDecision> = new Map(); // 멱등성 보장을 위한 캐시

  private readonly taskStore: TaskRuntimeStore;
  private readonly builder: MissionCompletionReviewInputBuilder;
  private readonly requiredTaskEvaluator: RequiredTaskEvaluator;
  private readonly optionalTaskEvaluator: OptionalTaskPolicyEvaluator;
  private readonly goalReqEvaluator: GoalRequirementCoverageEvaluator;
  private readonly deliverableEvaluator: DeliverableCoverageEvaluator;
  private readonly artifactValidator: FinalArtifactValidator;
  private readonly goalVerifier: GoalLevelVerifier;
  private readonly outcomeEvaluator: MissionOutcomeEvaluator;

  constructor(
    taskStore: TaskRuntimeStore,
    builder: MissionCompletionReviewInputBuilder,
    requiredTaskEvaluator: RequiredTaskEvaluator,
    optionalTaskEvaluator: OptionalTaskPolicyEvaluator,
    goalReqEvaluator: GoalRequirementCoverageEvaluator,
    deliverableEvaluator: DeliverableCoverageEvaluator,
    artifactValidator: FinalArtifactValidator,
    goalVerifier: GoalLevelVerifier,
    outcomeEvaluator: MissionOutcomeEvaluator
  ) {
    this.taskStore = taskStore;
    this.builder = builder;
    this.requiredTaskEvaluator = requiredTaskEvaluator;
    this.optionalTaskEvaluator = optionalTaskEvaluator;
    this.goalReqEvaluator = goalReqEvaluator;
    this.deliverableEvaluator = deliverableEvaluator;
    this.artifactValidator = artifactValidator;
    this.goalVerifier = goalVerifier;
    this.outcomeEvaluator = outcomeEvaluator;
  }

  /**
   * 미션 종료 심사 프로세스를 실행하고 최종 Decision을 생성합니다.
   * 중복 실행을 막기 위한 Lock을 포함합니다.
   *
   * [STAGE A 수정]
   * goalId 파라미터 추가: 하드코딩 'legacy-goal' 제거.
   * goalId 미전달 시 'unknown-goal'로 폴백하며 경고 로그를 남깁니다.
   */
  public async executeCompletionReview(
    missionId: string,
    planVersion: number,
    goalId?: string,
    idempotencyKey?: string
  ): Promise<MissionCompletionDecision> {
    /*
     * [goalId 폴백 정책]
     * - goalId가 전달되지 않으면 'unknown-goal'을 사용하고 경고를 기록합니다.
     * - Legacy Mission은 LegacyGoalAdapter에서 goalId를 생성해서 전달해야 합니다.
     */
    const resolvedGoalId = goalId ?? 'unknown-goal';
    if (!goalId) {
      console.warn(`[MissionCompletionRuntime] goalId not provided for mission ${missionId}. Using 'unknown-goal'.`);
    }
    const lockKey = `${missionId}-${planVersion}`;
    const cacheKey = idempotencyKey || lockKey;
    
    // 멱등성 보장: 이미 결정된 결과가 있다면 그대로 반환
    if (this.decisionCache.has(cacheKey)) {
      return this.decisionCache.get(cacheKey)!;
    }

    if (this.activeLocks.has(lockKey)) {
      throw new Error(`[MissionCompletionRuntime] Completion review is already in progress for ${lockKey}.`);
    }
    
    this.activeLocks.add(lockKey);

    try {
      // 1. Snapshot 생성
      const input = this.builder.buildSnapshot(missionId, planVersion);

      // Snapshot Stale Detection (Aggregate Version 일관성 검사)
      const currentState = this.taskStore.getMissionState(missionId);
      if (!currentState || currentState.stateVersion !== input.missionExecutionState.stateVersion) {
        throw new Error(`[MissionCompletionRuntime] Stale Snapshot detected. Store version changed during review.`);
      }

      // 2. Precondition 검사 (VERIFYING, RUNNING 등의 태스크가 남았는지)
      const isBlockedByPrecondition = input.allTaskRuntimeStates.some(
        state => ['RUNNING', 'VERIFYING', 'RECOVERING', 'READY', 'RETRY_WAIT'].includes(state.status)
      );

      // 3. Evaluator 파이프라인 실행
      const reqEval = this.requiredTaskEvaluator.evaluate(input);
      const optEval = this.optionalTaskEvaluator.evaluate(input);
      const goalReqEval = this.goalReqEvaluator.evaluate(input);
      const delivEval = await this.deliverableEvaluator.evaluateAsync(input);
      const artifactEval = this.artifactValidator.evaluate(input, delivEval.deliverableResults);
      const goalVerify = this.goalVerifier.verify(input);

      // 4. 취합 후 Outcome 도출
      const { outcome, confidence } = this.outcomeEvaluator.evaluate({
        requiredSuccess: reqEval.success,
        requiredCompletionRate: reqEval.completionRate,
        hasFailedOptionals: optEval.hasFailedOptionals,
        hasSkippedOptionals: optEval.hasSkippedOptionals,
        requirementSuccess: goalReqEval.requiredRequirementSuccess,
        deliverableSuccess: delivEval.success,
        artifactSuccess: artifactEval.success,
        goalLevelSuccess: goalVerify.success,
        goalLevelWaitingUser: goalVerify.waitingUser,
        totalTasks: input.allTaskDefinitions.length,
        completedTasks: input.successfulTaskResults.length,
        unresolvedIssuesCount: input.unresolvedIssues.length,
        warningsCount: optEval.warnings.length + goalReqEval.warnings.length + delivEval.warnings.length + artifactEval.warnings.length + goalVerify.warnings.length,
        isCancelled: input.completionCandidateStatus === 'CANCELLED',
        isTimedOut: input.completionCandidateStatus === 'TIMED_OUT',
        isBlockedByPrecondition
      });

      const warnings = [
        ...optEval.warnings,
        ...goalReqEval.warnings,
        ...delivEval.warnings,
        ...artifactEval.warnings,
        ...goalVerify.warnings
      ];
      
      if (isBlockedByPrecondition) {
        warnings.push('[Precondition] There are still running or verifying tasks. Completion review blocked.');
      }

      const decision: MissionCompletionDecision = {
        decisionId: `dec-${crypto.randomUUID()}`,
        reviewId: `rev-${crypto.randomUUID()}`,
        missionId,
        goalId: resolvedGoalId,
        planVersion,
        snapshotVersion: input.missionExecutionState.stateVersion || 1,
        outcome,
        completionConfidence: confidence,
        goalCoverage: {
          goalId: resolvedGoalId,
          requirementResults: goalReqEval.requirementResults,
          deliverableResults: delivEval.deliverableResults,
          taskCompletionRate: confidence.componentScores.taskCompletionRate,
          requiredTaskCompletionRate: reqEval.completionRate,
        },
        taskCompletionRate: confidence.componentScores.taskCompletionRate,
        requiredTaskCompletionRate: reqEval.completionRate,
        requirementResults: goalReqEval.requirementResults,
        deliverableResults: delivEval.deliverableResults,
        finalArtifactReferences: artifactEval.finalArtifactReferences,
        warnings,
        unresolvedIssues: input.unresolvedIssues,
        failedRequiredTaskIds: reqEval.failedTaskIds,
        failedOptionalTaskIds: input.failedOptionalTasks.map(t => t.definition.id),
        skippedTaskIds: input.skippedOptionalTasks.map(t => t.definition.id),
        waitingUserTaskIds: reqEval.waitingUserTaskIds,
        recoverySummary: {
          totalAttempts: input.totalAttempts,
          totalRepairs: input.totalRepairs,
          totalRetries: input.totalRetries,
          totalRecoveries: input.totalRecoveries,
          successRate: input.totalAttempts > 0 ? (input.successfulTaskResults.length / input.totalAttempts) * 100 : 0
        },
        budgetSummary: {}, // 확장 대비
        reasonCodes: [],
        createdAt: Date.now(),
        decisionVersion: 1,
        idempotencyKey: lockKey
      };

      // 5. 스토어 상태 변경(FINALIZING -> 결정된 Outcome)
      this.taskStore.updateMissionState(missionId, { status: outcome });

      // 6. 캐싱 (멱등성 보장용)
      this.decisionCache.set(cacheKey, decision);

      return decision;
      
    } finally {
      this.activeLocks.delete(lockKey);
    }
  }
}
