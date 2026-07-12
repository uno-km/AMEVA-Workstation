/**
 * @file orchestrator/task-runtime/planning/goal/GoalValidator.ts
 * @system AMEVA OS Desktop Workstation
 */

import type { GoalSpec } from '../domain/PlanningTypes';

export class GoalValidator {
  /**
   * 생성된 GoalSpec이 Plan 생성을 시작할 만큼 완결성이 있는지 판단한다.
   * ClarificationPolicy가 'ASK_USER' 라면, 플래닝을 진행하지 못하도록 방어한다.
   */
  public validate(spec: GoalSpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!spec.goalId || !spec.missionId) {
      errors.push('Missing goalId or missionId.');
    }
    
    if (spec.clarificationPolicy === 'ASK_USER') {
      errors.push('Clarification is required before planning can proceed.');
    }

    if (spec.requirements.length === 0) {
      errors.push('No requirements extracted. The goal must have at least one requirement.');
    }

    if (spec.deliverables.length === 0) {
      errors.push('No deliverables defined. The goal must produce at least one output.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
