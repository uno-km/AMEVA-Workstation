/**
 * @file orchestrator/task-runtime/completion/evaluators/GoalRequirementCoverageEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 필수 Goal Requirement가 생성된 TaskResult에 의해 커버되었는지 검증
 */

import type { MissionCompletionReviewInput } from '../../domain/types';
import type { RequirementResult } from '../domain/MissionCompletionTypes';

export class GoalRequirementCoverageEvaluator {
  /**
   * 요구사항 커버리지 평가. 
   * AMEVA V2 특성상 명시적인 Goal Spec 스키마가 없는 경우, 임시로 통과 처리하거나 TaskDefinition의 requirementIds를 이용해 Mock 평가를 수행합니다.
   */
  public evaluate(input: MissionCompletionReviewInput): {
    success: boolean;
    requirementResults: RequirementResult[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const requirementResults: RequirementResult[] = [];
    
    // TODO: Phase 2 ApprovedExecutionPlan 스키마에서 Goal Requirement 리스트를 직접 가져와야 함.
    // 현재는 TaskDefinition.requirementIds 기반으로 역산출하여 1:1 매핑되어 있다고 가정합니다.
    const allRequirementIds = new Set<string>();
    input.allTaskDefinitions.forEach(t => {
      if (t.requirementIds) {
        t.requirementIds.forEach(req => allRequirementIds.add(req));
      }
    });

    let success = true;

    for (const reqId of allRequirementIds) {
      // 해당 요구사항을 담당하는 Task 찾기
      const producerTasks = input.allTaskDefinitions.filter(t => t.requirementIds?.includes(reqId));
      const producerTaskIds = producerTasks.map(t => t.id);

      // 이 Task들이 남긴 성공 Result가 있는지 파악
      const verifiedResultIds = input.successfulTaskResults
        .filter(r => producerTaskIds.includes(r.taskId as any)) // 타입 우회를 위해 as any, 혹은 나중에 Result 타입 통일
        .map(r => r.attemptId);

      const isRequired = producerTasks.some(t => t.priority <= 5);
      const isSatisfied = verifiedResultIds.length > 0;

      if (isRequired && !isSatisfied) {
        success = false;
        warnings.push(`[GoalRequirementCoverage] 필수 Requirement ${reqId} 가 달성되지 않았습니다.`);
      }

      requirementResults.push({
        requirementId: reqId,
        required: isRequired,
        sourceText: `Requirement ${reqId}`,
        producerTaskIds,
        verifiedResultIds,
        deliverableIds: [],
        finalArtifactReferences: [],
        status: isSatisfied ? 'SATISFIED' : (isRequired ? 'UNSATISFIED' : 'UNVERIFIABLE'),
        evidenceReferences: [],
        warnings: isSatisfied ? [] : ['Not covered by any successful task result.'],
        unresolvedIssues: []
      });
    }

    return {
      success,
      requirementResults,
      warnings
    };
  }
}
