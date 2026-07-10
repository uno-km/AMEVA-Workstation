/**
 * @file detectCodingRequest.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ai/detectCodingRequest.ts
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
 * detectCodingRequest.ts
 *
 * 사용자 요청 문자열이 코딩/개발 관련 요청인지 감지하는 순수 유틸리티.
 * 코딩 특화 모델(codeModelPath)로 동적 교체 여부를 결정하는 데 사용된다.
 * 외부 의존성이 전혀 없는 순수 함수로 구성된다.
 */

/**
 * 코딩 요청 감지 키워드 목록 상수.
 * 새로운 언어나 키워드를 추가할 경우 이 배열에만 추가한다.
 */
const CODING_KEYWORDS: string[] = [
  '코드', '코딩', '개발', '함수', '구현', '프로그래밍', '알고리즘', '정규식',
  'python', 'javascript', 'typescript', 'c++', 'java', 'html', 'css', 'sql',
  'api', '컴파일', '디버그', 'eslint', 'prettier', 'git', 'github', 'mcp', 'wasm',
  'code', 'implement', 'debug', 'compile', 'function', 'class', 'struct', 'library'
]

/**
 * detectCodingRequest
 * 사용자 메시지에 코딩 관련 키워드가 포함되어 있는지 확인한다.
 *
 * @param userMessage - 사용자 입력 문자열
 * @returns true if the message is a coding-related request, false otherwise
 */
export function detectCodingRequest(userMessage: string): boolean {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const cleanPrompt = userMessage.toLowerCase().trim()
  return CODING_KEYWORDS.some(k => cleanPrompt.includes(k))
}

/**
 * detectAgentRequest
 * 에이전트 모드 (ReAct Loop, 도구 실행)가 필요한 요청인지 감지한다.
 * 검색, 주식 시세 조회, 파이썬 실행 등 외부 도구 연동이 필요한 쿼리를 식별한다.
 *
 * @param userMessage - 사용자 입력 문자열
 * @returns true if the message requires agent execution, false otherwise
 */
export function detectAgentRequest(userMessage: string): boolean {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `agentKeywords`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const agentKeywords = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const agentKeywords = [
    '검색', '찾아줘', '구글', '네이버', '실행', '파이썬', '계산',
    'search', 'run', '주가', '주식', '시세', 'stock'
  ]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanPrompt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanPrompt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const cleanPrompt = userMessage.toLowerCase().trim()
  return agentKeywords.some(k => cleanPrompt.includes(k))
}

