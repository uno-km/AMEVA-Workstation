/**
 * @file orchestrator/task-runtime/completion/evaluators/OptionalTaskPolicyEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 선택(Optional) Task의 상태가 미션 결과(WARNINGS/PARTIAL)에 미치는 영향 평가
 */

import type { MissionCompletionReviewInput } from '../../domain/types';

export class OptionalTaskPolicyEvaluator {
  /**
   * 선택 Task들의 결과를 평가합니다.
   */
  public evaluate(input: MissionCompletionReviewInput): {
    hasFailedOptionals: boolean;
    hasSkippedOptionals: boolean;
    warnings: string[];
  } {
    const failedOptionalCount = input.failedOptionalTasks.length;
    const skippedOptionalCount = input.skippedOptionalTasks.length;
    
    const warnings: string[] = [];

    if (failedOptionalCount > 0) {
      warnings.push(`[OptionalTaskEvaluator] ${failedOptionalCount} optional tasks failed.`);
      input.failedOptionalTasks.forEach(t => {
        warnings.push(` - Task [${t.definition.id}]: ${t.definition.title} failed.`);
      });
    }

    if (skippedOptionalCount > 0) {
      warnings.push(`[OptionalTaskEvaluator] ${skippedOptionalCount} optional tasks were skipped.`);
    }

    return {
      hasFailedOptionals: failedOptionalCount > 0,
      hasSkippedOptionals: skippedOptionalCount > 0,
      warnings
    };
  }
}
