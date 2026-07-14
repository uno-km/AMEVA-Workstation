/**
 * @file orchestrator/task-runtime/verification/runtime/VerificationRuntime.ts
 * @system AMEVA OS Desktop Workstation
 * @role VERIFYING 상태 태스크의 검증 파이프라인(Input -> Coordinate -> Policy) 실행을 관리하는 독립 런타임
 */

import { TaskRuntimeStore } from '../../store/TaskRuntimeStore';
import { VerificationInputBuilder } from './VerificationInputBuilder';
import { TaskVerifierCoordinator } from '../verifiers/TaskVerifierCoordinator';
import { VerificationDecisionPolicy } from '../decision/VerificationDecisionPolicy';
import type { TaskVerificationResult } from '../domain/VerificationTypes';
import { RecoveryCoordinator } from '../recovery/RecoveryCoordinator';
import { RecoveryRequestStore } from '../recovery/RecoveryRequestStore';
import { MissionBudgetLedger } from '../../budget/MissionBudgetLedger';
import type { ILLMEngineAdapter } from '../../../types';
import type { ArtifactTransactionManager } from '../../artifact/ArtifactTransactionManager';

export class VerificationRuntime {
  private inputBuilder: VerificationInputBuilder;
  private coordinator: TaskVerifierCoordinator;
  private policy: VerificationDecisionPolicy;
  private recoveryCoordinator: RecoveryCoordinator;
  private store: TaskRuntimeStore;
  private artifactManager?: ArtifactTransactionManager;

  constructor(
    store: TaskRuntimeStore,
    recoveryStore: RecoveryRequestStore,
    ledger: MissionBudgetLedger,
    adapter?: ILLMEngineAdapter,
    artifactManager?: ArtifactTransactionManager
  ) {
    this.store = store;
    this.inputBuilder = new VerificationInputBuilder(store);
    this.coordinator = new TaskVerifierCoordinator(adapter);
    this.policy = new VerificationDecisionPolicy();
    this.recoveryCoordinator = new RecoveryCoordinator(store, recoveryStore, ledger);
    this.artifactManager = artifactManager;
  }

  public async processVerifyingTasks(missionId: string): Promise<TaskVerificationResult[]> {
    const allTasks = this.store.getAllTasks(missionId);
    const verifyingTasks = allTasks.filter(t => t.state.status === 'VERIFYING');
    
    const results: TaskVerificationResult[] = [];

    for (const task of verifyingTasks) {
      try {
        const jobId = `vjob-${crypto.randomUUID()}`;
        const input = this.inputBuilder.build(missionId, task.definition.id, task.state.activeAttemptId);
        const criterionResults = await this.coordinator.runVerificationPipeline(input);
        
        // Update Budget
        let totalLlmCalls = 0;
        for (const res of criterionResults) {
          if (res.llmCallCount) totalLlmCalls += res.llmCallCount;
        }

        if (totalLlmCalls > 0) {
          const newCount = (task.state.semanticCriticCallCount || 0) + totalLlmCalls;
          this.store.updateTaskMetadata(
            {
              commandId: `cmd-budget-${crypto.randomUUID()}`,
              missionId,
              taskId: task.definition.id,
              attemptId: task.state.activeAttemptId,
              expectedStateVersion: task.state.stateVersion,
              reason: 'Increment semanticCriticCallCount',
              actor: 'VerificationRuntime',
              timestamp: Date.now()
            } as any,
            { semanticCriticCallCount: newCount }
          );
          // Pass the updated count to the policy
          input.taskState = { ...input.taskState, semanticCriticCallCount: newCount };
        }

        const finalResult = this.policy.evaluate(input, criterionResults, jobId);
        results.push(finalResult);

        // Phase 4 Trace: verification_passed/failed
        this.store.getTraceManager().recordVerificationTrace(
          missionId, task.definition.id, task.state.activeAttemptId ?? '1',
          {
            verificationId: `verif-${crypto.randomUUID()}`,
            stage: 'SEMANTIC',
            verifierName: 'VerificationPolicy',
            startedAt: Date.now(),
            completedAt: Date.now(),
            durationMs: 0,
            verdict: finalResult.verdict === 'PASS' ? 'PASS' : finalResult.verdict === 'RETRY' ? 'NEEDS_RETRY' : 'FAIL',
            score: finalResult.semanticScore,
            defectCount: finalResult.defects?.length ?? 0,
            defects: finalResult.defects?.map(d => ({
              signature: d.signature,
              description: d.description,
              severity: 'HIGH' as const
            })) ?? [],
            semanticCriticCalled: (task.state.semanticCriticCallCount || 0) > 0,
            autoPassBlockTriggered: false
          }
        );

        if (finalResult.verdict === 'PASS') {
          // Commit phase: Commit VALIDATED artifacts BEFORE task completion
          let commitFailed = false;
          let commitErrorMsg = '';

          if (this.artifactManager && finalResult.deliverableResults) {
             for (const dr of finalResult.deliverableResults) {
                if (dr.exists && dr.accessible && dr.artifactReference && dr.artifactReference.startsWith('/')) {
                   try {
                     await this.artifactManager.markValidated(missionId, dr.artifactReference);
                     await this.artifactManager.commitArtifact(missionId, dr.artifactReference);
                   } catch (err: unknown) {
                     commitFailed = true;
                     commitErrorMsg = err instanceof Error ? err.message : String(err);
                     console.error(`[VerificationRuntime] Commit failed for ${dr.artifactReference}:`, err);
                     break; // Stop committing if one fails (atomic mission-level safety)
                   }
                }
             }
          }

          if (commitFailed) {
            // Re-route to failure
            finalResult.verdict = 'FAIL';
            finalResult.reasons.push(`Artifact commit failed: ${commitErrorMsg}`);
            this.recoveryCoordinator.handleVerificationFailure(finalResult);
          } else {
            this.store.dispatchTransition(
              {
                commandId: `cmd-verif-${crypto.randomUUID()}`,
                missionId,
                taskId: task.definition.id,
                expectedCurrentStatus: 'VERIFYING',
                expectedStateVersion: task.state.stateVersion,
                reason: 'Verification & Commit Passed',
                actor: 'VerificationRuntime',
                timestamp: Date.now()
              },
              'COMPLETED',
              { verification: finalResult as any }
            );
          }
        } else {
          this.recoveryCoordinator.handleVerificationFailure(finalResult);
        }
      } catch (e: any) {
        console.error(`[VerificationRuntime] Failed to process verification for task ${task.definition.id}:`, e);
      }
    }
    return results;
  }
}

