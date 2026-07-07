/**
 * buildSystemPrompt.ts
 *
 * AI 동적 시스템 프롬프트 조립 서비스.
 * useAIAgent.ts 내부에 인라인으로 박혀 있던 1200~1230줄 규모의 시스템 프롬프트 조립 로직을
 * 완전히 추출하여 단일 책임 서비스로 격리한다.
 *
 * 입력: baseSystemPrompt(설정값), intent, context 상태, 태깅된 블록 목록, 코딩 요청 여부
 * 출력: 완성된 dynamicSystemPrompt 문자열
 */

import type { AIIntent } from './determineIntent'

/** buildSystemPrompt 함수의 입력 파라미터 타입 */
export interface SystemPromptBuildParams {
  /** 기본 시스템 프롬프트 (설정에서 불러온 값) */
  baseSystemPrompt: string
  /** 분류된 AI 의도 */
  intent: AIIntent
  /** 에디터 컨텍스트 (현재 문서 블록 목록) */
  context?: string
  /** 태깅된 블록 목록 */
  taggedBlocks?: { id: string; text: string }[]
  /** 코딩 요청 여부 (코딩 특화 지침 주입용) */
  isCodingRequest: boolean
}

/**
 * buildSystemPrompt
 * 의도, 컨텍스트, 태깅된 블록 등을 고려하여 완성된 동적 시스템 프롬프트를 조립한다.
 *
 * @param params - SystemPromptBuildParams
 * @returns 조립된 시스템 프롬프트 문자열
 */
export function buildSystemPrompt(params: SystemPromptBuildParams): string {
  const { baseSystemPrompt, intent, context, taggedBlocks, isCodingRequest } = params

  // 현재 시스템 날짜 정보 주입 (소형 모델의 시간 왜곡 방지)
  const sysDate = new Date()
  const sysYear = sysDate.getFullYear()
  const sysMonth = sysDate.getMonth() + 1
  const sysDay = sysDate.getDate()

  let prompt =
    `${baseSystemPrompt}\n\n` +
    `[System Time Info]\n` +
    `- 현재 시스템 날짜: ${sysYear}년 ${sysMonth}월 ${sysDay}일\n` +
    `- 지침: 사용자가 과거 시점을 명시하면 해당 연도 맥락에 맞게 답변하고, ` +
    `구체적 시점 없이 '요즘', '현재', '최신 트렌드'라면 현재 연도(${sysYear}년)를 기준으로 작성하십시오.`

  // 빈 에디터 대응 지침 추가
  const isContextEmpty = !context || context.trim() === '' || context.trim() === '[]'
  if (isContextEmpty) {
    prompt =
      `[⚠️ 초강력 절대 지침: 빈 에디터 대응 정책]\n` +
      `현재 에디터 문서의 내용이 완전히 비어 있습니다. ` +
      `본문 재료가 없는 상태이므로, 마음대로 가상의 내용을 창작하여 에디터에 삽입하거나 수정 제안(INSERT_SUGGESTION/EDIT_SUGGESTION)을 하지 마십시오. ` +
      `사용자에게 "현재 문서가 비어 있어 해당 작업을 수행할 수 없으니 텍스트를 먼저 입력해 주세요"라고 친절히 안내하십시오.\n\n` +
      prompt
  }

  // 태깅된 블록 컨텍스트 주입
  if (taggedBlocks && taggedBlocks.length > 0) {
    const referencedContent = taggedBlocks
      .map((b, i) => `[참조 블록 ${i + 1}] (ID: ${b.id}): "${b.text}"`)
      .join('\n')

    prompt =
      `[⚠️ 초강력 절대 지침: 참조 본문 우선순위]\n` +
      `현재 사용자가 문서 본문에서 특정 영역을 마우스 블록 지정하거나 별표 버튼을 눌러 아래의 본문 구절들(Reference)을 특별히 지정하여 태깅했습니다:\n` +
      `${referencedContent}\n\n` +
      `AI는 에디터 문서 전체 내용(Context)이 주어지더라도 이를 절대 요약/수정 대상으로 삼아서는 안 됩니다. ` +
      `반드시 위에 명시된 [참조 블록]들의 텍스트만을 유일한 분석, 수정, 요약 대상으로 한정하십시오. ` +
      `수정 제안(EDIT_SUGGESTION)을 보낼 때 참조 블록의 ID 중 알맞은 ID를 명확하게 매칭하여 태그로 돌려주어야 합니다.\n\n` +
      `[⚠️ 초강력 절대 지침: 수정 텍스트 정제 규격]\n` +
      `문서를 수정할 때, 사용자가 지시한 명령조 문구를 절대 수정 결과 텍스트 자체에 포함하지 마십시오.\n` +
      `반드시 사용자가 의도한 "수정 후 완성될 깔끔한 최종 본문 문장/단어 자체"만을 정제하여 수정안으로 제시해야 합니다.\n\n` +
      prompt
  }

  // 멀티턴 연쇄 작명 지침
  prompt +=
    `\n\n[⚠️ 멀티턴 연쇄 작명 지침]\n` +
    `만약 사용자가 "이걸 제목으로 지어줘", "제목 지어줘" 등 작명(Title Generation)을 요구하는 경우:\n` +
    `- 절대 에디터 문서 맨 앞에 삽입 제안([INSERT_SUGGESTION])을 함부로 띄우지 마십시오. ` +
    `사용자가 명시적으로 "넣어줘"라고 지시하기 전까지는 일반 대화 답변으로 제목 후보들을 추천하십시오.\n` +
    `- 만약 사용자가 에디터의 특정 블록을 태그하고 "이걸 제목으로 바꿔줘"라고 요청한 상태라면, [EDIT_SUGGESTION]을 제안하십시오.`

  // 코딩/비코딩 지침 추가
  const codeRestriction = isCodingRequest
    ? `\n[💡 코딩 지침] 사용자가 코드 또는 프로그래밍 구현을 요청했으므로, 필요한 JavaScript, HTML, CSS 등의 코드 및 설명 예시를 상세히 작성하여 제공하십시오.`
    : `\n코드나 프로그래밍 예시는 절대 출력하지 마십시오.`

  // 의도별 지침 추가
  if (intent === 'WRITE') {
    prompt +=
      `\n\n지금 요청은 새로운 내용을 문서에 추가하는 작업입니다.\n` +
      `컨텍스트의 블록 목록을 분석하여 가장 적절한 삽입 위치를 결정하십시오.\n` +
      `왜 그 위치를 선택했는지 한 문장으로 설명한 뒤, 답변 맨 끝에 반드시 다음 태그를 추가하십시오:\n` +
      `[INSERT_SUGGESTION: afterBlockId=..., type=..., level=...]\n삽입할 내용\n${codeRestriction}`
  } else if (intent === 'EDIT') {
    prompt +=
      `\n\n지금 요청은 문서의 기존 내용을 수정하는 작업입니다.\n` +
      `수정 이유를 한 문장으로 설명한 뒤, 수정한 내용을 제공할 때 **반드시 다음 형식을 엄격히 지켜서** 출력하십시오:\n\n` +
      `[EDIT_SUGGESTION: 블록ID]\n여기에 깔끔하게 정제된 수정 결과문을 작성하세요.\n\n` +
      `주의: 수정한 텍스트는 반드시 위 태그의 아래에 위치해야 하며, 태그를 맨 끝에 적으면 안 됩니다.\n${codeRestriction}`
  } else if (intent === 'SUMMARY') {
    prompt +=
      `\n\n지금 요청은 문서 요약 작업입니다. ` +
      `만약 사용자가 지정하여 태깅한 [참조 블록]들이 있다면, 절대 문서 전체를 요약하지 말고 오직 해당 [참조 블록]들의 내용만을 요약하십시오. ` +
      `3~5줄로 간결하게 요약하십시오.\n${codeRestriction}`
  } else {
    // CHAT
    prompt +=
      `\n\n지금은 일반 질문 또는 이전 검색 결과에 대한 연쇄 질의입니다. ` +
      `이전 대화 기록을 참고하여 사용자의 의도에 맞게 간결하고 명확하게 답변하십시오. ` +
      `만약 제목 추천 요청인 경우 근사한 제목 후보들을 리스트로 추천하십시오.\n${codeRestriction}`
  }

  return prompt
}
