/**
 * @file orchestrator/task-runtime/verification/verifiers/IdentityVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 검증 대상 Task가 올바른 엔티티인지 확인 (Identity & Freshness)
 */

import { TaskVerifier } from './TaskVerifier';
import { VerificationInput } from '../runtime/VerificationInputBuilder';
import { CriterionResult } from '../domain/VerificationTypes';

export class IdentityVerifier implements TaskVerifier {
  public readonly verifierType = 'IDENTITY_VERIFIER';
  public readonly verifierVersion = '1.0.0';

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];

    // 1. 상태가 VERIFYING인지 확인
    if (input.taskState.status !== 'VERIFYING') {
      results.push({
        criterionId: 'state_is_verifying',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Task is not in VERIFYING state. Current: ${input.taskState.status}`,
      });
    } else {
      results.push({
        criterionId: 'state_is_verifying',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'Task is in VERIFYING state.',
      });
    }

    // 2. Result 존재 여부 확인
    if (!input.targetAttempt.resultReference) {
      results.push({
        criterionId: 'result_exists',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: 'No resultReference found in target attempt.',
      });
    } else {
      results.push({
        criterionId: 'result_exists',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'Result exists in target attempt.',
      });
    }

    // 3. AttemptID 불일치 방지
    if (input.targetAttempt.attemptId !== input.attemptId) {
      results.push({
        criterionId: 'attempt_id_match',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Target attempt ID ${input.targetAttempt.attemptId} does not match requested ${input.attemptId}.`,
      });
    } else {
      results.push({
        criterionId: 'attempt_id_match',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'Attempt ID matches.',
      });
    }

    return results;
  }
}
