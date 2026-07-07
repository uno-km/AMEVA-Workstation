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
  const agentKeywords = [
    '검색', '찾아줘', '구글', '네이버', '실행', '파이썬', '계산',
    'search', 'run', '주가', '주식', '시세', 'stock'
  ]
  const cleanPrompt = userMessage.toLowerCase().trim()
  return agentKeywords.some(k => cleanPrompt.includes(k))
}
