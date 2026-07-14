/**
 * @file orchestrator/task-runtime/verification/domain/VerificationTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 단계에서 사용되는 타입 명세 (Verdict, Criteria 등)
 */

// No unused imports

/**
 * 개별 조건(Criterion)에 대한 검증 결과 판정
 * - PASS: 기준 충족
 * - FAIL: 기준 불충족 (명확한 실패)
 * - UNCERTAIN: LLM 판정 불가 또는 파싱 실패 (PASS로 집계 절대 금지)
 * - NOT_APPLICABLE: 검증기 미연결 또는 해당 없음
 * - UNVERIFIABLE: 구조적으로 검증 자체 불가
 * - ERROR: 검증기 내부 오류 (예외 발생)
 */
export type CriterionVerdict = 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_APPLICABLE' | 'UNVERIFIABLE' | 'ERROR';


/**
 * Task 전체에 대한 종합 검증 판정
 */
export type TaskVerdict = 
  | 'PASS'
  | 'NEEDS_REPAIR'
  | 'RETRY'
  | 'BLOCKED'
  | 'NEEDS_USER'
  | 'WAITING_USER'
  | 'NOT_APPLICABLE'
  | 'FAIL';

export type RetryScope = 'ARTIFACT' | 'SECTION' | 'FIELD' | 'FILE' | 'FUNCTION' | 'TEST' | 'TOOL_CALL' | 'FULL_TASK';

export type DefectType = 
  | 'ARTIFACT_MISSING' 
  | 'ARTIFACT_NOT_COMMITTED' 
  | 'HASH_MISMATCH' 
  | 'FORMAT_INVALID' 
  | 'SKELETON_CONTENT' 
  | 'CONTRACT_MISSING' 
  | 'REQUIREMENT_UNCOVERED' 
  | 'SEMANTIC_INCONSISTENCY' 
  | 'INSUFFICIENT_EVIDENCE' 
  | 'BUILD_FAILED' 
  | 'TEST_FAILED' 
  | 'CRITIC_UNAVAILABLE' 
  | 'CRITIC_RESPONSE_INVALID' 
  | 'NO_PROGRESS' 
  | 'BUDGET_EXHAUSTED';

export interface Defect {
  defectId: string;
  signature: string;
  stage: 'DETERMINISTIC' | 'CONTRACT' | 'SEMANTIC';
  type: DefectType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  required: boolean;
  artifactId?: string;
  targetSection?: string;
  targetPath?: string;
  message: string;
  repairInstruction?: string;
  retryScope?: RetryScope;
  evidence?: any;
  retryable: boolean;
}

export interface CriterionResult {
  criterionId: string;
  verifierType: string;
  verdict: CriterionVerdict;
  reason: string;
  evidenceReferences?: string[];
  repairHint?: string;
  score?: number;
  confidence?: number;
  defect?: Defect;
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
  defects?: Defect[];
  retryScope?: RetryScope;
  repairInstructions?: string;
  evidenceReferences?: string[];
  
  evaluatedAt?: number;
  modelId?: string;
  promptVersion?: string;
  
  verifierTypes: string[];
  verifierVersions: string[];
  
  createdAt: number;
  idempotencyKey: string;
}
