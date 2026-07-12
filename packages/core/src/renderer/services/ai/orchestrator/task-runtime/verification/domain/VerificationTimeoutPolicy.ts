/**
 * @file orchestrator/task-runtime/verification/domain/VerificationTimeoutPolicy.ts
 * @system AMEVA OS Desktop Workstation
 * @role SemanticVerifier LLM 호출 타임아웃 정책 중앙 상수
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - SemanticVerifier: LLM 호출 시 타임아웃 적용
 *
 * [Critical 0-D Fix — 고정 5초 Timeout 분리]
 * 이전 SemanticVerifier.ts는 5000ms를 내부에 하드코딩했다.
 * 로컬 Qwen 7B / Llama.cpp 환경에서:
 * - Cold start (첫 번째 요청): 최대 60초
 * - Warm context: 10~30초
 * - GPU 부족 환경: 무한 대기 가능
 *
 * 이 상수 파일을 수정하면 모든 Semantic 검증에 반영된다.
 *
 * [AGENTS.md 3단계 상수화: Feature/도메인 종속 지역 상수]
 */

/**
 * SemanticVerifier LLM 호출 타임아웃 정책.
 *
 * [예상 값 흐름]
 * - connectionTimeoutMs: LLM Adapter isReady() 확인 후 실제 HTTP 연결 확립까지 대기
 * - firstTokenTimeoutMs: generateStream() 호출 후 첫 토큰 수신까지 최대 대기
 *   - Llama.cpp cold start: 최대 60초 필요
 *   - WebLLM warm: 1~3초
 * - idleChunkTimeoutMs: 스트리밍 중 연속 무응답 허용 최대 시간
 * - totalVerificationTimeoutMs: 단일 Criterion 전체 검증 최대 시간
 */
export const VERIFICATION_TIMEOUT_POLICY = {
  /**
   * LLM 연결 확립 타임아웃 (ms)
   * LLM Adapter가 isReady()를 반환했으나 실제 연결이 안 될 때 사용.
   */
  connectionTimeoutMs: 5_000,

  /**
   * 첫 토큰 수신 타임아웃 (ms)
   * generateStream() 호출 후 이 시간 내 첫 토큰이 없으면 UNCERTAIN 처리.
   * Llama.cpp / Qwen 7B cold start를 위해 60초로 설정.
   */
  firstTokenTimeoutMs: 60_000,

  /**
   * 스트리밍 중 유휴 청크 타임아웃 (ms)
   * 첫 토큰 이후 이 시간 동안 새 토큰이 없으면 UNCERTAIN 처리.
   */
  idleChunkTimeoutMs: 30_000,

  /**
   * 단일 Criterion 전체 검증 총 타임아웃 (ms)
   * 첫 토큰 수신 이후에도 적용되며, 이 시간 초과 시 UNCERTAIN 처리.
   * 매우 긴 Context 처리를 위해 120초로 설정.
   */
  totalVerificationTimeoutMs: 120_000,
} as const;

export type VerificationTimeoutPolicy = typeof VERIFICATION_TIMEOUT_POLICY;
