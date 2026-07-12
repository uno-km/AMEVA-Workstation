/**
 * @file orchestrator/task-runtime/verification/verifiers/TaskVerifier.ts
 * @system AMEVA OS Desktop Workstation
 * @role 공통 Verifier 인터페이스
 */

import { VerificationInput } from '../runtime/VerificationInputBuilder';
import type { CriterionResult } from '../domain/VerificationTypes';

export interface TaskVerifier {
  readonly verifierType: string;
  readonly verifierVersion: string;
  
  /**
   * 입력된 데이터를 검증하고 결과 배열을 반환합니다.
   * 비동기 환경(Semantic 검증 등)을 대비해 Promise를 반환합니다.
   */
  verify(input: VerificationInput): Promise<CriterionResult[]>;
}
