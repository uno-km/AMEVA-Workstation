import { contextBridge, ipcRenderer, webFrame } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 파일 시스템 연동 ──
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, filePath?: string) => ipcRenderer.invoke('dialog:saveFile', content, filePath),
  saveExportedFile: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:saveExportedFile', data, isBase64, defaultName, filters),
  selectLocalFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:selectLocalFile', filters),
  showMessageBox: (options: any) => ipcRenderer.invoke('dialog:showMessageBox', options),

  // ── PDF 출력 ──
  printToPDF: (htmlContent: string) => ipcRenderer.invoke('action:printToPDF', htmlContent),

  // ── 로컬 협업 서버 제어 ──
  startCollaborationServer: (port: number) => ipcRenderer.invoke('server:start', port),
  stopCollaborationServer: () => ipcRenderer.invoke('server:stop'),
  onServerStatus: (callback: (status: { running: boolean; port?: number; error?: string }) => void) => {
    const subscription = (_event: any, status: any) => callback(status)
    ipcRenderer.on('server:status', subscription)
    return () => ipcRenderer.removeListener('server:status', subscription)
  },

  // ── 파이썬 로컬 실행 ──
  runPythonCode: (code: string) => ipcRenderer.invoke('runtime:runPython', code),

  // ── 창 줌 컨트롤 ──
  setZoomLevel: (level: number) => ipcRenderer.send('window:setZoom', level),
  getZoomLevel: () => ipcRenderer.invoke('window:getZoom'),

  // ── 브라우저 원생 줄 (webFrame) ──
  // 에디터 외 영역(sidebar 등) Ctrl+Wheel 시 전체 페이지 비율 조정
  setZoomFactor: (factor: number) => ipcRenderer.send('window:setZoomFactor', factor),
  getZoomFactor: () => ipcRenderer.invoke('window:getZoomFactor'),

  // ── OS 파일 연결 및 인자 수신 채널 ──
  onFileOpenArgv: (callback: (event: any, file: { content: string; filePath: string }) => void) => {
    ipcRenderer.on('file:open-argv', callback)
    return () => ipcRenderer.removeListener('file:open-argv', callback)
  },

  // ── 외부 링크 기본 브라우저 실행 ──
  openExternalLink: (url: string) => ipcRenderer.send('action:openExternal', url),

  // ── 앱 종료 및 새 창 ──
  closeApp: () => ipcRenderer.send('window:close'),
  newWindow: () => ipcRenderer.send('window:new-window'),

  // ── 🤖 로컬 LLM (llama.cpp) ──
  llmGenerate: (payload: {
    modelPath: string
    prompt: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
  }) => ipcRenderer.invoke('llm:generate', payload),

  llmAbort: () => ipcRenderer.send('llm:abort'),

  onLLMToken: (callback: (token: string) => void) => {
    const subscription = (_event: any, data: { token: string }) => callback(data.token)
    ipcRenderer.on('llm:token', subscription)
    return () => ipcRenderer.removeListener('llm:token', subscription)
  },

  onLLMDone: (callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('llm:done', subscription)
    return () => ipcRenderer.removeListener('llm:done', subscription)
  },

  llmListModels: () => ipcRenderer.invoke('llm:listModels'),

  // ── 🎤 Whisper STT ──
  sttTranscribe: (payload: { audioPath: string; language?: string }) =>
    ipcRenderer.invoke('stt:transcribe', payload),

  sttGetTempPath: () => ipcRenderer.invoke('stt:getTempPath'),
})
