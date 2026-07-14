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
import { ModelRouter } from '../../routing/router/ModelRouter';
import { ModelAdapterProvider } from '../../routing/adapter/ModelAdapterProvider';
import { RoutingConfigManager } from '../../routing/domain/RoutingConfigManager';
import type { TaskRoutingProfile } from '../../routing/domain/types';

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
        
        // [Item 5] Semantic Verifier Routing
        const routingConfig = RoutingConfigManager.getInstance().getConfig();
        if (routingConfig.routingEnabled) {
          const profile: TaskRoutingProfile = {
            taskType: 'SEMANTIC_VERIFIER',
            requiredCapabilities: ['SEMANTIC_VERIFICATION', 'STRUCTURED_OUTPUT'],
            contextSize: 2000,
            expectedOutputTokens: 500,
            privacyLevel: task.definition.privacyLevel || 'INTERNAL',
            instructionComplexity: 0.8,
            reasoningComplexity: 0.9,
            toolRequired: false,
            codeExecutionRequired: false,
            latencyPreference: 'speed',
            qualityPreference: 'high',
            previousModelIds: [],
            routingBudgetRemaining: 5
          };

          const routingResult = await ModelRouter.route(profile, routingConfig);
          
          this.store.getTraceManager().getStore().appendEvent({
            eventId: crypto.randomUUID(),
            traceId: missionId,
            spanId: `span-v-${task.definition.id}-${task.state.activeAttemptId}`,
            parentSpanId: `span-m-${missionId}`,
            missionId,
            taskId: task.definition.id,
            attemptId: task.state.activeAttemptId,
            timestamp: Date.now(),
            eventType: 'model_routing_started',
            status: 'SUCCESS',
            title: `Task Verification Routing`,
            summary: `Routed to ${routingResult.selectedModelId}`,
            sequenceNumber: 0,
            visibility: 'INTERNAL',
            severity: 'INFO',
            schemaVersion: '4.0.0',
            metadata: { routingResult }
          });

          if (routingResult.status === 'SUCCESS' && routingResult.selectedModelId) {
            try {
              const verifierAdapter = await ModelAdapterProvider.getInstance().getAdapterForModel(routingResult.selectedModelId, task.definition.privacyLevel as import('../../domain/types').PrivacyLevel);
              
              // Privacy Gate
              if (verifierAdapter.isRemote) {
                if (task.definition.privacyLevel === 'RESTRICTED') {
                  throw new Error('PrivacyViolation: RESTRICTED tasks cannot use Remote models for verification.');
                }
                if (task.definition.privacyLevel === 'CONFIDENTIAL' && !task.state.metadata?.['remoteApproval']) {
                  throw new Error('PrivacyViolation: CONFIDENTIAL tasks require user approval to use Remote models for verification.');
                }
              }

              this.coordinator.setSemanticAdapter(verifierAdapter);
              
              if (task.state.routingDecision?.selectedModelId === routingResult.selectedModelId) {
                this.store.getTraceManager().getStore().appendEvent({
                  eventId: crypto.randomUUID(),
                  traceId: missionId,
                  spanId: `span-v-${task.definition.id}-${task.state.activeAttemptId}`,
                  parentSpanId: `span-m-${missionId}`,
                  missionId,
                  taskId: task.definition.id,
                  attemptId: task.state.activeAttemptId,
                  timestamp: Date.now(),
                  eventType: 'self_bias_risk_detected' as import('../../trace/types').TraceEventType,
                  status: 'WARNING',
                  title: `Self-Bias Risk`,
                  summary: `Verifier model is the same as Executor model: ${routingResult.selectedModelId}`,
                  sequenceNumber: 0,
                  visibility: 'INTERNAL',
                  severity: 'MEDIUM',
                  schemaVersion: '4.0.0'
                });
                this.coordinator.setStrictBiasMode(true);
              } else {
                this.coordinator.setStrictBiasMode(false);
              }
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.warn(`[VerificationRuntime] Semantic adapter load failed for ${routingResult.selectedModelId}, falling back`, msg);
            }
          }
        }
        
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
            } as unknown as import('../../domain/types').TransitionCommand,
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
              { verification: finalResult }
            );
          }
        } else {
          this.recoveryCoordinator.handleVerificationFailure(finalResult);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[VerificationRuntime] Failed to process verification for task ${task.definition.id}:`, msg);
      }
    }
    return results;
  }
}

