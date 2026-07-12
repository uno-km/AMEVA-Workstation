/**
 * @file orchestrator/task-runtime/planning/domain/HandoverTypes.ts
 * @system AMEVA OS Desktop Workstation
 * @role PHASE 2 (Planning) 와 PHASE 3 (Execution) 사이의 공식 데이터 교환 계약(DTO).
 * 
 * [계약 원칙]
 * 1. PHASE 3 Scheduler는 Raw Planner JSON이나 미승인(DRAFT, VALIDATING) 플랜을 받지 않는다.
 * 2. 모든 DTO는 읽기 전용(Readonly) 속성으로 정의되어야 하며, Executor가 임의 수정할 수 없다.
 * 3. 예산(Budget) 할당 모델과 종속성(Dependency) 매핑 모델을 명시적으로 포함한다.
 */

import type { TaskDefinition } from '../../domain/types';

/**
 * PHASE 3가 전달받을 수 있는 안전하고 승인된(APPROVED/ACTIVE) 실행 계획
 */
export interface ApprovedExecutionPlan {
  readonly planId: string;
  readonly missionId: string;
  readonly version: number;
  readonly status: 'APPROVED' | 'ACTIVE';
  
  // 검증 및 위상 정렬이 완료된 Task 목록 (Readonly)
  readonly tasks: ReadonlyArray<Readonly<TaskDefinition>>;
  
  // 실행 순서를 위한 위상 정렬 순서 및 레이어 (계산된 결과)
  readonly topologicalOrder: ReadonlyArray<string>;
  readonly executionLayers: ReadonlyArray<ReadonlyArray<string>>; // 병렬 실행이 가능한 그룹

  // 메타데이터
  readonly approvedAt: number;
  readonly activatedAt?: number;
  
  // 전체 계획 차원의 남은/초기 예산 요약
  readonly totalAllocatedTurns: number;
}

/**
 * PHASE 3 Executor (Task Runtime) 가 단일 Task를 실행하기 위해 받는 최소 입력 계약
 */
export interface TaskExecutionContract {
  readonly missionId: string;
  readonly planId: string;
  readonly planVersion: number;
  readonly taskId: string;
  readonly attemptId: string;
  readonly executionId: string; // 플랫폼 종속적 실행 ID

  readonly objective: string;
  readonly expectedOutputs: ReadonlyArray<string>;
  readonly acceptanceCriteria: ReadonlyArray<string>;
  
  readonly capabilityRequirements: ReadonlyArray<string>; // 필요한 권한/툴 목록

  // 선행 조건 결과물
  readonly dependencyResults: ReadonlyArray<{
    readonly taskId: string;
    readonly status: 'COMPLETED';
    readonly outputs: any[];
  }>;

  // 허용 예산
  readonly reasoningBudget: number;
  readonly toolBudget: number;
  readonly durationLimitMs: number;

  readonly cancellationSignal?: AbortSignal; // 중단 신호
  readonly idempotencyKey: string;
}
