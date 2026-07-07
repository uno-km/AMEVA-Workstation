/**
 * [Tier 3] 특정 도메인/기능 종속 지역 상수
 * AI 터미널 및 로그 스트리밍 기능에서만 사용되는 하드코딩 값들을 관리합니다.
 */
export const AI_TERMINAL_CONSTANTS = {
  // 센서 로그 및 추론 로그 링 버퍼(Ring Buffer)의 최대 길이
  // 이 길이를 초과하면 가장 오래된 로그부터 자동 폐기(Shift)되어 메모리 OOM을 방지합니다.
  MAX_LOG_BUFFER: 1000,
  
  // 스트리밍 업데이트를 DOM에 직접 쓰는 간격(ms)
  // 너무 짧으면 렌더링 부하가 걸리고, 너무 길면 사용자가 지연을 느낍니다.
  SENSOR_POLLING_RATE_MS: 100,

  // 기본 AI LLM 응답 토큰 제한
  DEFAULT_MAX_TOKENS: 1024,
  
  // 기본 LLM 추론 온도(Temperature)
  DEFAULT_TEMPERATURE: 0.7,
} as const;
