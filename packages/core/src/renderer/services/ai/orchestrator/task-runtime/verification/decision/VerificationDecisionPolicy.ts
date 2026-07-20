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
    } else {
      finalVerdict = 'PASS';
    }

    /*
     * [P0-2 STRICT CONTRACT — OutputMode-Specific Completion Gate]
     * finalVerdict가 'PASS' 후보라 하더라도, 각 OutputMode 계약에 부합하는 실제 검증 산출물이 없으면
     * 절대 최종 PASS로 승인하지 않으며 'FAIL'로 거부한다.
     */
    if (finalVerdict === 'PASS') {
      const outputMode = input.taskDefinition?.outputMode || 'NO_PERSISTED_OUTPUT';
      
      // input.verifiedOutputs가 없으면 PASS 판정을 받은 criterionResults의 evidence에서 verifiedOutput 수집
      const verifiedOutputs: any[] = (input as any).verifiedOutputs || [];
      if (verifiedOutputs.length === 0) {
        for (const r of results) {
          if (r.verdict === 'PASS' && r.evidenceReferences) {
            for (const ref of r.evidenceReferences) {
              if (ref.startsWith('verified_output:')) {
                verifiedOutputs.push({ path: ref.replace('verified_output:', '') });
              }
            }
          }
        }
      }

      // 또는 targetAttempt resultReference outputs에서 verified output / file output 추적
      const outputs = input.targetAttempt?.resultReference?.outputs || [];
      const hasFileInOutputs = outputs.some((o: any) => (o.type === 'file' || o.path) && o.status !== 'REJECTED');
      
      // DeterministicVerifier가 모든 criterion에서 PASS를 리턴했다면 검증된 파일이 존재하는 것임
      const allDeterministicPassed = results.length > 0 && results.every(r => r.verdict === 'PASS');
      const effectiveVerifiedOutputsCount = verifiedOutputs.length > 0 ? verifiedOutputs.length : (allDeterministicPassed && hasFileInOutputs ? 1 : 0);

      const hasTextResult = outputs.length === 0 || outputs.some((o: any) => o.type === 'text' ? (o.content && o.content.trim().length > 0) : true);
      const hasValidatedArtifact = outputs.some((o: any) => (o.type === 'artifact' || o.artifactId) && o.status !== 'REJECTED');

      if (outputMode === 'FILE_OUTPUT_REQUIRED') {
        if (effectiveVerifiedOutputsCount === 0) {
          finalVerdict = 'FAIL';
          failedCriteria.push('FILE_OUTPUT_VERIFICATION');
          defects.push({
            defectId: `def-${crypto.randomUUID()}`,
            signature: `VERIFICATION:FILE_OUTPUT_REQUIRED:NO_VERIFIED_OUTPUT`,
            stage: 'DETERMINISTIC',
            type: 'OUTPUT_FILE_NOT_FOUND',
            severity: 'CRITICAL',
            required: true,
            message: 'FILE_OUTPUT_REQUIRED task finished without any verified filesystem output.',
            retryable: true,
            retryScope: 'FILE'
          });
          warnings.push('[OUTPUT_MODE_BLOCK] FILE_OUTPUT_REQUIRED failed: No VerifiedOutput generated.');
        }
      } else if (outputMode === 'ARTIFACT_OUTPUT_REQUIRED') {
        if (!hasValidatedArtifact) {
          finalVerdict = 'FAIL';
          failedCriteria.push('ARTIFACT_OUTPUT_VERIFICATION');
          defects.push({
            defectId: `def-${crypto.randomUUID()}`,
            signature: `VERIFICATION:ARTIFACT_OUTPUT_REQUIRED:MISSING`,
            stage: 'DETERMINISTIC',
            type: 'ARTIFACT_MISSING',
            severity: 'CRITICAL',
            required: true,
            message: 'ARTIFACT_OUTPUT_REQUIRED task finished without validated artifact.',
            retryable: true,
            retryScope: 'ARTIFACT'
          });
          warnings.push('[OUTPUT_MODE_BLOCK] ARTIFACT_OUTPUT_REQUIRED failed: No validated artifact found.');
        }
      } else if (outputMode === 'NO_PERSISTED_OUTPUT') {
        if (!hasTextResult) {
          finalVerdict = 'FAIL';
          failedCriteria.push('TEXT_OUTPUT_VERIFICATION');
          defects.push({
            defectId: `def-${crypto.randomUUID()}`,
            signature: `VERIFICATION:NO_PERSISTED_OUTPUT:EMPTY_TEXT`,
            stage: 'DETERMINISTIC',
            type: 'INSUFFICIENT_EVIDENCE',
            severity: 'HIGH',
            required: true,
            message: 'NO_PERSISTED_OUTPUT task produced no text or analysis answer.',
            retryable: true,
            retryScope: 'FIELD'
          });
          warnings.push('[OUTPUT_MODE_BLOCK] NO_PERSISTED_OUTPUT failed: Text answer is empty.');
        }
      } else if (outputMode === 'EITHER_FILE_OR_ARTIFACT') {
        if (effectiveVerifiedOutputsCount === 0 && !hasValidatedArtifact) {
          finalVerdict = 'FAIL';
          failedCriteria.push('EITHER_OUTPUT_VERIFICATION');
          defects.push({
            defectId: `def-${crypto.randomUUID()}`,
            signature: `VERIFICATION:EITHER_FILE_OR_ARTIFACT:MISSING`,
            stage: 'DETERMINISTIC',
            type: 'INSUFFICIENT_EVIDENCE',
            severity: 'CRITICAL',
            required: true,
            message: 'EITHER_FILE_OR_ARTIFACT task finished without verified output or validated artifact.',
            retryable: true,
            retryScope: 'FILE'
          });
          warnings.push('[OUTPUT_MODE_BLOCK] EITHER_FILE_OR_ARTIFACT failed: Neither verified output nor validated artifact exists.');
        }
      }
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
