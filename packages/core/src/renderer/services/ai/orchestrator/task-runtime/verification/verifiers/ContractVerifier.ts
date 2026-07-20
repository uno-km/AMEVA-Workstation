/**
 * @file orchestrator/task-runtime/verification/verifiers/ContractVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 기대되는 출력물(Expected Outputs)의 스키마와 포맷, 그리고 Task Acceptance Criteria의 형식 검증
 */

import type { TaskVerifier } from './TaskVerifier';
import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';

export class ContractVerifier implements TaskVerifier {
  public readonly verifierType = 'CONTRACT_VERIFIER';
  public readonly verifierVersion = '2.0.0';

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    const expectedFileOutputs = input.taskDefinition.expectedFileOutputs || [];

    if (expectedFileOutputs.length === 0) {
      results.push({
        criterionId: 'contract_outputs_present',
        verifierType: this.verifierType,
        verdict: 'NOT_APPLICABLE',
        reason: 'No expected outputs defined.'
      });
      return results;
    }

    const actualOutputs = input.targetAttempt.resultReference?.outputs || [];
    
    if (actualOutputs.length === 0) {
      results.push({
        criterionId: 'contract_outputs_present',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Task expected ${expectedFileOutputs.length} outputs, but provided none.`,
        defect: {
          defectId: `def-${crypto.randomUUID()}`,
          signature: `CONTRACT:CONTRACT_MISSING:outputs:missing`,
          stage: 'CONTRACT',
          type: 'CONTRACT_MISSING',
          severity: 'HIGH',
          required: true,
          message: `Expected ${expectedFileOutputs.length} outputs, got none.`,
          retryable: true,
          retryScope: 'FULL_TASK'
        }
      });
      return results;
    }

    // Check count and structural constraints
    if (actualOutputs.length < expectedFileOutputs.length) {
      results.push({
        criterionId: 'contract_output_count',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Expected at least ${expectedFileOutputs.length} outputs, but got ${actualOutputs.length}.`,
        defect: {
          defectId: `def-${crypto.randomUUID()}`,
          signature: `CONTRACT:CONTRACT_MISSING:output_count:mismatch`,
          stage: 'CONTRACT',
          type: 'CONTRACT_MISSING',
          severity: 'HIGH',
          required: true,
          message: `Expected ${expectedFileOutputs.length} outputs, got ${actualOutputs.length}.`,
          retryable: true,
          retryScope: 'FULL_TASK'
        }
      });
      return results;
    }

    // 뼈대 검증 (Skeleton/Format)
    let invalidCount = 0;
    const fileOutputs = actualOutputs.filter(o => o.type === 'file');
    for (const out of fileOutputs) {
      if (!out || (typeof out.content === 'undefined' || out.content === null || out.content === '')) {
        invalidCount++;
        results.push({
          criterionId: `contract_output_validity_${out?.artifactId || 'unknown'}`,
          verifierType: this.verifierType,
          verdict: 'FAIL',
          reason: `Invalid or empty output structure for ${out?.artifactId || 'unknown'}.`,
          defect: {
            defectId: `def-${crypto.randomUUID()}`,
            signature: `CONTRACT:SKELETON_CONTENT:${out?.artifactId || 'unknown'}:invalid`,
            stage: 'CONTRACT',
            type: 'SKELETON_CONTENT',
            severity: 'MEDIUM',
            required: true,
            artifactId: out?.artifactId,
            message: `Output content is empty or invalid structure.`,
            retryable: true,
            retryScope: 'ARTIFACT'
          }
        });
      }
    }

    if (invalidCount === 0) {
      results.push({
        criterionId: 'contract_structure_validity',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'All outputs structurally valid.'
      });
    }

    return results;
  }
}
