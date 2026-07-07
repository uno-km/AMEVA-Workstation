/**
 * [Tier 2] 앱 전체 관통 전역 상수
 * Main 프로세스와 Renderer 프로세스 간의 IPC 통신 채널 이름들
 */
export const IPC_CHANNELS = {
  // 앱 기본 설정
  GET_APP_SETTINGS: 'get-app-settings',
  SET_APP_SETTINGS: 'set-app-settings',
  
  // Llama (로컬 AI) 관련 채널
  LLAMA_CHECK_MODELS: 'llama-check-models',
  LLAMA_START: 'llama-start',
  LLAMA_STOP: 'llama-stop',
  LLAMA_STATUS: 'llama-status',
  LLAMA_DOWNLOAD_MODEL: 'llama-download-model',
  
  // Yjs 협업 서버 관련 채널
  SERVER_START: 'server-start',
  SERVER_STOP: 'server-stop',
  SERVER_STATUS: 'server-status',
  
  // 디버깅 및 터미널
  OPEN_DEV_TOOLS: 'open-dev-tools',
} as const;

export const TIME_FORMATS = {
  DEFAULT_LOG: 'YYYY-MM-DD HH:mm:ss',
  SHORT_TIME: 'HH:mm:ss',
} as const;
