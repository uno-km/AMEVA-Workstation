/**
 * @file orchestrator/task-runtime/verification/verifiers/DependencyConsistencyVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 선행 태스크의 결과가 유효한지 검증 (Dependency Recovery 판단의 기초)
 */

import type { TaskVerifier } from './TaskVerifier';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';

export class DependencyConsistencyVerifier implements TaskVerifier {
  public readonly verifierType = 'DEPENDENCY_CONSISTENCY_VERIFIER';
  public readonly verifierVersion = '1.0.0';

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    const dependencies = input.taskDefinition.dependencies || [];

    if (dependencies.length === 0) {
      results.push({
        criterionId: 'dependencies_consistent',
        verifierType: this.verifierType,
        verdict: 'NOT_APPLICABLE',
        reason: 'No dependencies defined.',
      });
      return results;
    }

    for (const depId of dependencies) {
      const depResult = input.dependencyResults.get(depId);
      
      if (!depResult) {
        results.push({
          criterionId: `dependency_present_${depId}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Dependency task ${depId} result is missing or unavailable.`,
        });
      } else {
        // 결과가 있지만 status가 FAILED라면 실패
        if (depResult.status === 'FAILED' || depResult.status === 'CANCELLED') {
          results.push({
            criterionId: `dependency_status_${depId}`,
            verifierType: this.verifierType,
            verdict: 'FAIL',
            reason: `Dependency task ${depId} ended with status ${depResult.status}.`,
          });
        } else {
          results.push({
            criterionId: `dependency_status_${depId}`,
            verifierType: this.verifierType,
            verdict: 'PASS',
            reason: `Dependency ${depId} is resolved.`,
          });
        }
      }
    }

    return results;
  }
}
