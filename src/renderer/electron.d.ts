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

  // 협업 서버
  startCollaborationServer: (port: number) => Promise<{ running: boolean; port: number; error?: string }>
  stopCollaborationServer: () => Promise<{ running: boolean }>
  onServerStatus: (callback: (status: { running: boolean; port?: number; error?: string }) => void) => () => void

  // 코드 실행
  runPythonCode: (code: string) => Promise<{ success: boolean; output?: string; error?: string }>

  // 창 제어
  setZoomLevel: (level: number) => void
  getZoomLevel: () => Promise<number>

  // 브라우저 원생 줌 (webFrame) — 에디터 외 영역 Ctrl+Wheel 전용
  setZoomFactor: (factor: number) => void
  getZoomFactor: () => Promise<number>


  // 파일 연결
  onFileOpenArgv: (callback: (event: any, file: { content: string; filePath: string }) => void) => () => void

  // 기타
  openExternalLink: (url: string) => void
  closeApp: () => void
  newWindow: () => void

  // 🤖 로컬 LLM
  llmGenerate: (payload: {
    modelPath: string
    prompt: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
  }) => Promise<{ success: boolean; error?: string }>

  llmAbort: () => void

  onLLMToken: (callback: (token: string) => void) => () => void
  onLLMDone: (callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => () => void

  llmListModels: () => Promise<LLMModel[]>

  // 🎤 Whisper STT
  sttTranscribe: (payload: { audioPath: string; language?: string }) => Promise<{ success: boolean; text?: string; error?: string }>
  sttGetTempPath: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI
  }
}
