/**
 * ipcTypes.ts
 *
 * Electron IPC 통신에서 사용되는 공통 타입 정의 모음.
 * window.electronAPI의 메서드 시그니처와 IPC 이벤트 페이로드를 명시적으로 정의한다.
 * 이 파일은 electron API와 관련된 모든 타입의 단일 진실 원천(Single Source of Truth)이다.
 */

/** LLM 생성 요청 파라미터 */
export interface LLMGenerateParams {
  sessionId: string
  modelPath: string
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  apiType?: 'local' | 'api' | 'wasm' | 'ollama'
  apiKey?: string
  apiEndpoint?: string
  apiModel?: string
  gpuOnly?: boolean
  context?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

/** LLM 생성 응답 */
export interface LLMGenerateResult {
  success: boolean
  content?: string
  response?: string
  error?: string
}

/** LLM 완료 이벤트 데이터 */
export interface LLMDoneEventData {
  success: boolean
  error?: string
  content?: string
}

/** LLM 로그 이벤트 데이터 */
export interface LLMLogEventData {
  text: string
  prefix?: string
}

/** 모델 정보 */
export interface ModelInfo {
  path: string
  filename: string
  size?: number
}

/** URL 메타데이터 (링크 프리뷰) */
export interface UrlMetadata {
  title?: string
  description?: string
  image?: string
}

/** 파일 내용 이벤트 데이터 */
export interface FileOpenEventData {
  filePath: string
  content: string
}

/** 헬스 체크 응답 */
export interface HealthCheckResult {
  status: 'ok' | 'loading model' | 'ready' | 'error'
  message?: string
}

/** 모델 임포트 결과 */
export interface ModelImportResult {
  success: boolean
  error?: string
}

/** 모델 다운로드 진행 이벤트 */
export interface ModelDownloadProgressEvent {
  modelId: string
  progress: number
  total?: number
  speed?: string
  remaining?: string
  status?: string
}

/** 내보내기 진행 이벤트 */
export interface ExportProgressEvent {
  phase: string
  format: string
  percent: number
  message: string
}
