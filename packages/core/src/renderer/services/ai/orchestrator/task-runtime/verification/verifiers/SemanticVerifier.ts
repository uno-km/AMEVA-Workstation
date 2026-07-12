/**
 * @file orchestrator/task-runtime/verification/verifiers/SemanticVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role LLM을 사용하거나 고급 휴리스틱을 통해 Task Acceptance Criteria가 논리적으로 충족되었는지 검사
 */

import { TaskVerifier } from './TaskVerifier';
import { VerificationInput } from '../runtime/VerificationInputBuilder';
import { CriterionResult } from '../domain/VerificationTypes';

export class SemanticVerifier implements TaskVerifier {
  public readonly verifierType = 'SEMANTIC_VERIFIER';
  public readonly verifierVersion = '1.0.0';

  public async verify(input: VerificationInput): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    const criteria = input.taskDefinition.acceptanceCriteria || [];

    if (criteria.length === 0) {
      results.push({
        criterionId: 'semantic_acceptance',
        verifierType: this.verifierType,
        verdict: 'NOT_APPLICABLE',
        reason: 'No acceptance criteria defined for semantic verification.',
      });
      return results;
    }

    // [TODO: LLM Provider 연동]
    // 현재는 Tool Runtime이 Disabled 상태이고 실제 LLM 호출 모듈이 미연결(DISABLED_SAFELY) 상태임.
    // 기존의 무조건 PASS 처리(거짓 성공)는 Mission 무결성을 심각하게 훼손하므로 제거합니다.
    for (const criterion of criteria) {
      results.push({
        criterionId: `semantic_criterion_${crypto.randomUUID()}`,
        verifierType: this.verifierType,
        verdict: 'FAIL',
        reason: `Semantic verification for "${criterion}" is currently DISABLED_SAFELY.`,
        repairHint: 'Manual semantic validation required. Needs user review.',
        confidence: 0.0
      });
    }

    return results;
  }
}
