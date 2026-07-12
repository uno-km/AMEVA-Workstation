/**
 * @file orchestrator/task-runtime/planning/domain/PlanningTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role Task Planning 시스템의 타입 계약 (GoalSpec, Plan, Validator)
 */

import type { TaskDefinition } from '../../domain/types';

/**
 * 사용자 요구사항 하나를 나타내는 단위
 */
export interface Requirement {
  requirementId: string;
  sourceText: string;
  normalizedDescription: string;
  type: 'functional' | 'non_functional' | 'constraint' | 'output_format';
  required: boolean;
  priority: number;
  verificationHint?: string;
}

/**
 * 구조화된 사용자 목표 명세서
 */
export interface GoalSpec {
  goalId: string;
  missionId: string;
  objective: string;
  userIntent: string;
  deliverables: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  assumptions: string[];
  missingInformation: string[];
  clarificationPolicy: 'ASSUME' | 'ASK_USER';
  sourceRequest: string;
  requirements: Requirement[];
  createdAt: number;
  schemaVersion: string;
}

export type PlanStatus =
  | 'DRAFT'
  | 'PARSING'
  | 'NORMALIZING'
  | 'VALIDATING'
  | 'WAITING_CLARIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'CANCELLED';

/**
 * 검증 이슈
 */
export interface ValidationIssue {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  message: string;
  taskId?: string;
  requirementId?: string;
  field?: string;
  repairHint?: string;
}

/**
 * 검증 결과
 */
export interface PlanValidationResult {
  validationId: string;
  planId: string;
  planVersion: number;
  valid: boolean;
  score?: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  requirementCoverage: number; // 0.0 ~ 1.0
  deliverableCoverage: number;
  graphSummary?: any;
  capabilitySummary?: any;
  createdAt: number;
}

/**
 * Task Plan 초안 (승인 및 활성화 전)
 */
export interface TaskPlan {
  planId: string;
  missionId: string;
  goalId: string;
  version: number;
  status: PlanStatus;
  plannerSource: 'LLM' | 'USER' | 'LEGACY' | 'SYSTEM' | 'MANUAL' | 'IMPORTED';
  plannerModel?: string;
  rawOutputReference?: string;
  tasks: TaskDefinition[]; // PHASE 1의 확장된 Definition 사용
  requirementMappings?: Record<string, string[]>; // requirementId -> taskId[]
  validationResult?: PlanValidationResult;
  createdAt: number;
  approvedAt?: number;
  activatedAt?: number;
  supersedesPlanId?: string;
  schemaVersion: string;
}
