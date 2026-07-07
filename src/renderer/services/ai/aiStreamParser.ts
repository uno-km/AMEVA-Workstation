/**
 * aiStreamParser.ts
 *
 * AI 스트리밍 응답에서 구조화된 제안 태그를 파싱하는 서비스.
 * useAIAgent.ts 내부에서 중복으로 정의되어 있던 EDIT_SUGGESTION / INSERT_SUGGESTION 파서를
 * 완전히 추출하여 단일 책임 유틸리티로 격리한다.
 *
 * 지원 태그:
 *   - [EDIT_SUGGESTION: blockId]\n수정된 텍스트
 *   - [INSERT_SUGGESTION: afterBlockId=..., type=..., level=...]\n삽입할 내용
 */

import type { InsertSuggestion } from '../../types/aiTypes'

/** EDIT_SUGGESTION 파싱 결과 타입 */
export interface ParsedEditSuggestion {
  /** 수정 대상 블록 ID */
  blockId: string
  /** 수정 제안 텍스트 */
  proposedText: string
  /** 태그 이전의 대화 텍스트 */
  cleanContent: string
}

/** INSERT_SUGGESTION 파싱 결과 타입 */
export interface ParsedInsertSuggestions {
  /** 삽입 제안 목록 */
  suggestions: InsertSuggestion[]
  /** 태그 이전의 대화 텍스트 */
  cleanContent: string
  /** 태그 이전의 이유 설명 텍스트 */
  reasonText: string
}

/** 유효한 블록 타입 상수 */
const VALID_BLOCK_TYPES: InsertSuggestion['blockType'][] = [
  'heading', 'paragraph', 'bulletListItem', 'numberedListItem', 'table'
]

/**
 * parseEditSuggestion
 * rawText에서 [EDIT_SUGGESTION: blockId] 태그를 파싱하여 구조화된 결과를 반환한다.
 * 태그가 없으면 null을 반환하며, 반환 값의 null 여부를 통해 분기 처리한다.
 *
 * @param rawText - 모델이 생성한 원본 누적 응답 텍스트
 * @returns ParsedEditSuggestion 또는 null
 */
export function parseEditSuggestion(rawText: string): ParsedEditSuggestion | null {
  const editMatch = rawText.match(/\[EDIT_SUGGESTION:\s*([a-zA-Z0-9_\-]+)\](?:\r?\n)?([\s\S]*)/i)
  if (!editMatch) return null

  const blockId = editMatch[1]
  const proposedText = editMatch[2].trim()

  // 태그 이전 텍스트를 cleanContent로 반환 (사용자에게 보여지는 말풍선 텍스트)
  const cleanContent = rawText
    .replace(/\[EDIT_SUGGESTION:\s*[a-zA-Z0-9_\-]+\](?:\r?\n)?[\s\S]*/i, '')
    .trim()

  return { blockId, proposedText, cleanContent }
}

/**
 * parseInsertSuggestions
 * rawText에서 [INSERT_SUGGESTION: afterBlockId=..., type=..., level=...] 태그들을 파싱하여
 * InsertSuggestion 배열을 반환한다.
 *
 * @param rawText - 모델이 생성한 원본 누적 응답 텍스트
 * @param finalContent - sanitizer 처리 후 최종 콘텐츠
 * @param siblingBlockIds - 에디터 문서의 현재 블록 ID 목록 (위치 계산용)
 * @returns ParsedInsertSuggestions 또는 null (태그가 없는 경우)
 */
export function parseInsertSuggestions(
  rawText: string,
  finalContent: string,
  siblingBlockIds: string[] = []
): ParsedInsertSuggestions | null {
  const tagRegex = /\[INSERT_SUGGESTION:\s*afterBlockId=([^,\]]+),\s*type=(\w+)(?:,\s*level=(\d))?\]/gi
  let match: RegExpExecArray | null
  const parsedMatches: Array<{
    tag: string
    afterBlockIdRaw: string
    typeRaw: string
    level?: 1 | 2 | 3
    startIndex: number
    endIndex: number
  }> = []

  while ((match = tagRegex.exec(rawText)) !== null) {
    parsedMatches.push({
      tag: match[0],
      afterBlockIdRaw: match[1].trim(),
      typeRaw: match[2].trim().toLowerCase(),
      level: match[3] ? (parseInt(match[3]) as 1 | 2 | 3) : undefined,
      startIndex: match.index,
      endIndex: tagRegex.lastIndex
    })
  }

  if (parsedMatches.length === 0) return null

  // 첫 번째 태그 앞의 텍스트를 이유 설명 및 cleanContent로 처리
  const firstTagIdx = parsedMatches[0].startIndex
  const preTagText = rawText.slice(0, firstTagIdx).trim()

  // 내부 태그(thinking/reasoning) 제거 후 이유 텍스트 정제
  const reasonText = preTagText
    .replace(/<\/?(thinking|reasoning|thought|though|think)\s*>/gi, '')
    .replace(/^지금 요청은[^\n]*\n?/m, '')
    .replace(/^컨텍스트의 블록[^\n]*\n?/m, '')
    .trim()

  // finalContent에서 INSERT_SUGGESTION 태그 이후 부분 제거
  const cleanContent = finalContent
    .replace(/\[INSERT_SUGGESTION:[^\]]*\]?(?:\r?\n)?[\s\S]*/i, '')
    .trim()

  // 각 태그와 그 다음 태그 사이의 텍스트를 내용으로 파싱
  const suggestions: InsertSuggestion[] = parsedMatches.map((curr, i) => {
    const nextStart =
      i + 1 < parsedMatches.length ? parsedMatches[i + 1].startIndex : rawText.length
    const insertContent = rawText.slice(curr.endIndex, nextStart).trim()

    // afterBlockId 보정: 유효하지 않은 값은 'END'로 대체
    let afterBlockId = curr.afterBlockIdRaw
    if (!afterBlockId || afterBlockId === '...' || afterBlockId === 'undefined') {
      afterBlockId = 'END'
    }

    // blockType 보정: 유효하지 않은 타입은 'paragraph'로 폴백
    const blockType: InsertSuggestion['blockType'] = VALID_BLOCK_TYPES.includes(
      curr.typeRaw as InsertSuggestion['blockType']
    )
      ? (curr.typeRaw as InsertSuggestion['blockType'])
      : 'paragraph'

    // 삽입 위치의 sibling 인덱스 계산
    const foundIdx = siblingBlockIds.indexOf(afterBlockId)
    const siblingIndex = foundIdx >= 0 ? foundIdx : siblingBlockIds.length - 1

    return {
      afterBlockId,
      blockType,
      level: curr.level,
      content: insertContent,
      reasonText: reasonText || undefined,
      status: 'pending',
      siblingBlockIds,
      siblingIndex
    }
  })

  return { suggestions, cleanContent, reasonText }
}

/**
 * cleanModeEchoFromContent
 * 소형 모델이 [WRITE], [EDIT] 등 모드 에코를 응답에 붙이는 현상을 제거한다.
 * 성공 응답에만 적용하며, 오류 응답에는 적용하지 않는다.
 *
 * @param content - 정제 대상 콘텐츠 문자열
 * @returns 정제된 콘텐츠 문자열
 */
export function cleanModeEchoFromContent(content: string): string {
  return content
    .replace(/^\[(WRITE|EDIT|CHAT|SUMMARY)\]\s*/i, '')
    .replace(/^현재 작업 모드:.*\n?/m, '')
    .replace(/^지금 요청은.*\n?/m, '')
    .trim()
}
