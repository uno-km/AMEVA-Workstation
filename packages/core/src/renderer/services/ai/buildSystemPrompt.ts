/**
 * @file buildSystemPrompt.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/buildSystemPrompt.ts
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
  /** 딥리즈닝 에이전트 모드 활성화 여부 */
  deepReasoning?: boolean
}

/**
 * buildSystemPrompt
 * 의도, 컨텍스트, 태깅된 블록 등을 고려하여 완성된 동적 시스템 프롬프트를 조립한다.
 *
 * @param params - SystemPromptBuildParams
 * @returns 조립된 시스템 프롬프트 문자열
 */
export function buildSystemPrompt(params: SystemPromptBuildParams): string {
  const { baseSystemPrompt, intent, context, taggedBlocks, isCodingRequest, deepReasoning } = params

  // 현재 시스템 날짜 정보 주입 (소형 모델의 시간 왜곡 방지)
  const sysDate = new Date()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sysYear`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sysYear = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const sysYear = sysDate.getFullYear()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sysMonth`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sysMonth = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const sysMonth = sysDate.getMonth() + 1
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sysDay`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sysDay = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const sysDay = sysDate.getDate()

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `prompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const prompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let prompt =
    `${baseSystemPrompt}\n\n` +
    `[System Time Info]\n` +
    `- 현재 시스템 날짜: ${sysYear}년 ${sysMonth}월 ${sysDay}일\n` +
    `- 지침: 사용자가 과거 시점을 명시하면 해당 연도 맥락에 맞게 답변하고, ` +
    `구체적 시점 없이 '요즘', '현재', '최신 트렌드'라면 현재 연도(${sysYear}년)를 기준으로 작성하십시오.`

  // 빈 에디터 대응 지침 추가
  const isContextEmpty = !context || context.trim() === '' || context.trim() === '[]'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isContextEmpty`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isContextEmpty)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `referencedContent`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const referencedContent = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

  // 딥리즈닝 모드가 꺼진 경우(일반 대화)에는 도구를 실행할 수 없으므로 도구 호출 지시문 작성을 엄격히 금지함
  if (!deepReasoning) {
    prompt +=
      `\n\n[⚠️ 초강력 절대 지침: 도구 사용 불가]\n` +
      `- 당신은 현재 일반 대화 모드에 있습니다. 스스로 list_dir, read_file, write_file 등의 도구(Tool)를 직접 실행할 수 없습니다.\n` +
      `- 따라서 답변 본문에 '{"name": "read_file", ...}' 과 같은 도구 호출용 JSON 블록이나 도구 호출 지시 텍스트(예: "도구가 필요합니다")를 절대 작성하지 마십시오.\n` +
      `- 오직 일반 텍스트 형태로만 완성된 결과를 답변으로 작성하십시오.`
  }

  return prompt
}

