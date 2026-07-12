/**
 * @file orchestrator/task-runtime/verification/verifiers/ExpectedOutputVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 기대되는 출력물(Expected Outputs)이 결과(Result)에 포함되어 있는지 검증
 */

import { TaskVerifier } from './TaskVerifier';
import { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';

export class ExpectedOutputVerifier implements TaskVerifier {
  public readonly verifierType = 'EXPECTED_OUTPUT_VERIFIER';
  public readonly verifierVersion = '1.0.0';

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    const expectedOutputs = input.taskDefinition.expectedOutputs || [];

    if (expectedOutputs.length === 0) {
      results.push({
        criterionId: 'expected_outputs_present',
        verifierType: this.verifierType,
        verdict: 'NOT_APPLICABLE',
        reason: 'No expected outputs defined.',
      });
      return results;
    }

    const actualOutputs = input.targetAttempt.resultReference?.outputs || [];
    // 실제로는 Output의 type이나 content 기반으로 텍스트를 파싱해서 포함되었는지 유추해야 함.
    // 현재는 단순하게 텍스트 컨텐츠에 키워드가 있는지만 검사하거나 배열이 비어있지 않은지만 확인.
    
    if (actualOutputs.length === 0) {
      results.push({
        criterionId: 'expected_outputs_present',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Task expected ${expectedOutputs.length} outputs, but provided none.`,
        repairHint: 'Ensure the task produces the required outputs.'
      });
      return results;
    }

    // 단순 문자열 포함 검사(includes)는 "제공하지 못했습니다" 같은 부정 응답도 PASS시키는 치명적 취약점이 있음.
    // 따라서 여기서는 Output 객체의 존재 여부 및 최소한의 구조만 검증하고, 의미론적 일치 여부는 SemanticVerifier로 위임함.
    
    // 현재는 구조화된 스키마 대조 로직이 생략되어 있으므로, expected 개수 이상인지 확인
    if (actualOutputs.length < expectedOutputs.length) {
      results.push({
        criterionId: 'output_count_match',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Expected at least ${expectedOutputs.length} outputs, but got ${actualOutputs.length}.`,
        repairHint: 'Ensure all expected outputs are structurally provided.'
      });
      return results;
    }

    // 구조적 최소 검증 (모든 Output 항목이 유효한지)
    let invalidCount = 0;
    for (const out of actualOutputs) {
      if (!out || typeof out.content === 'undefined' || out.content === null || out.content === '') {
        invalidCount++;
      }
    }

    if (invalidCount > 0) {
      results.push({
        criterionId: 'output_content_validity',
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Found ${invalidCount} empty or invalid output structures.`,
        repairHint: 'Ensure output content is not empty or null.'
      });
    } else {
      results.push({
        criterionId: 'output_structure_validity',
        verifierType: this.verifierType,
        verdict: 'PASS',
        reason: 'All outputs structurally valid. Semantic validation deferred.'
      });
    }

    return results;
  }
}
