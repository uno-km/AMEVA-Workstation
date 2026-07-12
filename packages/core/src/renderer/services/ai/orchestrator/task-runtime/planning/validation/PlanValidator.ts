/**
 * @file orchestrator/task-runtime/planning/validation/PlanValidator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 전체 Plan 검증을 관장하는 중앙 Validator
 */

import { GoalSpec, TaskPlan, PlanValidationResult, ValidationIssue } from '../domain/PlanningTypes';
import { TaskGraph } from '../graph/TaskGraph';

export class PlanValidator {
  
  /**
   * GoalSpec과 TaskPlan 초안을 바탕으로 검증 파이프라인을 실행합니다.
   * FATAL이나 ERROR가 있으면 valid = false 처리하여 승인을 막습니다.
   */
  public validate(plan: TaskPlan, goalSpec: GoalSpec): PlanValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    
    // 1. Task Graph 구성 및 Cycle 검증
    try {
      const graph = new TaskGraph(plan.tasks);
      
      const missingDeps = graph.getMissingDependencies();
      if (missingDeps.length > 0) {
        errors.push({
          code: 'MISSING_DEPENDENCY',
          severity: 'FATAL',
          message: `Missing dependencies detected: ${missingDeps.map(m => m.missingDeps.join(',')).join(' | ')}`
        });
      }

      const cycle = graph.detectCycle();
      if (cycle) {
        errors.push({
          code: 'CYCLE_DETECTED',
          severity: 'FATAL',
          message: `Cycle detected in task graph: ${cycle.join(' -> ')}`
        });
      }
    } catch (e: any) {
      errors.push({ code: 'GRAPH_ERROR', severity: 'FATAL', message: e.message });
    }

    // 2. Requirement Coverage 검증 (임시 구현: 모든 Task의 requirementIds 수집 후 GoalSpec과 비교)
    let coveredCount = 0;
    const requiredReqs = goalSpec.requirements.filter(r => r.required);
    const coveredReqIds = new Set<string>();

    plan.tasks.forEach(t => {
      t.requirementIds?.forEach(rId => coveredReqIds.add(rId));
      
      // 3. Completeness 검증
      if (!t.expectedOutputs || t.expectedOutputs.length === 0) {
        errors.push({ code: 'MISSING_OUTPUT', severity: 'ERROR', taskId: t.id, message: 'Task is missing expectedOutputs.' });
      }
      if (!t.acceptanceCriteria || t.acceptanceCriteria.length === 0) {
        errors.push({ code: 'MISSING_CRITERIA', severity: 'ERROR', taskId: t.id, message: 'Task is missing acceptanceCriteria.' });
      }
      if (!t.capabilityRequirements || t.capabilityRequirements.length === 0) {
        warnings.push({ code: 'NO_CAPABILITY', severity: 'WARNING', taskId: t.id, message: 'Task has no capabilityRequirements. Might be a dummy task.' });
      }
    });

    requiredReqs.forEach(req => {
      if (coveredReqIds.has(req.requirementId)) {
        coveredCount++;
      } else {
        errors.push({
          code: 'UNMET_REQUIREMENT',
          severity: 'ERROR',
          requirementId: req.requirementId,
          message: `Required requirement '${req.requirementId}' is not covered by any task.`
        });
      }
    });

    const requirementCoverage = requiredReqs.length === 0 ? 1 : coveredCount / requiredReqs.length;

    // 4. ValidationResult 조립
    const valid = errors.length === 0;

    return {
      validationId: `val-${crypto.randomUUID()}`,
      planId: plan.planId,
      planVersion: plan.version,
      valid,
      errors,
      warnings,
      requirementCoverage,
      deliverableCoverage: 1.0, // TODO: Deliverable 경로 계산
      createdAt: Date.now()
    };
  }
}
