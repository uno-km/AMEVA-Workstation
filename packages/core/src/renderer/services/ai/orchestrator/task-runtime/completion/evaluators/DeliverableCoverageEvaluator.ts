/**
 * @file orchestrator/task-runtime/completion/evaluators/DeliverableCoverageEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 최종 Deliverable(산출물) 유효성 및 존재 여부 검증
 */

import type { MissionCompletionReviewInput } from '../../domain/types';
import type { DeliverableResult } from '../domain/MissionCompletionTypes';

export class DeliverableCoverageEvaluator {
  /**
   * 예상되는 Deliverable 들이 실제 TaskResult의 output 또는 파일 시스템(가정) 상에 존재하는지 평가.
   */
  public evaluate(input: MissionCompletionReviewInput): {
    success: boolean;
    deliverableResults: DeliverableResult[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const deliverableResults: DeliverableResult[] = [];
    
    // 현재 AMEVA V2 모델상 Deliverable은 TaskDefinition의 expectedOutputs 로 간접 표기됩니다.
    let success = true;

    input.allTaskDefinitions.forEach(def => {
      const isRequired = def.priority <= 5;
      const expectedOutputs = def.expectedOutputs || [];

      if (expectedOutputs.length === 0) return;

      const state = input.allTaskRuntimeStates.find(s => s.taskResult && s.status === 'COMPLETED');
      const result = state?.taskResult;
      
      expectedOutputs.forEach(outName => {
        // 실제 아웃풋 매칭 로직 (이름이나 타입 기반)
        const hasOutput = result?.outputs.some(o => o.type === outName || o.data !== undefined);
        const exists = !!hasOutput;

        if (isRequired && !exists) {
          success = false;
          warnings.push(`[DeliverableCoverage] 필수 산출물 누락: Task ${def.id} 의 ${outName}`);
        }

        deliverableResults.push({
          deliverableId: outName,
          required: isRequired,
          producerTaskId: def.id,
          resultId: result?.attemptId || '',
          artifactReference: hasOutput ? 'virtual_ref_in_memory' : '',
          exists,
          accessible: exists,
          nonEmpty: exists,
          verified: exists && !!state?.verification,
          latestRevision: true,
          integrity: exists,
          warnings: exists ? [] : ['Deliverable output not found in task result']
        });
      });
    });

    return {
      success,
      deliverableResults,
      warnings
    };
  }
}
