/**
 * @file orchestrator/task-runtime/verification/decision/VerificationDecisionPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role 다수의 CriterionResult를 종합하여 최종 TaskVerdict 판정 도출
 */

import type { CriterionResult, TaskVerdict, TaskVerificationResult, Defect, RetryScope } from '../domain/VerificationTypes';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';

export class VerificationDecisionPolicy {

  /**
   * 종합 판정을 내리고 VerificationResult 객체를 생성합니다.
   */
  public evaluate(
    input: VerificationInput,
    results: CriterionResult[],
    jobId: string
  ): TaskVerificationResult {

    let finalVerdict: TaskVerdict = 'PASS';
    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const warnings: string[] = [];
    const repairHints: string[] = [];
    const defects: Defect[] = [];

    let hasSemanticUncertain = false;    
    let hasRequiredSemanticNA = false;   
    let hasUnverifiable = false;         
    let hasError = false;

    // Collect all defects
    for (const r of results) {
      if (r.defect) {
        defects.push(r.defect);
      }
      
      if (r.verdict === 'PASS') {
        passedCriteria.push(r.criterionId);
      } else if (r.verdict === 'FAIL') {
        failedCriteria.push(r.criterionId);
        if (r.repairHint) {
          repairHints.push(`[${r.criterionId}] ${r.repairHint}`);
        }
      } else if (r.verdict === 'ERROR') {
        failedCriteria.push(r.criterionId);
        warnings.push(`Error in verifier ${r.verifierType}: ${r.reason}`);
        hasError = true;
      } else if (r.verdict === 'UNCERTAIN') {
        hasSemanticUncertain = true;
        warnings.push(`[UNCERTAIN] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
      } else if (r.verdict === 'NOT_APPLICABLE') {
        const hasExplicitCriteria =
          input.taskDefinition.acceptanceCriteria &&
          input.taskDefinition.acceptanceCriteria.length > 0;

        if (r.verifierType === 'SEMANTIC_VERIFIER' && hasExplicitCriteria) {
          hasRequiredSemanticNA = true;
          warnings.push(
            `[BLOCKED] Required Semantic Criterion ${r.criterionId} is NOT_APPLICABLE.`
          );
        } else {
          warnings.push(`[NOT_APPLICABLE] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
        }
      } else if (r.verdict === 'UNVERIFIABLE') {
        hasUnverifiable = true;
        warnings.push(`[UNVERIFIABLE] Criterion ${r.criterionId}: ${r.reason}`);
      }
    }

    // Determine highest required defect
    const requiredDefects = defects.filter(d => d.required);
    const optionalDefects = defects.filter(d => !d.required);
    
    // Determine overall retryScope
    let aggregateRetryScope: RetryScope = 'FIELD';
    const scopePriority: Record<RetryScope, number> = {
      'FIELD': 1,
      'SECTION': 2,
      'FUNCTION': 3,
      'TEST': 4,
      'TOOL_CALL': 5,
      'FILE': 6,
      'ARTIFACT': 7,
      'FULL_TASK': 8
    };

    for (const d of requiredDefects) {
      if (d.retryScope && scopePriority[d.retryScope] > scopePriority[aggregateRetryScope]) {
        aggregateRetryScope = d.retryScope;
      }
    }

    // ─── 판정 트리 ───────────────────────────────────

    if (hasError) {
      finalVerdict = 'FAIL';
    } else if (hasRequiredSemanticNA) {
      finalVerdict = 'BLOCKED';
    } else if (hasUnverifiable) {
      finalVerdict = 'NEEDS_USER';
    } else if (hasSemanticUncertain) {
      // We set UNCERTAIN instead of PASS.
      // But we must return a valid TaskVerdict.
      // We will map UNCERTAIN to RETRY so it can retry Semantic Critic if budget allows.
      finalVerdict = 'RETRY'; 
    } else if (requiredDefects.length > 0) {
      // Check if all required defects are retryable
      const allRetryable = requiredDefects.every(d => d.retryable);
      finalVerdict = allRetryable ? 'NEEDS_REPAIR' : 'FAIL';
    } else if (optionalDefects.length > 0) {
      // PASS with warnings
      finalVerdict = 'PASS';
      warnings.push(`Optional defects present: ${optionalDefects.length}`);
    } else {
      finalVerdict = 'PASS';
    }

    // ─── VerificationResult 조립 ───────────────────────────────────────────
    return {
      verificationId: crypto.randomUUID(),
      verificationJobId: jobId,
      missionId: input.missionId,
      planId: input.planId,
      planVersion: input.planVersion,
      taskId: input.taskId,
      attemptId: input.attemptId,
      executionId: input.targetAttempt.executionId || '',
      resultId: input.targetAttempt.resultReference?.attemptId || '',

      verdict: finalVerdict,
      criterionResults: results,
      passedCriteria,
      failedCriteria,
      warnings,
      defects,
      retryScope: aggregateRetryScope,
      repairInstructions: requiredDefects.map(d => d.repairInstruction || d.message).join('\n'),

      verifierTypes: [...new Set(results.map(r => r.verifierType))],
      verifierVersions: [],
      createdAt: Date.now(),
      idempotencyKey: `verif-${input.taskId}-${input.attemptId}`,
      evaluatedAt: Date.now()
    };
  }
}
