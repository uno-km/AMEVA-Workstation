/**
 * @file orchestrator/task-runtime/planning/domain/PlanningPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role Planner가 지켜야 할 중앙 정책 설정 (한도, 타임아웃, 예산)
 */

export const PlanningPolicy = {
  limits: {
    maxTasksPerPlan: 20, // 단일 계획 내 최대 Task 수
    maxDependenciesPerTask: 5, // Task 하나가 가질 수 있는 최대 의존성 수
    maxAcceptanceCriteriaPerTask: 10,
    maxExpectedOutputsPerTask: 10,
    maxRequirementMappings: 50,
    maxPlannerOutputBytes: 1024 * 1024, // 1MB 
    maxRepairAttempts: 2, // Planner 복구 요청 최대 2회
    maxGraphDepth: 10, // Graph DAG 최대 깊이
    maxStringLength: 10000, // 긴 문자열 필드 최대 길이 방어
  },
  
  budgets: {
    mission: {
      maxReasoningTurns: 10000,
      maxDurationMs: 1000 * 60 * 60 * 24, // 24시간
      maxToolCalls: 50000,
      maxRecoveries: 100
    },
    task: {
      maxReasoningTurnsPerTask: 1000,
      maxDurationMsPerTask: 1000 * 60 * 60 * 2, // 2시간
      maxToolCallsPerTask: 5000,
      maxRecoveriesPerTask: 10
    },
    defaultTaskReasoningBudget: 1000, // Legacy 호환성
  }
} as const;
