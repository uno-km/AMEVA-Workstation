/**
 * @file orchestrator/task-runtime/domain/HandoverTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role PHASE 4(검증 및 복구)와의 인터페이스 계약 명세
 */

import { TaskEntity, TaskResult, TaskDefinition } from './types';
import { TaskEvidence, TaskOutput } from './types';
import { TaskAttempt } from './types';

/**
 * TaskResult 후보를 생성한 태스크를 검증하기 위한 입력 인터페이스.
 * PHASE 4의 TaskVerifier가 사용할 데이터 모델.
 */
export interface TaskVerificationInput {
  missionId: string;
  planId?: string;
  planVersion?: number;
  taskId: string;
  taskDefinition: TaskDefinition;
  attemptId: string;
  executionId: string;
  taskResult: TaskResult;
  expectedOutputs?: string[];
  acceptanceCriteria?: string[];
  requirementIds?: string[];
  dependencyResultReferences?: string[]; // 선행 태스크들의 결과 ID
  evidence: TaskEvidence[];
  outputs: TaskOutput[];
  budgetConsumption: number; // 소비된 턴 수
  streamFinishReason: 'DONE' | 'EOF' | 'ABORT' | 'ERROR' | 'MAX_TURNS';
  executionFailure?: any;
  createdAt: number;
}

/**
 * 의존성 불일치나 선행 태스크 문제로 실행이 블록된 경우, 복구를 요청하는 인터페이스.
 * PHASE 4의 Dependency Recovery Engine이 사용할 데이터 모델.
 */
export interface DependencyRecoveryInput {
  recoveryRequestId: string;
  missionId: string;
  planId?: string;
  planVersion?: number;
  blockedTaskId: string;
  sourceTaskId?: string; // 문제를 일으킨 선행 태스크 ID (있는 경우)
  sourceAttemptId?: string;
  failureReason: string; // DependencyFailureReason 값
  currentTaskState: string;
  sourceTaskState?: string;
  sourceTaskResult?: TaskResult;
  sourceVerificationResult?: any;
  retryCount: number;
  recoveryCount: number;
  retryBudgetRemaining: number;
  recoveryBudgetRemaining: number;
}

/**
 * 복구 엔진이 내린 결정 사항.
 */
export type RecoveryDecision = 
  | 'RESYNC_STATE'
  | 'RESTORE_RESULT'
  | 'REVERIFY_RESULT'
  | 'REPAIR_RESULT'
  | 'RETRY_SAME_STRATEGY'
  | 'RETRY_DIFFERENT_STRATEGY'
  | 'RESTORE_CHECKPOINT'
  | 'WAIT_FOR_CAPABILITY'
  | 'WAIT_FOR_USER'
  | 'SKIP_OPTIONAL_TASK'
  | 'FAIL_REQUIRED_TASK';
