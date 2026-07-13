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
  private isRequired(def: any): boolean {
    if (typeof def.required === 'boolean') return def.required;
    if (def.requirementIds && def.requirementIds.length > 0) return true;
    if (def.expectedOutputs && def.expectedOutputs.length > 0) return true;
    return def.priority === 1;
  }

  public evaluate(input: MissionCompletionReviewInput): {
    requiredRequirementSuccess: boolean;
    requirementResults: RequirementResult[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const requirementResults: RequirementResult[] = [];
    
    const allRequirementIds = new Set<string>();
    input.allTaskDefinitions.forEach(t => {
      if (t.requirementIds) {
        t.requirementIds.forEach(req => allRequirementIds.add(req));
      }
    });

    let requiredRequirementSuccess = true;

    for (const reqId of allRequirementIds) {
      const producerTasks = input.allTaskDefinitions.filter(t => t.requirementIds?.includes(reqId));
      const producerTaskIds = producerTasks.map(t => t.id);

      const verifiedResultIds: string[] = [];
      let hasValidOutput = false;


      producerTasks.forEach(pTask => {
        const stateIdx = input.allTaskDefinitions.findIndex(d => d.id === pTask.id);
        const state = input.allTaskRuntimeStates[stateIdx];
        if (!state) return;

        if (state.status === 'COMPLETED' && state.taskResult && state.verification?.verdict === 'PASS') {
          verifiedResultIds.push(state.taskResult.attemptId);
          // 실제 유효한 산출물 데이터가 있는지 딥 검사
          if (state.taskResult.outputs && state.taskResult.outputs.length > 0) {
            hasValidOutput = true;
          }
        }
      });

      let isReqRequired = false;
      for (const t of producerTasks) {
        if (typeof t.required === 'boolean') {
          isReqRequired = isReqRequired || t.required;
        } else if (t.priority === 1) {
          isReqRequired = true;
          console.warn(`[GoalRequirementCoverageEvaluator] Task ${t.id} has undefined 'required' field. Falling back to priority === 1 as required=true.`);
        }
      }
      
      const isSatisfied = verifiedResultIds.length > 0 && hasValidOutput;

      if (!isSatisfied) {
        if (isReqRequired) {
          requiredRequirementSuccess = false;
          warnings.push(`[GoalRequirementCoverage] 필수 Requirement ${reqId} 가 달성되지 않았거나 유효한 산출물이 없습니다.`);
        } else {
          warnings.push(`[GoalRequirementCoverage] 선택 Requirement ${reqId} 가 달성되지 않았습니다.`);
        }
      }

      requirementResults.push({
        requirementId: reqId,
        required: isReqRequired,
        sourceText: `Requirement ${reqId}`,
        producerTaskIds,
        verifiedResultIds,
        deliverableIds: [],
        finalArtifactReferences: [],
        status: isSatisfied ? 'SATISFIED' : (isReqRequired ? 'UNSATISFIED' : 'UNVERIFIABLE'),
        evidenceReferences: [],
        warnings: isSatisfied ? [] : ['Not covered by any successful task result or missing outputs.'],
        unresolvedIssues: []
      });
    }

    return {
      requiredRequirementSuccess,
      requirementResults,
      warnings
    };
  }
}
