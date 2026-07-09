/**
 * @file cleanAIResponse.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/cleanAIResponse.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * cleanAIResponse.ts
 *
 * AI 모델 응답 후처리 정제 유틸리티.
 * 모델 출력에 포함될 수 있는 노이즈 패턴들을 제거하고 사용자에게 보여줄 깔끔한 텍스트를 반환한다.
 * 이 유틸리티는 순수 함수로만 구성되며 외부 의존성이 없다.
 */

/**
 * cleanModeEcho
 * 소형 모델이 [WRITE], [EDIT], [CHAT], [SUMMARY] 등 모드 에코를 응답 앞에 붙이는 현상을 제거한다.
 *
 * @param content - 정제 대상 텍스트
 * @returns 정제된 텍스트
 */
export function cleanModeEcho(content: string): string {
  return content
    .replace(/^\[(WRITE|EDIT|CHAT|SUMMARY)\]\s*/i, '')
    .replace(/^현재 작업 모드:.*\n?/m, '')
    .replace(/^지금 요청은.*\n?/m, '')
    .trim()
}

/**
 * cleanInsertSuggestionTail
 * INSERT_SUGGESTION 태그 이후의 잔여 텍스트를 제거한다.
 * 태그가 없으면 원본을 그대로 반환한다.
 *
 * @param content - 정제 대상 텍스트
 * @returns 정제된 텍스트
 */
export function cleanInsertSuggestionTail(content: string): string {
  return content
    .replace(/\[INSERT_SUGGESTION:[^\]]*\]?(?:\r?\n)?[\s\S]*/i, '')
    .trim()
}

/**
 * cleanEditSuggestionBlock
 * EDIT_SUGGESTION 태그와 그 이후의 텍스트를 제거한다.
 * 태그가 없으면 원본을 그대로 반환한다.
 *
 * @param content - 정제 대상 텍스트
 * @returns 정제된 텍스트
 */
export function cleanEditSuggestionBlock(content: string): string {
  return content
    .replace(/\[EDIT_SUGGESTION:\s*[a-zA-Z0-9_\-]+\](?:\r?\n)?[\s\S]*/i, '')
    .trim()
}

/**
 * buildAbortErrorContent
 * 사용자 중단(Abort) 에러 시 보여줄 최종 콘텐츠를 결정한다.
 * sanitizer의 finalContent가 있으면 그것을 사용하고, 없으면 현재 메시지 내용을 폴백한다.
 *
 * @param sanitizedFinalContent - sanitizer.finalize().finalContent
 * @param currentContent - 현재 메시지 content
 * @returns 표시할 최종 텍스트
 */
export function buildAbortErrorContent(
  sanitizedFinalContent: string,
  currentContent: string
): string {
  return sanitizedFinalContent.trim() || currentContent || '사용자가 답변을 중단했습니다'
}

/**
 * isAbortError
 * LLM Done 이벤트의 에러가 사용자 중단(Abort)에 의한 것인지 판별한다.
 *
 * @param errorMessage - data.error 문자열
 * @returns true if error is caused by user abort
 */
export function isAbortError(errorMessage?: string): boolean {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!errorMessage`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!errorMessage)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!errorMessage) return false
  return (
    errorMessage === '사용자에 의해 중단됨' ||
    errorMessage === 'Aborted' ||
    errorMessage.includes('중단')
  )
}

