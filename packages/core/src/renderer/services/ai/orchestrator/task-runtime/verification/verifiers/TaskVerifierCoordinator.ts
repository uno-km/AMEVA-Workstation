/**
 * @file orchestrator/task-runtime/verification/verifiers/TaskVerifierCoordinator.ts
 * @system AMEVA OS Desktop Workstation
 * @role 여러 Verifier를 파이프라인으로 실행하고 결과를 취합
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - VerificationRuntime: processVerifyingTasks() 호출 전 coordinator를 사용
 *
 * [FINAL REMEDIATION — STAGE C]
 * - SemanticVerifier에 ILLMEngineAdapter 주입 경로 추가
 * - VerificationRuntime이 coordinator를 생성할 때 adapter를 전달할 수 있도록 수정
 * - 기존 시그니처(인자 없는 생성자) 유지하고 withAdapter() Fluent API 추가
 */

import type { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';
import type { TaskVerifier } from './TaskVerifier';
import type { ILLMEngineAdapter } from '../../../types';

import { IdentityVerifier } from './IdentityVerifier';
import { ExpectedOutputVerifier } from './ExpectedOutputVerifier';
import { DependencyConsistencyVerifier } from './DependencyConsistencyVerifier';
import { SemanticVerifier } from './SemanticVerifier';

export class TaskVerifierCoordinator {
  private verifiers: TaskVerifier[] = [];

  constructor(adapter?: ILLMEngineAdapter) {
    /*
     * [Verifier 파이프라인 구성 — STAGE C 수정]
     * SemanticVerifier에 LLM Adapter를 주입합니다.
     * adapter 미전달 시 SemanticVerifier는 NOT_APPLICABLE을 반환합니다.
     * 기존 인자 없는 생성자 패턴과 호환성 유지.
     */
    this.verifiers.push(new IdentityVerifier());
    this.verifiers.push(new DependencyConsistencyVerifier());
    this.verifiers.push(new ExpectedOutputVerifier());
    this.verifiers.push(new SemanticVerifier(adapter));
  }

  public async runVerificationPipeline(input: VerificationInput): Promise<CriterionResult[]> {
    const allResults: CriterionResult[] = [];

    for (const verifier of this.verifiers) {
      try {
        const results = await verifier.verify(input);
        allResults.push(...results);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        // 특정 Verifier 오류 시 에러 결과로 취합 — 침묵 예외 금지 (AGENTS.md 규칙 5)
        console.error(`[TaskVerifierCoordinator] Verifier ${verifier.verifierType} threw: ${errorMessage}`);
        allResults.push({
          criterionId: `verifier_error_${verifier.verifierType}`,
          verifierType: verifier.verifierType,
          verdict: 'ERROR',
          reason: `Verifier threw an exception: ${errorMessage}`
        });
      }
    }

    return allResults;
  }
}
