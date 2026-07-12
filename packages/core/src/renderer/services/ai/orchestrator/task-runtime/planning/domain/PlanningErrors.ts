/**
 * @file orchestrator/task-runtime/planning/domain/PlanningErrors.ts
 * @system AMEVA OS Desktop Workstation
 */

export class GoalInterpretationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalInterpretationError';
  }
}

export class PlanParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanParsingError';
  }
}

export class PlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

export class PlanActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanActivationError';
  }
}
