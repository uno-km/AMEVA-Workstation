/**
 * @file orchestrator/task-runtime/scheduling/ReadinessEvaluator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 특정 Task가 실행 준비(READY) 상태로 전이할 수 있는지 모든 조건을 평가
 */

import type { TaskEntity } from '../domain/types';
import { TaskRuntimeStore } from '../store/TaskRuntimeStore';
import { MissionBudgetLedger } from '../budget/MissionBudgetLedger';
import { CapabilityCatalog } from '../dispatch/CapabilityCatalog';
import type { DependencyFailureReason, DeadlockClassification } from '../domain/ExecutionTypes';

export interface ReadinessResult {
  isReady: boolean;
  reasons: string[];
  blockType?: DeadlockClassification;
  dependencyFailure?: {
    reason: DependencyFailureReason;
    sourceTaskId: string;
  };
}

export class ReadinessEvaluator {
  private catalog: CapabilityCatalog;

  constructor(
    private store: TaskRuntimeStore,
    private ledger: MissionBudgetLedger
  ) {
    this.catalog = new CapabilityCatalog();
  }

  /**
   * PENDING 또는 RETRY_WAIT 상태의 Task가 READY로 갈 수 있는지 평가합니다.
   * PHASE 3.5: 차단 사유를 구조화하여 반환합니다.
   */
  public evaluate(missionId: string, task: TaskEntity): ReadinessResult {
    const reasons: string[] = [];

    // 1. 기본 상태 조건
    if (task.state.status !== 'PENDING' && task.state.status !== 'RETRY_WAIT') {
      return { 
        isReady: false, 
        reasons: [`Task is currently in ${task.state.status} state, not evaluable for READY.`],
        blockType: 'PLAN_STATE_INVALID'
      };
    }

    // 2. 의존성 (Dependencies) 해결 여부
    if (task.definition.dependencies && task.definition.dependencies.length > 0) {
      for (const depId of task.definition.dependencies) {
        try {
          const depTask = this.store.getTask(missionId, depId);
          if (depTask.state.status !== 'COMPLETED') {
            let depFailReason: DependencyFailureReason = 'DEPENDENCY_NOT_COMPLETED';
            if (depTask.state.status === 'FAILED') depFailReason = 'DEPENDENCY_TASK_FAILED';
            else if (depTask.state.status === 'CANCELLED') depFailReason = 'DEPENDENCY_TASK_CANCELLED';
            else if (depTask.state.status === 'SKIPPED') depFailReason = 'DEPENDENCY_TASK_SKIPPED';
            
            return {
              isReady: false,
              reasons: [`Dependency '${depId}' is not COMPLETED (current: ${depTask.state.status}).`],
              blockType: 'WAITING_DEPENDENCY_RECOVERY',
              dependencyFailure: { reason: depFailReason, sourceTaskId: depId }
            };
          } 
          
          if (!depTask.state.verification || depTask.state.verification.verdict !== 'PASS') {
            return {
              isReady: false,
              reasons: [`Dependency '${depId}' lacks a 'PASS' verification verdict.`],
              blockType: 'WAITING_DEPENDENCY_RECOVERY',
              dependencyFailure: { reason: 'DEPENDENCY_VERIFICATION_NOT_PASS', sourceTaskId: depId }
            };
          }
          
          if (!depTask.state.taskResult) {
            return {
              isReady: false,
              reasons: [`Dependency '${depId}' has no taskResult.`],
              blockType: 'WAITING_DEPENDENCY_RECOVERY',
              dependencyFailure: { reason: 'DEPENDENCY_RESULT_MISSING', sourceTaskId: depId }
            };
          }
        } catch (e) {
          return {
            isReady: false,
            reasons: [`Dependency '${depId}' is missing from the store.`],
            blockType: 'INTERNAL_ERROR'
          };
        }
      }
    }

    // 3. Capability (권한 및 툴) 요구사항 충족 여부
    const requiredCaps = task.definition.capabilityRequirements || [];
    if (requiredCaps.length > 0) {
      const missingCaps = this.catalog.getMissingCapabilities(requiredCaps);
      if (missingCaps.length > 0) {
        return {
          isReady: false,
          reasons: [`Missing capabilities: ${missingCaps.join(', ')}`],
          blockType: 'WAITING_CAPABILITY'
        };
      }
    }

    // 4. 예산 (Budget) 여유분 확인
    const requestedTurns = task.definition.allocatedReasoningTurns || task.definition.budgetTurns || 100;
    const availableBudget = this.ledger.getAvailableBudget(missionId);
    if (availableBudget < requestedTurns) {
      return {
        isReady: false,
        reasons: [`Insufficient mission budget. Requested: ${requestedTurns}, Available: ${availableBudget}.`],
        blockType: 'WAITING_BUDGET'
      };
    }

    return { isReady: true, reasons: [] };
  }
}
