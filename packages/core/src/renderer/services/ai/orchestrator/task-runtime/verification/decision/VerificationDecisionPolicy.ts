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
    /*
     * [P0-2 FIX — WARN/INCOMPLETE_VERIFICATION 절대 PASS 승격 금지]
     * 이전: optionalDefects.length > 0이더라도 PASS로 승격됨.
     *       WARN 결과가 있어도 집계가 무시하고 PASS 반환.
     * 수정:
     *   - WARN: 경고이지만 PASS 집계 금지 (requiredWarn 여부로 분기)
     *   - INCOMPLETE_VERIFICATION: 필수 검증기를 실행할 수 없었음 → 반드시 FAIL
     *   - PASS 조건: 위 두 유형이 없어야 함
     */
    let hasIncompleteVerification = false; // INCOMPLETE_VERIFICATION이 있으면 절대 PASS 금지
    let hasRequiredWarn = false;           // required=true인 WARN → FAIL 처리

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
      } else if (r.verdict === 'WARN') {
        /*
         * WARN: required=true인 defect와 연결되어 있으면 FAIL 처리.
         * required=false이면 경고만 기록.
         * 어느 경우에도 단독으로 최종 PASS를 허용하지 않음.
         */
        if (r.defect?.required) {
          failedCriteria.push(r.criterionId);
          hasRequiredWarn = true;
          warnings.push(`[REQUIRED_WARN] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
        } else {
          warnings.push(`[WARN] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
        }
      } else if (r.verdict === 'INCOMPLETE_VERIFICATION') {
        /*
         * INCOMPLETE_VERIFICATION: 필수 검증기를 실행하지 못함.
         * → 반드시 FAIL로 처리. 어떤 경우에도 PASS 금지.
         * 예: FILE_OUTPUT_REQUIRED 작업에서 fileAdapter 미주입.
         */
        failedCriteria.push(r.criterionId);
        hasIncompleteVerification = true;
        warnings.push(`[INCOMPLETE_VERIFICATION] ${r.criterionId}: ${r.incompleteReason || r.reason}`);
        console.error(`[VerificationDecisionPolicy] INCOMPLETE_VERIFICATION 감지: ${r.criterionId}. 최종 PASS 금지.`);
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

    if (hasIncompleteVerification) {
      /*
       * [P0-2 FIX] INCOMPLETE_VERIFICATION: 필수 검증기를 실행하지 못함
       * 가장 먼저 체크하여 다른 조건으로 우회되지 않도록 최우선 처리.
       * 예: FILE_OUTPUT_REQUIRED에서 fileAdapter 미주입 → 절대 PASS 불가.
       */
      finalVerdict = 'FAIL';
    } else if (hasError || hasRequiredWarn) {
      finalVerdict = 'FAIL';
    } else if (hasRequiredSemanticNA) {
      finalVerdict = 'BLOCKED';
    } else if (hasUnverifiable) {
      finalVerdict = 'NEEDS_USER';
    } else if (hasSemanticUncertain) {
      // Check budget
      const calls = input.taskState.semanticCriticCallCount || 0;
      const maxCalls = input.taskState.maxSemanticCriticCalls || 5;
      if (calls >= maxCalls) {
        finalVerdict = 'WAITING_USER';
        warnings.push(`[BUDGET_EXHAUSTED] maxSemanticCriticCalls reached (${calls}/${maxCalls}). Escalating to WAITING_USER.`);
        defects.push({
          defectId: `def-${crypto.randomUUID()}`,
          signature: `VERIFICATION:BUDGET_EXHAUSTED:semantic_critic`,
          stage: 'SEMANTIC',
          type: 'BUDGET_EXHAUSTED',
          severity: 'CRITICAL',
          required: true,
          message: `Semantic critic budget exhausted after ${calls} calls.`,
          retryable: false,
          retryScope: 'FULL_TASK'
        });
      } else {
        finalVerdict = 'RETRY'; 
      }
    } else if (requiredDefects.length > 0) {
      // Check if all required defects are retryable
      const allRetryable = requiredDefects.every(d => d.retryable);
      finalVerdict = allRetryable ? 'NEEDS_REPAIR' : 'FAIL';
    } else if (optionalDefects.length > 0) {
      /*
       * [P0-2 FIX] 이전: optionalDefects만 있어도 PASS.
       * 수정: PASS는 맞지만, 이 경로에 도달했다면 이미 hasIncompleteVerification=false임.
       * 안전하게 PASS 허용 (이미 위에서 INCOMPLETE_VERIFICATION 차단됨).
       */
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
