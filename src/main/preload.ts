import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 파일 시스템 연동 ──
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, filePath?: string) => ipcRenderer.invoke('dialog:saveFile', content, filePath),
  saveFileAs: (content: string, filePath?: string) => ipcRenderer.invoke('dialog:saveFile', content, filePath, true),
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
    sessionId: string     // [FIX-IPC-001] 세션 격리를 위한 ID 추가
    modelPath: string
    prompt: string
    context?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
    apiType?: 'local' | 'api'
    apiKey?: string
    apiEndpoint?: string  // [FIX-W-003] 동적 API 엔드포인트
    apiModel?: string     // [FIX-W-003] 동적 API 모델명
    gpuOnly?: boolean
    history?: { role: string; content: string }[]
  }) => ipcRenderer.invoke('llm:generate', payload),

  llmAbort: (sessionId: string) => ipcRenderer.send(`llm:abort:${sessionId}`),
  llmStart: (modelPath: string) => ipcRenderer.invoke('llm:start', modelPath),
  llmStop: () => ipcRenderer.invoke('llm:stop'),

  onLLMToken: (sessionId: string, callback: (token: string) => void) => {
    const subscription = (_event: any, data: { token: string }) => callback(data.token)
    ipcRenderer.on(`llm:token:${sessionId}`, subscription)
    return () => ipcRenderer.removeListener(`llm:token:${sessionId}`, subscription)
  },

  onLLMDone: (sessionId: string, callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(`llm:done:${sessionId}`, subscription)
    return () => ipcRenderer.removeListener(`llm:done:${sessionId}`, subscription)
  },

  onLLMLog: (callback: (data: { text: string }) => void) => {
    const subscription = (_event: any, data: { text: string }) => callback(data)
    ipcRenderer.on('llm:log', subscription)
    return () => ipcRenderer.removeListener('llm:log', subscription)
  },

  llmAddLog: (payload: { text: string; prefix?: string }) => ipcRenderer.send('llm:add-log', payload),
  llmGetLogs: () => ipcRenderer.invoke('llm:get-logs'),

  llmCheckHealth: () => ipcRenderer.invoke('llm:check-health'),
  llmRestart: () => ipcRenderer.invoke('llm:restart'),

  llmListModels: (type?: 'llm' | 'code') => ipcRenderer.invoke('llm:listModels', type),
  llmGetGpuName: () => ipcRenderer.invoke('llm:getGpuName'),
  llmDownloadModel: (payload: { url: string; filename: string; type?: 'llm' | 'code' }) => ipcRenderer.invoke('llm:downloadModel', payload),
  onLLMDownloadProgress: (callback: (status: any) => void) => {
    const subscription = (_event: any, status: any) => callback(status)
    ipcRenderer.on('llm:download-progress', subscription)
    return () => ipcRenderer.removeListener('llm:download-progress', subscription)
  },
  llmImportModel: (sourcePath: string, type?: 'llm' | 'code') => ipcRenderer.invoke('llm:importModel', sourcePath, type),

  // ── 🎤 Whisper STT ──
  sttTranscribe: (payload: { audioPath: string; language?: string }) =>
    ipcRenderer.invoke('stt:transcribe', payload),

  sttGetTempPath: () => ipcRenderer.invoke('stt:getTempPath'),

  exportConvert: (payload: { blocks: any; format: string; defaultName: string }) =>
    ipcRenderer.invoke('export:convert', payload),
  appReady: () => ipcRenderer.invoke('app:ready'),
  webSearch: (query: string) => ipcRenderer.invoke('action:webSearch', query),

  // ── 🤖 동적 MCP 연동 브릿지 ──
  mcpSpawn: (serverId: string, command: string, args: string[]) => ipcRenderer.invoke('mcp:spawn', serverId, command, args),
  mcpCall: (serverId: string, request: any) => ipcRenderer.invoke('mcp:call', serverId, request),
  mcpKill: (serverId: string) => ipcRenderer.invoke('mcp:kill', serverId),
  isFreeMode: () => ipcRenderer.invoke('llm:is-free-mode'),
  planGetStatus: () => ipcRenderer.invoke('plan:get-status'),
  planSetStatus: (isPro: boolean) => ipcRenderer.invoke('plan:set-status', isPro),

  // 🔐 OS Keychain (safeStorage) 자격 증명 연동
  keychainSet: (key: string, value: string) => ipcRenderer.invoke('keychain:set', key, value),
  keychainGet: (key: string) => ipcRenderer.invoke('keychain:get', key),
  keychainDelete: (key: string) => ipcRenderer.invoke('keychain:delete', key),
  fetchUrlMetadata: (url: string) => ipcRenderer.invoke('action:fetchUrlMetadata', url),
  mcpGetToken: () => ipcRenderer.invoke('mcp:getToken'),
  
  // ── 로컬 터미널 / 콘솔 커맨드 ──
  executeTerminal: (cmd: string, cwd?: string) => ipcRenderer.invoke('terminal:execute', cmd, cwd),
})
