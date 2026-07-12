/**
 * @file orchestrator/task-runtime/domain/errors.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task Runtime 도메인 특화 에러들 모음
 */

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export class StaleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleStateError';
  }
}

export class DuplicateCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateCommandError';
  }
}

export class ActiveAttemptConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActiveAttemptConflictError';
  }
}

export class MissingVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingVerificationError';
  }
}

export class LegacyMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegacyMigrationError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskNotFoundError';
  }
}

export class MissionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissionNotFoundError';
  }
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class LeaseConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LeaseConflictError';
  }
}

