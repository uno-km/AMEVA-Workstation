/**
 * @file constants.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/features/ai-terminal/constants.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * - 소비처 C (src/renderer/stores/useAILogStore.ts): 로그 제한 개수 및 디바운스 속도 참조.
 * - 소비처 D (src/renderer/components/ai/log-drawer/ConsoleLogTab.tsx): 검색 하이라이팅 스타일 및 커스텀 이벤트 채널 수신기 연동 시 참조.
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

  // [Tier 3 ADDITION] 커스텀 IPC 및 렌더러 간 통신 채널 이벤트 정의
  EVENTS: {
    // AI 패널 입력란에 텍스트를 즉각 주입하기 위한 단축 이벤트 채널
    FILL_AI_INPUT: 'ameva:fill-ai-input',
    // 에디터 본문 영역에 텍스트를 동적으로 기입하기 위한 단축 이벤트 채널
    INSERT_TEXT: 'ameva:insert-text',
  },

  // [Tier 3 ADDITION] 검색어 일치 텍스트 하이라이팅 CSS 스타일 토큰
  HIGHLIGHT: {
    // 일치 단어 백그라운드 색상 (가시성이 높은 퍼플/글로우 계열)
    BG: 'rgba(139, 92, 246, 0.4)',
    // 일치 단어 전경색
    COLOR: '#ffffff',
    // 강조 영역 둥글기 경계값
    BORDER_RADIUS: '2px',
    // 여백 패딩
    PADDING: '0px 2px',
  }
} as const;

