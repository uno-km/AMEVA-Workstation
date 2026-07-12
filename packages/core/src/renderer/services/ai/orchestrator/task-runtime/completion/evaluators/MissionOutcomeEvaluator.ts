/**
 * @file orchestrator/task-runtime/completion/evaluators/MissionOutcomeEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 모든 개별 평가 결과를 취합해 최종 MissionOutcome 및 CompletionConfidence 결정
 */

import type { MissionOutcome, CompletionConfidence } from '../domain/MissionCompletionTypes';

export interface EvaluatorResults {
  requiredSuccess: boolean;
  requiredCompletionRate: number;
  hasFailedOptionals: boolean;
  hasSkippedOptionals: boolean;
  requirementSuccess: boolean;
  deliverableSuccess: boolean;
  artifactSuccess: boolean;
  goalLevelSuccess: boolean;
  goalLevelWaitingUser: boolean;
  totalTasks: number;
  completedTasks: number;
  unresolvedIssuesCount: number;
  warningsCount: number;
  isCancelled: boolean;
  isBlockedByPrecondition: boolean;
}

export class MissionOutcomeEvaluator {
  /**
   * 최종 Mission Outcome과 Confidence를 산출합니다.
   */
  public evaluate(results: EvaluatorResults): {
    outcome: MissionOutcome;
    confidence: CompletionConfidence;
  } {
    let outcome: MissionOutcome = 'FAILED';

    if (results.isCancelled) {
      outcome = 'CANCELLED';
    } else if (results.isBlockedByPrecondition) {
      outcome = 'BLOCKED';
    } else if (results.goalLevelWaitingUser) {
      outcome = 'WAITING_USER';
    } else {
      // SUCCESS 기본 전제조건
      const meetsSuccessCriteria = 
        results.requiredSuccess &&
        results.requirementSuccess &&
        results.deliverableSuccess &&
        results.artifactSuccess &&
        results.goalLevelSuccess;

      if (meetsSuccessCriteria) {
        if (results.hasFailedOptionals || results.warningsCount > 0 || results.unresolvedIssuesCount > 0) {
          outcome = 'SUCCESS_WITH_WARNINGS';
        } else {
          outcome = 'SUCCESS';
        }
      } else {
        // 필수 조건을 완벽히 달성하진 못했지만, 
        // 완료된 필수 Task가 있거나 일부 Requirement를 달성한 경우 부분 성공 처리
        if (results.completedTasks > 0) {
          outcome = 'PARTIAL_SUCCESS';
        } else {
          outcome = 'FAILED';
        }
      }
    }

    // Completion Confidence 계산 (휴리스틱 배점 부여)
    const taskCompletionRate = results.totalTasks > 0 ? (results.completedTasks / results.totalTasks) * 100 : 0;
    
    let baseScore = 0;
    if (results.requiredSuccess) baseScore += 50;
    if (results.requirementSuccess) baseScore += 20;
    if (results.deliverableSuccess) baseScore += 20;
    if (results.artifactSuccess) baseScore += 10;

    const penalties = {
      unresolvedIssues: results.unresolvedIssuesCount * 5,
      failedOptionals: results.hasFailedOptionals ? 10 : 0,
      warnings: results.warningsCount * 2
    };

    const totalPenalty = Object.values(penalties).reduce((acc, v) => acc + v, 0);
    const overallConfidence = Math.max(0, Math.min(100, baseScore - totalPenalty));

    let confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNDETERMINED' = 'UNDETERMINED';
    if (overallConfidence >= 90) confidenceBand = 'HIGH';
    else if (overallConfidence >= 60) confidenceBand = 'MEDIUM';
    else confidenceBand = 'LOW';

    // Cancelled나 WaitingUser 등 특별 상태일 땐 UNDETERMINED
    if (['CANCELLED', 'WAITING_USER', 'BLOCKED'].includes(outcome)) {
      confidenceBand = 'UNDETERMINED';
    }

    return {
      outcome,
      confidence: {
        overallConfidence,
        componentScores: {
          taskCompletionRate,
          requiredSuccessScore: results.requiredSuccess ? 50 : 0,
          requirementScore: results.requirementSuccess ? 20 : 0,
          deliverableScore: results.deliverableSuccess ? 20 : 0,
          artifactScore: results.artifactSuccess ? 10 : 0,
        },
        penalties,
        confidenceBand,
        rationale: `Outcome ${outcome} with confidence ${overallConfidence}. Base score: ${baseScore}, Penalty: ${totalPenalty}.`
      }
    };
  }
}
