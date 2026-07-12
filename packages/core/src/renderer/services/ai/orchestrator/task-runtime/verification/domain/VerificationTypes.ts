/**
 * @file orchestrator/task-runtime/verification/domain/VerificationTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 단계에서 사용되는 타입 명세 (Verdict, Criteria 등)
 */

import type { TaskDefinition, TaskResult, TaskEvidence } from '../../domain/types';

/**
 * 개별 조건(Criterion)에 대한 검증 결과 판정
 */
export type CriterionVerdict = 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'UNVERIFIABLE' | 'ERROR';

/**
 * Task 전체에 대한 종합 검증 판정
 */
export type TaskVerdict = 
  | 'PASS'
  | 'NEEDS_REPAIR'
  | 'RETRY'
  | 'BLOCKED'
  | 'NEEDS_USER'
  | 'FAIL';

export interface CriterionResult {
  criterionId: string;
  verifierType: string;
  verdict: CriterionVerdict;
  reason: string;
  evidenceReferences?: string[];
  repairHint?: string;
  score?: number;
  confidence?: number;
}

export interface TaskVerificationResult {
  verificationId: string;
  verificationJobId: string;
  missionId: string;
  planId?: string;
  planVersion?: number;
  taskId: string;
  attemptId: string;
  executionId: string;
  resultId: string;
  
  verdict: TaskVerdict;
  score?: number;
  confidence?: number;
  
  criterionResults: CriterionResult[];
  passedCriteria: string[];
  failedCriteria: string[];
  warnings: string[];
  repairInstructions?: string;
  evidenceReferences?: string[];
  
  verifierTypes: string[];
  verifierVersions: string[];
  
  createdAt: number;
  idempotencyKey: string;
}
