/**
 * determineIntent.ts
 *
 * AI 사용자 요청 의도 분류 유틸리티.
 * 사용자 입력 문장을 분석하여 WRITE / EDIT / SUMMARY / CHAT 중 하나의 의도를 반환한다.
 * UI 라우팅 및 시스템 프롬프트 조립에 사용되며, 실제 LLM 추론과 완전히 독립된 순수 함수다.
 */

/** 의도 분류 결과 타입 */
export type AIIntent = 'WRITE' | 'EDIT' | 'SUMMARY' | 'CHAT'

/**
 * determineIntent
 * 사용자 메시지와 태깅된 블록 목록을 기반으로 의도를 분류한다.
 *
 * @param userMessage - 사용자 입력 문자열
 * @param taggedBlocks - 에디터에서 태깅된 블록 목록 (ID + 텍스트)
 * @param resolvedMode  - 런타임에서 명시적으로 주입된 모드 (있으면 최우선)
 * @returns AIIntent - 분류된 의도 문자열
 */
export function determineIntent(
  userMessage: string,
  taggedBlocks?: { id: string; text: string }[],
  resolvedMode?: string
): AIIntent {
  // 런타임 오버라이드 우선 처리
  if (resolvedMode) {
    const upper = resolvedMode.toUpperCase()
    if (upper === 'WRITE' || upper === 'EDIT' || upper === 'SUMMARY' || upper === 'CHAT') {
      return upper as AIIntent
    }
  }

  const cleanPrompt = userMessage.toLowerCase().trim()

  // 요약 키워드 감지
  const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
  if (summaryKeywords.some(k => cleanPrompt.includes(k))) return 'SUMMARY'

  // 태그된 블록 + 수정 키워드 조합은 EDIT 최우선
  const hasTags = taggedBlocks && taggedBlocks.length > 0
  const editKeywords = [
    '수정', '변경', '바꿔', '고쳐', '지워', '교체', '고쳐줘',
    'edit', 'modify', 'replace', 'rewrite', 'correct'
  ]
  const isEditQuery = editKeywords.some(k => cleanPrompt.includes(k))
  if (hasTags && isEditQuery) return 'EDIT'

  // 제목 생성 전용 패턴 → CHAT으로 유도 (에디터 삽입 없이 추천 목록만 제공)
  const isTitleGenerationOnly =
    cleanPrompt.includes('제목') &&
    (
      cleanPrompt.includes('지어') ||
      cleanPrompt.includes('추천') ||
      cleanPrompt.includes('후보') ||
      cleanPrompt.includes('어때') ||
      cleanPrompt.includes('정해')
    ) &&
    !cleanPrompt.includes('추가') &&
    !cleanPrompt.includes('넣어') &&
    !cleanPrompt.includes('삽입')
  if (isTitleGenerationOnly) return 'CHAT'

  // 쓰기(WRITE) 키워드 감지
  const writeKeywords = [
    '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
    '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
    '생성해', '쓰기', 'write', 'draft', 'create', 'compose', 'generate'
  ]
  if (writeKeywords.some(k => cleanPrompt.includes(k))) return 'WRITE'

  // 태그 없이 수정 키워드만 있는 경우도 EDIT
  if (isEditQuery) return 'EDIT'

  return 'CHAT'
}
