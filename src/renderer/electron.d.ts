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
    modelPath: string
    prompt: string
    context?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
    apiType?: 'local' | 'api'
    apiKey?: string
    gpuOnly?: boolean
    history?: { role: string; content: string }[]
  }) => Promise<{ success: boolean; error?: string }>

  llmAbort: () => void

  onLLMToken: (callback: (token: string) => void) => () => void
  onLLMDone: (callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => () => void
  onLLMLog: (callback: (data: { text: string }) => void) => () => void

  llmListModels: () => Promise<LLMModel[]>
  llmGetGpuName: () => Promise<string>

  // 홍 Whisper STT
  sttTranscribe: (payload: { audioPath: string; language?: string }) => Promise<{ success: boolean; text?: string; error?: string }>
  sttGetTempPath: () => Promise<string>

  llmDownloadModel: (payload: { url: string; filename: string }) => Promise<{ success: boolean; error?: string }>
  onLLMDownloadProgress: (callback: (data: { filename: string; progress: number; speed: number; downloadedBytes: number; totalBytes: number; timeRemaining: number }) => void) => () => void

  // 분산 문서 변환 브리지
  exportConvert: (payload: { blocks: any[]; format: string; defaultName: string }) => Promise<{ success: boolean; savedPath?: string; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
