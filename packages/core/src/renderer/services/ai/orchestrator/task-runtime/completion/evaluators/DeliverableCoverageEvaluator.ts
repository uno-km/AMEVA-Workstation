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
  private isRequired(def: any): boolean {
    if (typeof def.required === 'boolean') return def.required;
    if (def.requirementIds && def.requirementIds.length > 0) return true;
    if (def.expectedOutputs && def.expectedOutputs.length > 0) return true;
    return def.priority === 1;
  }

  public evaluate(input: MissionCompletionReviewInput): {
    success: boolean;
    deliverableResults: DeliverableResult[];
    warnings: string[];
  } {
    const warnings: string[] = [];
    const deliverableResults: DeliverableResult[] = [];
    
    let success = true;

    input.allTaskDefinitions.forEach(def => {
      const isReqRequired = this.isRequired(def);
      const expectedOutputs = def.expectedOutputs || [];

      if (expectedOutputs.length === 0) return;

      const stateIdx = input.allTaskDefinitions.findIndex(d => d.id === def.id);
      const state = input.allTaskRuntimeStates[stateIdx];
      const result = state?.taskResult;
      
      expectedOutputs.forEach(outName => {
        let hasOutput = false;
        let valid = false;
        let artifactRef = '';

        if (result?.outputs) {
          const matchedOut = result.outputs.find(o => o.type === outName || (typeof o.content === 'object' && o.content?.name === outName));
          if (matchedOut) {
            hasOutput = true;
            artifactRef = 'virtual_ref_in_memory';
            
            // Text 유효성 검증
            if (typeof matchedOut.content === 'string') {
              const text = matchedOut.content.trim();
              if (text.length > 0 && !text.includes('TODO') && !text.includes('Placeholder') && !text.startsWith('에러')) {
                valid = true;
              }
            } else if (matchedOut.content) {
              valid = true;
            }
          }
        }

        const exists = hasOutput;
        
        if (isReqRequired && (!exists || !valid)) {
          success = false;
          warnings.push(`[DeliverableCoverage] 필수 산출물 누락 혹은 무효함: Task ${def.id} 의 ${outName}`);
        }

        deliverableResults.push({
          deliverableId: outName,
          required: isReqRequired,
          producerTaskId: def.id,
          resultId: result?.attemptId || '',
          artifactReference: artifactRef,
          exists,
          accessible: valid,
          nonEmpty: valid,
          verified: valid && state?.status === 'COMPLETED' && state?.verification?.verdict === 'PASS',
          latestRevision: true,
          integrity: valid,
          warnings: valid ? [] : ['Deliverable output not found, empty, or placeholder']
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
