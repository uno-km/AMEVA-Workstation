/**
 * @file preload.ts
 * @system AMEVA OS Desktop Workstation - Preload Layer
 * @location src/main/preload.ts
 * @role Electron Main-Renderer IPC Context Bridge Exposer
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 렌더러 프로세스(클라이언트)가 브라우저 샌드박스를 우회하여 OS 네이티브 기능에 직접 접근하는 것을 가드한다.
 * - `contextBridge.exposeInMainWorld('electronAPI', ...)`를 호출하여, 오직 안전하게 인가된 API 핸들러들만 `window.electronAPI` 객체로 노출한다.
 * - 파일 저장/열기, PDF 출력, 협업 서버, 파이썬 실행, 줌 조절, LLM/STT 엔진, MCP 프록시, 키체인 암호화 및 터미널 구동 채널을 연계 매핑한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 리스너 구독 등록 함수(`onServerStatus`, `onLLMToken` 등)는 렌더러 컴포넌트 마운트 해제 시 리스너가 중첩 등록되지 않도록,
 *   반드시 제거 콜백(`() => ipcRenderer.removeListener(...)`)을 반환하는 클린업 계약을 유지할 것.
 * - MUST NOT expose raw ipcRenderer: 렌더러가 임의의 악성 IPC 메시지를 마음대로 보내는 것을 방지하기 위해,
 *   절대 `ipcRenderer` 객체 본체를 날것 그대로(raw) expose하지 말고 래퍼 캡슐화 규칙을 고수할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - contextBridge: window 전역 네임스페이스 격리 통로 제공자.
 * - ipcRenderer: 렌더러에서 메인으로 메시지를 전송/감청하는 커널 모듈.
 */
import { contextBridge, ipcRenderer } from 'electron'

// 렌더러 전역 객체 window.electronAPI 에 바인딩 기입
contextBridge.exposeInMainWorld('electronAPI', {
  // ── 파일 시스템 연동 ──
  // 다이얼로그 파일 열기
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  // 지정 경로 파일 직접 읽기 지원
  readFromPath: (path: string) => ipcRenderer.invoke('file:readFromPath', path),
  // 파일 수동 저장
  saveFile: (content: string, filePath?: string) => ipcRenderer.invoke('dialog:saveFile', content, filePath),
  // 다른 이름으로 저장
  saveFileAs: (content: string, filePath?: string) => ipcRenderer.invoke('dialog:saveFile', content, filePath, true),
  // 내보낸 오피스 파일 이진 쓰기 저장
  saveExportedFile: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:saveExportedFile', data, isBase64, defaultName, filters),
  // 단일 로컬 파일 경로 선택 바인딩
  selectLocalFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:selectLocalFile', filters),
  // 확인 경고 다이얼로그 띄우기
  showMessageBox: (options: any) => ipcRenderer.invoke('dialog:showMessageBox', options),
  // [FEAT-PPTX-COMPILER] PPTX 파일을 백엔드 파이썬 서비스를 이용해 슬라이드 PNG 시퀀스로 변환하는 API
  processPptx: (pptxPath: string) => ipcRenderer.invoke('pptx:process', pptxPath),
  // [FEAT-BINARY-IO] 대용량 미디어를 .adc로 묶거나 복원할 때 바이너리 데이터를 안전하게 교환하기 위한 읽기 API
  readBinary: (targetPath: string) => ipcRenderer.invoke('file:readBinary', targetPath),
  // [FEAT-BINARY-IO] 대용량 미디어를 .adc로 묶거나 복원할 때 바이너리 데이터를 안전하게 교환하기 위한 쓰기 API
  writeBinary: (targetPath: string, base64Content: string) => ipcRenderer.invoke('file:writeBinary', targetPath, base64Content),

  // ── PDF 출력 ──
  // 크로미움 headless 엔진 PDF 렌더러
  printToPDF: (htmlContent: string) => ipcRenderer.invoke('action:printToPDF', htmlContent),

  // ── 로컬 협업 서버 제어 ──
  // y-websocket 중계 로컬 서버 가동
  startCollaborationServer: (port: number) => ipcRenderer.invoke('server:start', port),
  // 로컬 서버 정지
  stopCollaborationServer: () => ipcRenderer.invoke('server:stop'),
  // 내장 협업 서버 오픈 포트 및 에러 상태 뱃지 전파 채널
  onServerStatus: (callback: (status: { running: boolean; port?: number; error?: string }) => void) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `subscription`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const subscription = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const subscription = (_event: any, status: any) => callback(status)
    ipcRenderer.on('server:status', subscription)
    return () => ipcRenderer.removeListener('server:status', subscription)
  },

  // ── 파이썬 로컬 실행 ──
  // 주피터 블록 내 python 실행 바이너리 기동
  runPythonCode: (code: string) => ipcRenderer.invoke('runtime:runPython', code),

  // ── 창 줌 컨트롤 ──
  // 윈도우 에디터 줌 세팅
  setZoomLevel: (level: number) => ipcRenderer.send('window:setZoom', level),
  // 줌 취득
  getZoomLevel: () => ipcRenderer.invoke('window:getZoom'),

  // ── 브라우저 원생 줄 (webFrame) ──
  // 사이드바, 로그 패널 포함 UI 배율 변환
  setZoomFactor: (factor: number) => ipcRenderer.send('window:setZoomFactor', factor),
  getZoomFactor: () => ipcRenderer.invoke('window:getZoomFactor'),

  // ── OS 파일 연결 및 인자 수신 채널 ──
  // OS 상에서 .md 파일을 더블클릭 기동했을 때 열린 경로와 텍스트 리매핑 수신 채널
  onFileOpenArgv: (callback: (event: any, file: { content: string; filePath: string }) => void) => {
    ipcRenderer.on('file:open-argv', callback)
    return () => ipcRenderer.removeListener('file:open-argv', callback)
  },

  // ── 외부 링크 기본 브라우저 실행 ──
  // 외부 http/https 링크 클릭 시 크롬/엣지 기본 웹 브라우저로 띄우기
  openExternalLink: (url: string) => ipcRenderer.send('action:openExternal', url),

  // ── 앱 종료 및 새 창 ──
  // 앱 닫기 (will-quit 유발)
  closeApp: () => ipcRenderer.send('window:close'),
  // 가드 없이 강제 프로세스 종료
  forceCloseApp: () => ipcRenderer.send('window:force-close'),
  // 다중 편집 새 창 띄우기
  newWindow: () => ipcRenderer.send('window:new-window'),

  // ── 🤖 로컬 LLM (llama.cpp) ──
  // [FIX-IPC-001] 로컬 GGUF 파일 또는 클라우드 API 생성
  llmGenerate: (payload: {
    sessionId: string
    modelPath: string
    prompt: string
    context?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
    contextSize?: number
    apiType?: 'local' | 'api'
    apiKey?: string
    apiEndpoint?: string
    apiModel?: string
    gpuOnly?: boolean
    history?: { role: string; content: string }[]
  }) => ipcRenderer.invoke('llm:generate', payload),

  // 세션 진행 중인 AI 대답 강제 낙
  llmAbort: (sessionId: string) => ipcRenderer.send(`llm:abort:${sessionId}`),
  // 로컬 Llama CLI 서버 백그라운드 기동
  llmStart: (modelPath: string) => ipcRenderer.invoke('llm:start', modelPath),
  // Llama CLI 서버 중지
  llmStop: () => ipcRenderer.invoke('llm:stop'),

  // 동적 토큰 전달 리스너
  onLLMToken: (sessionId: string, callback: (token: string) => void) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `subscription`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const subscription = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const subscription = (_event: any, data: { token: string }) => callback(data.token)
    ipcRenderer.on(`llm:token:${sessionId}`, subscription)
    return () => ipcRenderer.removeListener(`llm:token:${sessionId}`, subscription)
  },

  // LLM 마감 종료 수신 리스너
  onLLMDone: (sessionId: string, callback: (data: { success: boolean; fullText?: string; error?: string }) => void) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `subscription`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const subscription = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on(`llm:done:${sessionId}`, subscription)
    return () => ipcRenderer.removeListener(`llm:done:${sessionId}`, subscription)
  },

  // llama cli 프로세스 콘솔 로그 스트리밍 수신 리스너
  onLLMLog: (callback: (data: { text: string }) => void) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `subscription`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const subscription = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const subscription = (_event: any, data: { text: string }) => callback(data)
    ipcRenderer.on('llm:log', subscription)
    return () => ipcRenderer.removeListener('llm:log', subscription)
  },

  // 콘솔 로그 수동 기록
  llmAddLog: (payload: { text: string; prefix?: string }) => ipcRenderer.send('llm:add-log', payload),
  // 기록된 모든 llama cli 로그 어레이 취득
  llmGetLogs: () => ipcRenderer.invoke('llm:get-logs'),

  // 8080 추론 엔진 헬스 상태 검정
  llmCheckHealth: () => ipcRenderer.invoke('llm:check-health'),
  // 추론 엔진 프로세스 완전 재시작
  llmRestart: () => ipcRenderer.invoke('llm:restart'),

  // 로컬 기기에 다운로드 되어 적재된 gguf 목록 리스트업
  llmListModels: (type?: 'llm' | 'code' | 'ollama') => ipcRenderer.invoke('llm:listModels', type),
  // 사용 중인 NVIDIA / Intel GPU 하드웨어 정보 문자열 취득
  llmGetGpuName: () => ipcRenderer.invoke('llm:getGpuName'),
  // 허깅페이스 등 외부 모델 파일 다이렉트 백그라운드 다운로드
  llmDownloadModel: (payload: { url: string; filename: string; type?: 'llm' | 'code' }) => ipcRenderer.invoke('llm:downloadModel', payload),
  // 실시간 다운로드 속도 및 용량 수신 리스너
  onLLMDownloadProgress: (callback: (status: any) => void) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `subscription`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const subscription = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const subscription = (_event: any, status: any) => callback(status)
    ipcRenderer.on('llm:download-progress', subscription)
    return () => ipcRenderer.removeListener('llm:download-progress', subscription)
  },
  // 디바이스 내gguf 파일 아메바 모델 폴더로 파일 복사 임포트
  llmImportModel: (sourcePath: string, type?: 'llm' | 'code') => ipcRenderer.invoke('llm:importModel', sourcePath, type),

  // ── 🎤 Whisper STT ──
  // 오디오 파일의 Whisper AI 한국어 텍스트 변환 기동
  sttTranscribe: (payload: { audioPath: string; language?: string }) =>
    ipcRenderer.invoke('stt:transcribe', payload),

  // 임시 음성 녹음 캐시 디렉터리 취득
  sttGetTempPath: () => ipcRenderer.invoke('stt:getTempPath'),

  // 오프라인/일렉트론 오피스 문서 변환기 호출
  exportConvert: (payload: { blocks: any; format: string; defaultName: string }) =>
    ipcRenderer.invoke('export:convert', payload),
  // 렌더러 로딩 완료 시그널 전송
  appReady: () => ipcRenderer.invoke('app:ready'),
  // MCP 서버 및 시스템 명령 수행 시 구글 웹 서칭
  webSearch: (query: string) => ipcRenderer.invoke('action:webSearch', query),
  // 클립보드에 이미지 쓰기 (Base64 Data URL)
  clipboardWriteImage: (dataUrl: string) => ipcRenderer.invoke('clipboard:write-image', dataUrl),

  // ── 🤖 동적 MCP 연동 브릿지 ──
  // 외부 MCP 도구 자식 프로세스 기동
  mcpSpawn: (serverId: string, command: string, args: string[]) => ipcRenderer.invoke('mcp:spawn', serverId, command, args),
  // JSON-RPC를 통한 MCP 리소스/도구 요청 발송
  mcpCall: (serverId: string, request: any) => ipcRenderer.invoke('mcp:call', serverId, request),
  // MCP 자식 프로세스 taskkill 종료
  mcpKill: (serverId: string) => ipcRenderer.invoke('mcp:kill', serverId),
  // 요금제 웰컴 스크린 무과금 검정
  isFreeMode: () => ipcRenderer.invoke('llm:is-free-mode'),
  // 멤버십 등급 조회
  planGetStatus: () => ipcRenderer.invoke('plan:get-status'),
  // 멤버십 변경 설정
  planSetStatus: (isPro: boolean) => ipcRenderer.invoke('plan:set-status', isPro),

  // 🔐 OS Keychain (safeStorage) 자격 증명 연동
  // 암호화 API 키 안전 보관소 기입
  keychainSet: (key: string, value: string) => ipcRenderer.invoke('keychain:set', key, value),
  // 안전 키 복구 취득
  keychainGet: (key: string) => ipcRenderer.invoke('keychain:get', key),
  // 키체인 삭제
  keychainDelete: (key: string) => ipcRenderer.invoke('keychain:delete', key),
  // 웹 블록 링크용 프리뷰 metadata 추출
  fetchUrlMetadata: (url: string) => ipcRenderer.invoke('action:fetchUrlMetadata', url),
  // [SEC-W-009] 중계 세션 토큰 취득
  mcpGetToken: () => ipcRenderer.invoke('mcp:getToken'),
  
  // ── 로컬 터미널 / 콘솔 커맨드 ──
  // ReAct 에이전트 및 블록 코드 실행용 호스트 터미널 (PowerShell UTF-8) 구동
  executeTerminal: (cmd: string, cwd?: string) => ipcRenderer.invoke('terminal:execute', cmd, cwd),

  // ── 📈 Finance 주식/지수/환율 데이터 조회 ──
  // [FIX-FINANCE-001] 렌더러의 CORS 제약을 우회하기 위해 메인 프로세스로 조회를 위임한다.
  // - 소비처: src/renderer/components/ai/FinanceDashboardView.tsx
  getFinanceQuotes: (symbols: string[]) =>
    ipcRenderer.invoke('finance:get-quotes', symbols),

  // ── 🦙 Ollama 로컬 AI 엔진 라이프사이클 관리 ──
  // [FEAT-OLLAMA-001] 설치 여부 확인 → 서버 기동 → 모델 다운로드 자동화 브릿지.
  // - 소비처: src/renderer/components/settings/SettingsTabAIEngine.tsx

  // Ollama CLI 바이너리 설치 여부 진단 (where/which 명령어 기반)
  checkOllamaInstalled: () =>
    ipcRenderer.invoke('ollama:check-installed'),

  // ollama serve 백그라운드 detached 기동 후 헬스체크 결과 반환
  startOllamaServer: () =>
    ipcRenderer.invoke('ollama:start-server'),

  // ollama pull <modelName> 실행 (완료 시 { success, error? } 반환)
  pullOllamaModel: (modelName: string) =>
    ipcRenderer.invoke('ollama:pull-model', modelName),

  // 메인 프로세스 대행 Ollama 헬스 체크
  checkOllamaHealth: () =>
    ipcRenderer.invoke('ollama:check-health'),

  // Ollama pull 실시간 진행률 수신 리스너 (percent, text 스트리밍)
  onOllamaPullProgress: (callback: (data: { modelName: string; percent: number; text: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { modelName: string; percent: number; text: string }) => callback(data)
    ipcRenderer.on('ollama:pull-progress', subscription)
    return () => ipcRenderer.removeListener('ollama:pull-progress', subscription)
  },

  // ── 🌐 Google OAuth 2.0 & Google Drive ──
  googleAuthLogin: (connectDrive: boolean) => ipcRenderer.invoke('google-auth:login', connectDrive),
  googleAuthLogout: () => ipcRenderer.invoke('google-auth:logout'),
  googleAuthGetStatus: () => ipcRenderer.invoke('google-auth:get-status'),
  setBypassNativeContextMenu: (bypass: boolean) => ipcRenderer.send('set-bypass-native-context-menu', bypass),

  // ── Workbench IPC (AMEVA OS OS/Native Adapter) ──
  workbench: {
    registerSession: (request: any) => ipcRenderer.invoke('workbench:registerSession', request),
    executeCommand: (request: any) => ipcRenderer.invoke('workbench:executeCommand', request),
    cancelCommand: (commandId: string) => ipcRenderer.invoke('workbench:cancelCommand', commandId),
    createSnapshot: (request: any) => ipcRenderer.invoke('workbench:createSnapshot', request),
    cleanupWorkspace: (request: any) => ipcRenderer.invoke('workbench:cleanupWorkspace', request),
    inspectWorkspace: (request: any) => ipcRenderer.invoke('workbench:inspectWorkspace', request),
    closeSession: (request: any) => ipcRenderer.invoke('workbench:closeSession', request),
  }
})
