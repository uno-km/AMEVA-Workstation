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
 * - WARN: 비단순 경고 (비파일 PASS 로 전환 절대 금지)
 * - INCOMPLETE_VERIFICATION: 필수 검증기를 실행하지 못한 상태 — PASS로 집계 절대 금지
 */
export type CriterionVerdict = 'PASS' | 'FAIL' | 'UNCERTAIN' | 'NOT_APPLICABLE' | 'UNVERIFIABLE' | 'ERROR' | 'WARN' | 'INCOMPLETE_VERIFICATION';


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
  | 'BUDGET_EXHAUSTED'
  /*
   * [P0 신규 추가]
   * 실제 산출물 검증과 관련된 defect 타입
   */
  | 'FILESYSTEM_VERIFIER_UNAVAILABLE'   // FILE_OUTPUT_REQUIRED 작업에 fileAdapter 미주입
  | 'OUTPUT_FILE_NOT_FOUND'             // 실제 파일 없음
  | 'OUTPUT_FILE_UNREADABLE'            // 파일 읽기 실패
  | 'OUTPUT_FILE_EMPTY_OR_UNCHANGED'    // 빈 파일 또는 바뀏 전후 변경없음
  | 'OUTPUT_ATTRIBUTION_FAILED'         // 생성 출처 추적 불가
  | 'ARTIFACT_DECLARATION_MISSING'      // Artifact 레지스트리에 없음
  | 'EXPECTED_OUTPUTS_MISSING'          // planner가 expectedFileOutputs를 선언하지 않음
  | 'REQUIRED_OUTPUT_NOT_VERIFIED'      // 필수 산출물 검증 실패
  | 'STRICT_VERIFICATION_FAILED'        // 범용 검증 실패
  | 'INCOMPLETE_VERIFICATION';          // 필수 검증기를 실행하지 못함

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
  llmCallCount?: number;
  /**
   * INCOMPLETE_VERIFICATION 전용 필드:
   * 어떤 이유로 필수 검증기를 실행할 수 없었는지 설명.
   */
  incompleteReason?: string;
}

/**
 * 검증이 통과된 실제 출력물을 나타냄
 * filesystem stat + declaration + attribution + realpath + hash를 모두 수집한 풍부한 증거 객체
 */
export interface VerifiedOutput {
  /** Artifact Registry ID */
  artifactId?: string;
  /** 사용자에게 개방할 로직 경로 (주로 파일명 또는 상대 경로) */
  logicalPath: string;
  /** 실제 파일 시스템 절대 경로 (INTERNAL 전용 — UI에 노출 금지) */
  canonicalPath: string;
  /** 생성한 미션 ID */
  producingMissionId: string;
  /** 생성한 태스크 ID */
  producingTaskId: string;
  /** 생성에 사용된 도구 호출 ID */
  producingToolCallId?: string;
  /** 생성에 사용된 도구 이름 */
  producingTool?: string;
  /** 생성 작업 유형 */
  operationType: 'CREATE' | 'MODIFY' | 'APPEND' | 'PATCH' | 'DELETE' | string;
  /** 실제 존재 여부 (true인 경우만 최종 수용) */
  exists: boolean;
  /** 파일 여부 (디렉토리 구분) */
  isFile: boolean;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
  /** MIME 타입 */
  mimeType?: string;
  /** 변경 전 해시 */
  beforeHash?: string;
  /** 변경 후 해시 / 파일 내용 해시 */
  afterHash?: string;
  contentHash?: string;
  /** Artifact Registry 선언 완료 여부 */
  artifactDeclared: boolean;
  /** 태스크 소유권 귀속 검증 완료 여부 */
  attributionVerified: boolean;
  /** 실시간 FS stat 검증 완료 여부 */
  filesystemVerified: boolean;
  /** realpath sandbox 격리 검증 완료 여부 */
  pathContainmentVerified: boolean;
  /** 내용/유효성 검증 완료 여부 */
  contentVerified: boolean;
  /** 검증 시각 (Unix ms) */
  verifiedAt: number;
  /** 도구 증거 보유 여부 */
  hasToolEvidence?: boolean;
}

/**
 * 종합 판정 결과 (typed — boolean 대체)
 */
export type VerificationDecision =
  | 'PASS'
  | 'FAIL'
  | 'UNCERTAIN'
  | 'INCOMPLETE_VERIFICATION'
  | 'NOT_APPLICABLE';

export interface AggregateVerificationResult {
  decision: VerificationDecision;
  reason: string;
  errorCode?: string;
  verifiedOutputs: VerifiedOutput[];
  missingOutputs: string[];
  outputMode: string;
  criterionResults: CriterionResult[];
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
  contentHash?: string;
  semanticScore?: number;
  contractCoverage?: number;
  
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
