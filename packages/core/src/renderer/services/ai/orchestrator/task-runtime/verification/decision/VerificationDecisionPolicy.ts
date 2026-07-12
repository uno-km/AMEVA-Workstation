/**
 * @file orchestrator/task-runtime/verification/decision/VerificationDecisionPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role 다수의 CriterionResult를 종합하여 최종 TaskVerdict 판정 도출
 */

import { CriterionResult, TaskVerdict, TaskVerificationResult } from '../domain/VerificationTypes';
import { VerificationInput } from '../runtime/VerificationInputBuilder';

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
    
    // Priority 분류
    let hasPriority1Fail = false; // Identity, State, Version
    let hasPriority2Fail = false; // Expected Output, Structure
    let hasPriority3Fail = false; // Requirement, Evidence
    let hasPriority4Fail = false; // Semantic
    
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
          hasPriority2Fail = true; // Default fallback for unknown
        }
      } else {
        warnings.push(`Criterion ${r.criterionId} evaluated to ${r.verdict}: ${r.reason}`);
      }
    }

    // 2. 판정 트리 (Priority 기반 Veto)
    if (hasPriority1Fail) {
      // P1: 심각한 불일치. 재시도가 아닌 차단이나 리싱크 권장. 여기서는 FAIL (Recovery에서 핸들링)
      finalVerdict = 'FAIL';
    } else if (hasPriority2Fail) {
      // P2: 구조적 필수 사항 누락. Repair 시도 우선.
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'RETRY';
    } else if (hasPriority3Fail) {
      // P3: 도메인 요구사항. Repair나 사용자 개입.
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'NEEDS_USER';
    } else if (hasPriority4Fail) {
      // P4: 시맨틱 품질 하락
      finalVerdict = failIsRepairable ? 'NEEDS_REPAIR' : 'RETRY';
    } else {
      // 모든 필수 조건 만족 (FAIL 없음)
      finalVerdict = 'PASS';
    }

    // 3. VerificationResult 조립
    return {
      verificationId: crypto.randomUUID(),
      verificationJobId: jobId,
      missionId: input.missionId,
      planId: input.planId,
      planVersion: input.planVersion,
      taskId: input.taskId,
      attemptId: input.attemptId,
      executionId: input.targetAttempt.executionId || '',
      resultId: input.targetAttempt.resultReference?.attemptId || '', // result는 보통 attemptId를 공유함
      
      verdict: finalVerdict,
      criterionResults: results,
      passedCriteria,
      failedCriteria,
      warnings,
      repairInstructions: repairHints.length > 0 ? repairHints.join('\n') : undefined,
      
      verifierTypes: [...new Set(results.map(r => r.verifierType))],
      verifierVersions: [], // 상세 버전 기록 생략
      createdAt: Date.now(),
      idempotencyKey: `verif-${input.taskId}-${input.attemptId}`
    };
  }
}
