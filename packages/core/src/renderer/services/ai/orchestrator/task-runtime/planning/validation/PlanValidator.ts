/**
 * @file orchestrator/task-runtime/planning/validation/PlanValidator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 전체 Plan 검증을 관장하는 중앙 Validator
 */
import type { GoalSpec, TaskPlan, PlanValidationResult, ValidationIssue } from '../domain/PlanningTypes';
import { TaskGraph } from '../graph/TaskGraph';

const INVALID_CRITERIA_KEYWORDS = ['충분히', '잘', '완벽하게', '좋은', '적절한'];
// 임시 Capability 화이트리스트 (PHASE 3 Dispatcher 연동 전)
const VALID_CAPABILITIES = ['web.search', 'file.read', 'file.write', 'cmd.run', 'browser.action', 'sql.execute', 'system.notify', 'semantic.search'];

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
      // 3. Completeness & Criteria Quality
      if (!t.expectedOutputs || t.expectedOutputs.length === 0) {
        errors.push({ code: 'MISSING_OUTPUT', severity: 'ERROR', taskId: t.id, message: 'Task is missing expectedOutputs.' });
      }
      if (!t.acceptanceCriteria || t.acceptanceCriteria.length === 0) {
        errors.push({ code: 'MISSING_CRITERIA', severity: 'ERROR', taskId: t.id, message: 'Task is missing acceptanceCriteria.' });
      } else {
        // 모호한 Criteria 필터링
        t.acceptanceCriteria.forEach(criteria => {
          if (INVALID_CRITERIA_KEYWORDS.some(kw => criteria.includes(kw))) {
            errors.push({ code: 'AMBIGUOUS_CRITERIA', severity: 'ERROR', taskId: t.id, message: `Ambiguous acceptance criteria detected: "${criteria}"` });
          }
        });
      }

      // 4. Capability Validation
      if (!t.capabilityRequirements || t.capabilityRequirements.length === 0) {
        warnings.push({ code: 'NO_CAPABILITY', severity: 'WARNING', taskId: t.id, message: 'Task has no capabilityRequirements. Might be a dummy task.' });
      } else {
        t.capabilityRequirements.forEach(cap => {
          if (!VALID_CAPABILITIES.includes(cap)) {
            errors.push({ code: 'INVALID_CAPABILITY', severity: 'ERROR', taskId: t.id, message: `Capability '${cap}' is not supported or invalid.` });
          }
        });
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

    // 5. Reachability / 고립 노드 검사 (Graph 기반)
    if (errors.length === 0) { // 기본 구조가 맞을 때만 그래프 심화 탐색
      const isolatedTasks = plan.tasks.filter(t => {
        // 진입/진출 간선이 모두 없는 경우 고립으로 판정 (단일 노드 플랜 제외)
        if (plan.tasks.length === 1) return false; 
        const isDependedOn = plan.tasks.some(other => other.dependencies.includes(t.id));
        const hasDependencies = t.dependencies.length > 0;
        return !isDependedOn && !hasDependencies;
      });
      isolatedTasks.forEach(iso => {
        errors.push({ code: 'ISOLATED_TASK', severity: 'ERROR', taskId: iso.id, message: 'Task is isolated (unreachable from and to any node).' });
      });
    }


    const requirementCoverage = requiredReqs.length === 0 ? 1 : coveredCount / requiredReqs.length;
    const valid = errors.length === 0;

    /*
     * [STAGE A 수정] deliverableCoverage 실제 계산
     * goalSpec.deliverables의 각 항목이 어느 Task의 expectedOutputs에 부분 일치하는지 검사.
     * 완전 일치가 불가능하므로 소문자 포함 여부(토큰화 비교)로 Coverage를 판단.
     * deliverables가 없으면 요구사항 Coverage를 deliverableCoverage로 사용.
     */
    let deliverableCoverage: number;
    if (!goalSpec.deliverables || goalSpec.deliverables.length === 0) {
      // Deliverable 명세가 없으면 Requirement Coverage를 대리 지표로 사용
      deliverableCoverage = requirementCoverage;
    } else {
      // 모든 Task의 expectedOutputs를 합쳐 검색 풀로 사용
      const allExpectedOutputTokens = plan.tasks.flatMap(t =>
        (t.expectedOutputs || []).map(s => s.toLowerCase())
      ).join(' ');

      const coveredDeliverables = goalSpec.deliverables.filter(deliverable => {
        const deliverableLower = deliverable.toLowerCase();
        // 단어 단위 포함 여부 확인 (단순 substring 포함)
        return allExpectedOutputTokens.includes(deliverableLower) ||
          // 토큰 분리 후 한 단어라도 포함 시 부분 포함으로 인정 (Precision 낮지만 Recall 우선)
          deliverableLower.split(/\s+/).some(token => token.length > 2 && allExpectedOutputTokens.includes(token));
      });
      deliverableCoverage = coveredDeliverables.length / goalSpec.deliverables.length;

      // 핵심 Deliverable이 하나도 커버되지 않으면 WARNING 추가
      if (deliverableCoverage < 0.5) {
        warnings.push({
          code: 'LOW_DELIVERABLE_COVERAGE',
          severity: 'WARNING',
          message: `Deliverable coverage is low (${Math.round(deliverableCoverage * 100)}%). Some deliverables may not be produced by any task.`
        });
      }
    }

    return {
      validationId: `val-${crypto.randomUUID()}`,
      planId: plan.planId,
      planVersion: plan.version,
      valid,
      errors,
      warnings,
      requirementCoverage,
      deliverableCoverage,
      createdAt: Date.now()
    };
  }
}

