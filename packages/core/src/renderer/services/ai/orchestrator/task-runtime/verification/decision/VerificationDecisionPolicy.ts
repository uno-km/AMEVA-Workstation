/**
 * @file orchestrator/task-runtime/verification/decision/VerificationDecisionPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role 다수의 CriterionResult를 종합하여 최종 TaskVerdict 판정 도출
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - VerificationRuntime: processVerifyingTasks() 내에서 호출
 *
 * [Critical 0-C Fix — False PASS 통로 차단]
 * 이전 구현에서 UNCERTAIN, NOT_APPLICABLE, UNVERIFIABLE 판정이 else 블록에서
 * 단순 warning만 추가되고 finalVerdict='PASS'를 유지하는 취약점이 있었다.
 *
 * 수정 내용:
 * - UNCERTAIN → hasSematicUncertain 집계 → NEEDS_USER 또는 RETRY 판정
 * - NOT_APPLICABLE (필수 Semantic Criterion) → BLOCKED 판정 (PASS 절대 금지)
 * - NOT_APPLICABLE (비필수) → WARNING 집계 (기존 Hard Gate 통과 시 SUCCESS_WITH_WARNINGS 가능)
 * - UNVERIFIABLE → NEEDS_USER 판정
 */

import { CriterionResult, TaskVerdict, TaskVerificationResult } from '../domain/VerificationTypes';
import { VerificationInput } from '../runtime/VerificationInputBuilder';

export class VerificationDecisionPolicy {

  /**
   * 종합 판정을 내리고 VerificationResult 객체를 생성합니다.
   *
   * [판정 우선순위]
   * P0: IDENTITY/STATE 실패 → FAIL (즉시 차단)
   * P1: EXPECTED_OUTPUT 구조 실패 → NEEDS_REPAIR 또는 RETRY
   * P2: REQUIREMENT/EVIDENCE 실패 → NEEDS_REPAIR 또는 NEEDS_USER
   * P3: SEMANTIC 실패 → NEEDS_REPAIR 또는 RETRY
   * P4: SEMANTIC NOT_APPLICABLE (필수) → BLOCKED (PASS 절대 금지)
   * P5: SEMANTIC UNCERTAIN → NEEDS_USER (PASS 절대 금지)
   * All Pass → PASS
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

    // [Critical 0-C Fix] Priority 분류
    let hasPriority1Fail = false; // Identity, State, Version
    let hasPriority2Fail = false; // Expected Output, Structure
    let hasPriority3Fail = false; // Requirement, Evidence
    let hasPriority4Fail = false; // Semantic FAIL

    /*
     * [Critical 0-C Fix] UNCERTAIN/NOT_APPLICABLE 집계 분리
     * 이전에는 else 블록에서 단순 warning만 추가되어 PASS로 집계되었음.
     * 이제 별도 플래그로 관리하고 Hard Gate에서 판정에 영향을 준다.
     */
    let hasSemanticUncertain = false;    // UNCERTAIN: 재검증 필요, PASS 금지
    let hasRequiredSemanticNA = false;   // NOT_APPLICABLE (필수 Semantic): BLOCKED, PASS 금지
    let hasUnverifiable = false;         // UNVERIFIABLE: 검증 자체 불가, NEEDS_USER

    let failIsRepairable = true;

    for (const r of results) {
      if (r.verdict === 'PASS') {
        passedCriteria.push(r.criterionId);
      } else if (r.verdict === 'FAIL' || r.verdict === 'ERROR') {
        failedCriteria.push(r.criterionId);

        if (r.verdict === 'ERROR') {
          warnings.push(`Error in verifier ${r.verifierType}: ${r.reason}`);
        }

        if (r.repairHint) {
          repairHints.push(`[${r.criterionId}] ${r.repairHint}`);
        } else {
          failIsRepairable = false;
        }

        // Priority 맵핑 (VerifierType 기반)
        if (r.verifierType === 'IDENTITY_VERIFIER' || r.verifierType === 'STATE_VERIFIER') {
          hasPriority1Fail = true;
        } else if (r.verifierType === 'EXPECTED_OUTPUT_VERIFIER') {
          hasPriority2Fail = true;
        } else if (r.verifierType === 'REQUIREMENT_VERIFIER' || r.verifierType === 'EVIDENCE_VERIFIER') {
          hasPriority3Fail = true;
        } else if (r.verifierType === 'SEMANTIC_VERIFIER') {
          hasPriority4Fail = true;
        } else {
          hasPriority2Fail = true; // 알 수 없는 Verifier → P2로 보수적 취급
        }
      } else if (r.verdict === 'UNCERTAIN') {
        /*
         * [Critical 0-C Fix] UNCERTAIN → 재검증 필요 플래그
         * Semantic Verifier가 LLM 판정을 내리지 못한 경우.
         * PASS로 집계하는 것은 절대 금지.
         */
        hasSemanticUncertain = true;
        warnings.push(`[UNCERTAIN] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
        if (r.repairHint) repairHints.push(`[${r.criterionId}] ${r.repairHint}`);
      } else if (r.verdict === 'NOT_APPLICABLE') {
        /*
         * [Critical 0-C Fix] NOT_APPLICABLE 처리
         * Semantic Verifier에서 LLM 미연결 시 반환됨.
         * - 필수 Criterion (acceptanceCriteria가 있는 Task): BLOCKED 판정 필요
         * - 선택 Criterion (acceptanceCriteria 없는 Task의 기본 Semantic): WARNING만
         *
         * 현재 VerificationInput에서 required 여부를 판단하기 위해 acceptanceCriteria 존재 여부 사용.
         */
        const hasExplicitCriteria =
          input.taskDefinition.acceptanceCriteria &&
          input.taskDefinition.acceptanceCriteria.length > 0;

        if (r.verifierType === 'SEMANTIC_VERIFIER' && hasExplicitCriteria) {
          // 명시적 Semantic Criterion이 있는데 검증 불가 → BLOCKED
          hasRequiredSemanticNA = true;
          warnings.push(
            `[BLOCKED] Required Semantic Criterion ${r.criterionId} is NOT_APPLICABLE. ` +
            `LLM adapter not connected. Cannot verify without semantic check.`
          );
        } else {
          // 선택적 검증 → WARNING만
          warnings.push(`[NOT_APPLICABLE] Criterion ${r.criterionId} (${r.verifierType}): ${r.reason}`);
        }
      } else if (r.verdict === 'UNVERIFIABLE') {
        hasUnverifiable = true;
        warnings.push(`[UNVERIFIABLE] Criterion ${r.criterionId}: ${r.reason}`);
      } else {
        // 알 수 없는 판정 → 보수적으로 경고 처리
        warnings.push(`[UNKNOWN] Criterion ${r.criterionId} evaluated to ${r.verdict}: ${r.reason}`);
      }
    }

    // ─── 판정 트리 (Priority 기반 Veto) ───────────────────────────────────

    if (hasPriority1Fail) {
      // P0: 심각한 Identity/State 불일치. 차단.
      finalVerdict = 'FAIL';
    } else if (hasRequiredSemanticNA) {
      /*
       * [Critical 0-C Fix] 필수 Semantic Criterion이 NOT_APPLICABLE
       * LLM 미연결 상태에서 명시적 Acceptance Criteria를 검증 불가.
       * PASS 절대 금지. BLOCKED 판정으로 User 개입 요구.
       */
      finalVerdict = 'BLOCKED';
    } else if (hasUnverifiable) {
      /*
       * [Critical 0-C Fix] UNVERIFIABLE
       * 검증 자체가 구조적으로 불가능한 경우.
       * PASS 절대 금지.
       */
      finalVerdict = 'NEEDS_USER';
    } else if (hasSemanticUncertain) {
      /*
       * [Critical 0-C Fix] UNCERTAIN Semantic
       * LLM이 판정을 내리지 못한 경우.
       * PASS 절대 금지. NEEDS_USER로 사용자 개입 요청.
       */
      finalVerdict = 'NEEDS_USER';
    } else if (hasPriority2Fail) {
      // P1: 구조적 필수 사항 누락. Repair 시도 우선.
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'RETRY';
    } else if (hasPriority3Fail) {
      // P2: 도메인 요구사항. Repair나 사용자 개입.
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'NEEDS_USER';
    } else if (hasPriority4Fail) {
      // P3: 시맨틱 품질 하락
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'RETRY';
    } else {
      // 모든 필수 조건 만족 (FAIL 없음, UNCERTAIN 없음, NOT_APPLICABLE 없음)
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
      repairInstructions: repairHints.length > 0 ? repairHints.join('\n') : undefined,

      verifierTypes: [...new Set(results.map(r => r.verifierType))],
      verifierVersions: [],
      createdAt: Date.now(),
      idempotencyKey: `verif-${input.taskId}-${input.attemptId}`
    };
  }
}
