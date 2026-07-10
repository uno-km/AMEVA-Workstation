/**
 * @file determineIntent.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/determineIntent.ts
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `upper`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const upper = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const upper = resolvedMode.toUpperCase()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `upper === 'WRITE' || upper === 'EDIT' || upper === 'SUMMARY' || upper === 'CHAT'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (upper === 'WRITE' || upper === 'EDIT' || upper === 'SUMMARY' || upper === 'CHAT')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (upper === 'WRITE' || upper === 'EDIT' || upper === 'SUMMARY' || upper === 'CHAT') {
      return upper as AIIntent
    }
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const cleanPrompt = userMessage.toLowerCase().trim()

  // 요약 키워드 감지
  const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `summaryKeywords.some(k => cleanPrompt.includes(k))`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (summaryKeywords.some(k => cleanPrompt.includes(k)))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (summaryKeywords.some(k => cleanPrompt.includes(k))) return 'SUMMARY'

  // 태그된 블록 + 수정 키워드 조합은 EDIT 최우선
  const hasTags = taggedBlocks && taggedBlocks.length > 0
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `editKeywords`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const editKeywords = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const editKeywords = [
    '수정', '변경', '바꿔', '고쳐', '지워', '교체', '고쳐줘',
    'edit', 'modify', 'replace', 'rewrite', 'correct'
  ]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isEditQuery`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isEditQuery = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const isEditQuery = editKeywords.some(k => cleanPrompt.includes(k))
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `hasTags && isEditQuery`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (hasTags && isEditQuery)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isTitleGenerationOnly`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isTitleGenerationOnly)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isTitleGenerationOnly) return 'CHAT'

  // 쓰기(WRITE) 키워드 감지
  const writeKeywords = [
    '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
    '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
    '생성해', '쓰기', 'write', 'draft', 'create', 'compose', 'generate'
  ]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `writeKeywords.some(k => cleanPrompt.includes(k))`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (writeKeywords.some(k => cleanPrompt.includes(k)))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (writeKeywords.some(k => cleanPrompt.includes(k))) return 'WRITE'

  // 태그 없이 수정 키워드만 있는 경우도 EDIT
  if (isEditQuery) return 'EDIT'

  return 'CHAT'
}

