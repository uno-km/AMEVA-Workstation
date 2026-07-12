/**
 * @file orchestrator/task-runtime/verification/runtime/VerificationRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role VERIFYING 상태 태스크의 검증 파이프라인(Input -> Coordinate -> Policy) 실행을 관리하는 독립 런타임
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { VerificationInputBuilder } from './VerificationInputBuilder';
import { TaskVerifierCoordinator } from '../verifiers/TaskVerifierCoordinator';
import { VerificationDecisionPolicy } from '../decision/VerificationDecisionPolicy';
import { TaskVerificationResult } from '../domain/VerificationTypes';
import { RecoveryCoordinator } from '../recovery/RecoveryCoordinator';
import { RecoveryRequestStore } from '../recovery/RecoveryRequestStore';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';

export class VerificationRuntime {
  private inputBuilder: VerificationInputBuilder;
  private coordinator: TaskVerifierCoordinator;
  private policy: VerificationDecisionPolicy;
  private recoveryCoordinator: RecoveryCoordinator;

  constructor(
    private store: TaskRuntimeStore,
    recoveryStore: RecoveryRequestStore,
    ledger: MissionBudgetLedger
  ) {
    this.inputBuilder = new VerificationInputBuilder(store);
    this.coordinator = new TaskVerifierCoordinator();
    this.policy = new VerificationDecisionPolicy();
    this.recoveryCoordinator = new RecoveryCoordinator(store, recoveryStore, ledger);
  }

  /**
   * 특정 Mission 내의 모든 VERIFYING 태스크에 대해 검증을 수행하고, 결과를 반환합니다.
   * (실제 런타임에서는 이 결과를 받아 Store에 Transition 하거나 RecoveryCoordinator로 넘겨야 함)
   */
  public async processVerifyingTasks(missionId: string): Promise<TaskVerificationResult[]> {
    const allTasks = this.store.getAllTasks(missionId);
    const verifyingTasks = allTasks.filter(t => t.state.status === 'VERIFYING');
    
    const results: TaskVerificationResult[] = [];

    for (const task of verifyingTasks) {
      try {
        const jobId = `vjob-${crypto.randomUUID()}`;
        
        // 1. Input 빌드
        const input = this.inputBuilder.build(missionId, task.definition.id, task.state.activeAttemptId);
        
        // 2. 파이프라인 실행
        const criterionResults = await this.coordinator.runVerificationPipeline(input);
        
        // 3. 최종 정책 판정
        const finalResult = this.policy.evaluate(input, criterionResults, jobId);
        
        results.push(finalResult);

        // 4. 상태 적용 (PASS면 COMPLETED로 전이, 아니면 Recovery 런타임 호출)
        if (finalResult.verdict === 'PASS') {
          this.store.dispatchTransition(
            {
              commandId: `cmd-verif-${crypto.randomUUID()}`,
              missionId,
              taskId: task.definition.id,
              expectedCurrentStatus: 'VERIFYING',
              expectedStateVersion: task.state.stateVersion,
              reason: 'Verification Passed',
              actor: 'VerificationRuntime',
              timestamp: Date.now()
            },
            'COMPLETED',
            { verification: finalResult as any } // verification 객체 주입
          );
        } else {
          // 실패 시 복구 코디네이터로 이관 (상태 전이는 RecoveryCoordinator가 책임짐)
          this.recoveryCoordinator.handleVerificationFailure(finalResult);
        }
        
      } catch (e: any) {
        console.error(`[VerificationRuntime] Failed to process verification for task ${task.definition.id}:`, e);
      }
    }

    return results;
  }
}

