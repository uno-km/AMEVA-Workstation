export interface LLMModel {
  name: string
  filename: string
  path: string
  size: number
}

export interface IElectronAPI {
  // 파일 시스템
  openFile: () => Promise<{ content: string; filePath: string } | null>
  saveFile: (content: string, filePath?: string) => Promise<string | null>
  saveExportedFile: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>
  printToPDF: (htmlContent: string) => Promise<string | null>
  // [HIGH-001] showMessageBox Electron 네이티브 다이얼로그
  showMessageBox: (options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning'
    buttons?: string[]
    defaultId?: number
    title?: string
    message: string
    detail?: string
  }) => Promise<{ response: number; checkboxChecked?: boolean }>

  // 협업 서버
  startCollaborationServer: (port: number) => Promise<{ running: boolean; port: number; error?: string }>
  stopCollaborationServer: () => Promise<{ running: boolean }>
  onServerStatus: (callback: (status: { running: boolean; port?: number; ip?: string; token?: string; error?: string }) => void) => () => void

  // 상 제어
  setZoomLevel: (level: number) => void
  getZoomLevel: () => Promise<number>

  // 브라우저 원생 줄 (webFrame) — 에디터 외 영역 Ctrl+Wheel 전용
  setZoomFactor: (factor: number) => void
  getZoomFactor: () => Promise<number>

  // 파일 연결
  onFileOpenArgv: (callback: (event: any, file: { content: string; filePath: string }) => void) => () => void

  // 기타
  openExternalLink: (url: string) => void
  closeApp: () => void
  newWindow: () => void

  // 홍 로컈 LLM
  llmGenerate: (payload: {
    sessionId: string
    modelPath: string
    prompt: string
    context?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
    apiType?: 'local' | 'api' | 'ollama' | 'wasm'
    apiKey?: string
    apiEndpoint?: string
    apiModel?: string
    gpuOnly?: boolean
    history?: { role: string; content: string }[]
  }) => Promise<{ success: boolean; error?: string }>

  llmAbort: (sessionId: string) => void

  onLLMToken: (sessionId: string, callback: (token: string) => void) => () => void
  onLLMDone: (sessionId: string, callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => () => void
  onLLMLog: (callback: (data: { text: string }) => void) => () => void
  llmAddLog: (payload: { text: string; prefix?: string }) => void
  llmGetLogs: () => Promise<string>
  llmCheckHealth: () => Promise<{ status: 'ok' | 'offline'; running: boolean; error?: string }>
  llmRestart: () => Promise<{ success: boolean; error?: string }>

  llmListModels: () => Promise<LLMModel[]>
  llmGetGpuName: () => Promise<string>

  // 홍 Whisper STT
  sttTranscribe: (payload: { audioPath: string; language?: string }) => Promise<{ success: boolean; text?: string; error?: string }>
  sttGetTempPath: () => Promise<string>

  llmDownloadModel: (payload: { url: string; filename: string }) => Promise<{ success: boolean; error?: string }>
  onLLMDownloadProgress: (callback: (data: { filename: string; progress: number; speed: number; downloadedBytes: number; totalBytes: number; timeRemaining: number }) => void) => () => void
  llmImportModel: (sourcePath: string) => Promise<{ success: boolean; path?: string; error?: string }>

  // 분산 문서 변환 브리지
  exportConvert: (payload: { blocks: any[]; format: string; defaultName: string }) => Promise<{ success: boolean; savedPath?: string; error?: string }>
  appReady: () => Promise<{ success: boolean }>
  webSearch: (query: string) => Promise<{ success: boolean; result?: string; error?: string }>
  mcpSpawn: (serverId: string, command: string, args: string[]) => Promise<{ success: boolean; error?: string }>
  mcpCall: (serverId: string, request: any) => Promise<any>
  mcpKill: (serverId: string) => Promise<{ success: boolean }>
  isFreeMode: () => Promise<boolean>
  planGetStatus: () => Promise<boolean>
  planSetStatus: (isPro: boolean) => Promise<{ success: boolean; isPro?: boolean; error?: string }>

  // 🔐 OS Keychain (safeStorage) 자격 증명 연동
  keychainSet: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
  keychainGet: (key: string) => Promise<string | null>
  keychainDelete: (key: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
