/**
 * @file orchestrator/task-runtime/verification/verifiers/TaskVerifierCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 여러 Verifier를 파이프라인으로 실행하고 결과를 취합
 */

import { VerificationInput } from '../runtime/VerificationInputBuilder';
import { CriterionResult } from '../domain/VerificationTypes';
import { TaskVerifier } from './TaskVerifier';

import { IdentityVerifier } from './IdentityVerifier';
import { ExpectedOutputVerifier } from './ExpectedOutputVerifier';
import { DependencyConsistencyVerifier } from './DependencyConsistencyVerifier';
import { SemanticVerifier } from './SemanticVerifier';

export class TaskVerifierCoordinator {
  private verifiers: TaskVerifier[] = [];

  constructor() {
    // 8단계 파이프라인 중 대표적인 4단계 구성
    this.verifiers.push(new IdentityVerifier());
    this.verifiers.push(new DependencyConsistencyVerifier());
    this.verifiers.push(new ExpectedOutputVerifier());
    this.verifiers.push(new SemanticVerifier());
  }

  public async runVerificationPipeline(input: VerificationInput): Promise<CriterionResult[]> {
    const allResults: CriterionResult[] = [];

    // 파이프라인 단계별 실행 (의존성 -> 내용 -> 의미)
    // 앞 단계에서 심각한 FAIL이 나오면 뒤 단계를 안 할 수도 있지만, 
    // 여기서는 모든 Criterion을 수집하는 방향으로 구현
    for (const verifier of this.verifiers) {
      try {
        const results = await verifier.verify(input);
        allResults.push(...results);
      } catch (e: any) {
        // 특정 Verifier 오류 시 에러 결과로 취합
        allResults.push({
          criterionId: `verifier_error_${verifier.verifierType}`,
          verifierType: verifier.verifierType,
          verdict: 'ERROR',
          reason: `Verifier threw an exception: ${e.message}`
        });
      }
    }

    return allResults;
  }
}
