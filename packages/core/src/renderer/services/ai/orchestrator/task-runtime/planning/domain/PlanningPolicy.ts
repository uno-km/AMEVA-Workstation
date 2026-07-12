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
    // 딥 리즈닝(Deep Reasoning) 등 Task 당 최대 추론 허용 횟수
    // 사용자의 특별 요청: "최대 1000까지 허용"
    defaultTaskReasoningBudget: 1000, 
    maxTaskReasoningBudget: 1000,
  }
} as const;
