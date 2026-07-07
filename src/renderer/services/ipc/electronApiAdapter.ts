/**
 * electronApiAdapter.ts
 *
 * window.electronAPI에 대한 단일 접근 지점 (Single Point of Access).
 *
 * 이 파일은 프로젝트 전체에서 window.electronAPI를 직접 접근하는 유일한 파일이다.
 * 다른 어떠한 파일에서도 window.electronAPI를 직접 참조해서는 안 된다.
 * 모든 Electron IPC 통신은 이 어댑터를 통해서만 이루어진다.
 *
 * [설계 원칙]
 * 1. 이 파일은 렌더러 프로세스(브라우저 환경)에서만 실행된다.
 * 2. window.electronAPI가 없는 환경(개발용 브라우저)에서는 undefined를 반환하는 안전한 no-op 래퍼를 제공한다.
 * 3. 각 메서드는 window.electronAPI의 존재 여부를 먼저 확인한다.
 */

import type {
  LLMGenerateParams,
  LLMGenerateResult,
  LLMDoneEventData,
  LLMLogEventData,
  ModelInfo,
  UrlMetadata,
  FileOpenEventData,
  HealthCheckResult,
  ModelImportResult,
  ModelDownloadProgressEvent,
  ExportProgressEvent
} from './ipcTypes'

/** window.electronAPI 타입 선언 (기존 preload.ts 정의와 호환) */
declare global {
  interface Window {
    electronAPI?: {
      // LLM 생성
      llmGenerate: (params: LLMGenerateParams) => Promise<LLMGenerateResult>
      llmAbort: (sessionId: string) => void
      llmStart: (modelPath: string) => Promise<{ success: boolean; error?: string }>
      llmStop: () => Promise<void>
      llmCheckHealth: () => Promise<HealthCheckResult>
      llmListModels: (type?: string) => Promise<ModelInfo[]>
      llmImportModel: (sourcePath: string) => Promise<ModelImportResult>
      llmGetLogs: () => Promise<string>
      llmAddLog: (data: LLMLogEventData) => void
      // LLM 이벤트 리스너
      onLLMToken: (sessionId: string, callback: (token: string) => void) => () => void
      onLLMDone: (sessionId: string, callback: (data: LLMDoneEventData) => void) => () => void
      onLLMLog: (callback: (data: LLMLogEventData) => void) => () => void
      onModelDownloadProgress: (callback: (data: ModelDownloadProgressEvent) => void) => () => void
      // 파일 시스템
      openFile: () => Promise<FileOpenEventData | null>
      saveFile: (content: string, filePath?: string | null) => Promise<{ filePath?: string; success: boolean }>
      saveFileAs: (content: string, filePath?: string | null) => Promise<{ filePath?: string; success: boolean }>
      selectLocalFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<{ filePath: string; base64: string } | null>
      onFileOpenArgv: (callback: (event: any, file: FileOpenEventData) => void) => () => void
      fetchUrlMetadata: (url: string) => Promise<UrlMetadata>
      openExternalLink: (url: string) => void
      // 앱
      appReady: () => void
      appMinimize?: () => void
      appMaximize?: () => void
      appClose?: () => void
      // 창 줌
      getZoomFactor?: () => Promise<number>
      setZoomFactor?: (factor: number) => void
      // 시스템 다이얼로그
      showMessageBox?: (options: any) => Promise<{ response: number }>
      // OS 키체인 (API Key 암호화 저장)
      keychainGet?: (key: string) => Promise<string | null>
      keychainSet?: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
      keychainDelete?: (key: string) => Promise<{ success: boolean; error?: string }>
      // GPU
      llmGetGpuName?: () => Promise<string>
      llmRestart?: () => Promise<{ success: boolean; error?: string }>
      // 모델 다운로드 (허브 통합)
      llmDownloadModel?: (payload: { url: string; filename: string; type?: 'llm' | 'code' }) => Promise<{ success: boolean; error?: string }>
      onLLMDownloadProgress?: (callback: (data: any) => void) => () => void
      // 플랜/구독
      planGetStatus?: () => Promise<boolean>
      planSetStatus?: (isPro: boolean) => Promise<{ success: boolean; isPro?: boolean; error?: string }>
      isFreeMode?: () => Promise<boolean>
      // MCP
      getMcpServers?: () => Promise<any[]>
      mcpSpawn?: (serverId: string, command: string, args: string[]) => Promise<any>
      mcpCall?: (serverId: string, request: any) => Promise<any>
      mcpKill?: (serverId: string) => Promise<any>
      mcpGetToken?: () => Promise<string | null>
      // 내보내기
      onExportProgress?: (callback: (data: ExportProgressEvent) => void) => () => void
      printToPDF?: (htmlContent: string) => Promise<string | null>
      newWindow?: () => void
      closeApp?: () => void
      saveExportedFile?: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>
      exportConvert?: (payload: { blocks: any[]; format: string; defaultName: string }) => Promise<{ success: boolean; savedPath?: string; error?: string }>
      runPythonCode?: (code: string) => Promise<{ success: boolean; result?: string; error?: string }>
      webSearch?: (query: string) => Promise<any>
      // 협업 서버
      onServerStatus?: (callback: (status: any) => void) => () => void
      startCollaborationServer?: (port: number) => Promise<any>
      stopCollaborationServer?: () => Promise<any>
      // 다운로드 (구형 API 호환)
      startModelDownload?: (params: any) => Promise<any>
      cancelModelDownload?: (modelId: string) => Promise<any>
      getDownloadStatus?: (modelId: string) => Promise<any>
    }
  }
}


// ──────────────────────────────────────────────
// LLM 관련 어댑터 메서드
// ──────────────────────────────────────────────

/**
 * isElectronEnv
 * 현재 Electron 환경에서 실행 중인지 확인한다.
 *
 * @returns true if running inside Electron with electronAPI available
 */
export function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * llmGenerate
 * LLM 텍스트 생성을 요청한다.
 * window.electronAPI가 없으면 실패 결과를 즉시 반환한다.
 */
export async function llmGenerate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' }
  }
  return window.electronAPI.llmGenerate(params)
}

/**
 * llmAbort
 * 진행 중인 LLM 생성 세션을 중단한다.
 */
export function llmAbort(sessionId: string): void {
  if (!window.electronAPI) return
  window.electronAPI.llmAbort(sessionId)
}

/**
 * onLLMToken
 * 지정된 세션의 스트리밍 토큰 이벤트를 구독한다.
 *
 * @returns unsubscribe 함수
 */
export function onLLMToken(sessionId: string, callback: (token: string) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMToken(sessionId, callback)
}

/**
 * onLLMDone
 * 지정된 세션의 생성 완료 이벤트를 구독한다.
 *
 * @returns unsubscribe 함수
 */
export function onLLMDone(sessionId: string, callback: (data: LLMDoneEventData) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMDone(sessionId, callback)
}

/**
 * onLLMLog
 * 메인 프로세스 LLM 로그 이벤트를 구독한다.
 *
 * @returns unsubscribe 함수
 */
export function onLLMLog(callback: (data: LLMLogEventData) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMLog(callback)
}

/**
 * llmGetLogs
 * 누락된 초기 LLM 로그를 한 번에 불러온다.
 */
export async function llmGetLogs(): Promise<string> {
  if (!window.electronAPI?.llmGetLogs) return ''
  try {
    return await window.electronAPI.llmGetLogs()
  } catch (e) {
    console.error('[llmGetLogs] 로그 조회 실패:', e)
    return ''
  }
}

/**
 * llmAddLog
 * 엔진 로그 패널에 메시지를 추가한다.
 */
export function llmAddLog(data: LLMLogEventData): void {
  if (!window.electronAPI?.llmAddLog) return
  window.electronAPI.llmAddLog(data)
}

/**
 * llmCheckHealth
 * LLM 서버 헬스 상태를 확인한다.
 */
export async function llmCheckHealth(): Promise<HealthCheckResult> {
  if (!window.electronAPI?.llmCheckHealth) {
    return { status: 'error', message: 'API not available' }
  }
  try {
    return await window.electronAPI.llmCheckHealth()
  } catch (e) {
    console.error('[llmCheckHealth] 헬스 체크 실패:', e)
    return { status: 'error' }
  }
}

/**
 * llmListModels
 * 사용 가능한 모델 목록을 조회한다.
 */
export async function llmListModels(type?: string): Promise<ModelInfo[]> {
  if (!window.electronAPI) return []
  try {
    return await window.electronAPI.llmListModels(type)
  } catch (e) {
    console.error('[llmListModels] 모델 목록 조회 실패:', e)
    return []
  }
}

/**
 * llmImportModel
 * 모델 파일을 가져온다.
 */
export async function llmImportModel(sourcePath: string): Promise<ModelImportResult> {
  if (!window.electronAPI) return { success: false, error: 'API not available' }
  return window.electronAPI.llmImportModel(sourcePath)
}

/**
 * onModelDownloadProgress
 * 모델 다운로드 진행 이벤트를 구독한다.
 */
export function onModelDownloadProgress(callback: (data: ModelDownloadProgressEvent) => void): () => void {
  if (!window.electronAPI?.onModelDownloadProgress) return () => {}
  return window.electronAPI.onModelDownloadProgress(callback)
}


/**
 * keychainGet
 */
export async function keychainGet(key: string): Promise<string | null> {
  if (!window.electronAPI?.keychainGet) return null;
  return window.electronAPI.keychainGet(key);
}

/**
 * keychainSet
 */
export async function keychainSet(key: string, value: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.keychainSet) return { success: false, error: 'API not available' };
  return window.electronAPI.keychainSet(key, value);
}

/**
 * keychainDelete
 * OS 키체인에서 값을 삭제한다.
 */
export async function keychainDelete(key: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.keychainDelete) return { success: false, error: 'API not available' };
  return window.electronAPI.keychainDelete(key);
}

// ──────────────────────────────────────────────
// 파일 시스템 관련 어댑터 메서드
// ──────────────────────────────────────────────

/**
 * openFile
 * 파일 열기 다이얼로그를 표시하고 선택한 파일의 내용을 반환한다.
 */
export async function openFile(): Promise<FileOpenEventData | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.openFile()
}

/**
 * saveFile
 * 파일을 저장한다. filePath가 없으면 다이얼로그를 표시한다.
 */
export async function saveFile(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFile(content, filePath)
}

/**
 * saveFileAs
 * '다른 이름으로 저장' 다이얼로그를 표시하고 저장한다.
 */
export async function saveFileAs(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFileAs(content, filePath)
}

/**
 * selectLocalFile
 * 로컬 파일 선택 다이얼로그를 표시한다.
 */
export async function selectLocalFile(
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<{ filePath: string; base64: string } | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.selectLocalFile(filters)
}

/**
 * onFileOpenArgv
 * OS 레벨 파일 열기 인자(argv) 이벤트를 구독한다.
 */
export function onFileOpenArgv(
  callback: (event: any, file: FileOpenEventData) => void
): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onFileOpenArgv(callback)
}

/**
 * fetchUrlMetadata
 * URL의 메타데이터(제목, 설명, 이미지)를 가져온다.
 */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  if (!window.electronAPI?.fetchUrlMetadata) return {}
  try {
    return await window.electronAPI.fetchUrlMetadata(url)
  } catch (e) {
    console.error('[fetchUrlMetadata] URL 메타데이터 조회 실패:', e)
    return {}
  }
}

/**
 * openExternalLink
 * 기본 브라우저에서 외부 링크를 연다.
 */
export function openExternalLink(url: string): void {
  if (!window.electronAPI?.openExternalLink) {
    // 브라우저 환경 폴백: http(s) URL만 허용
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    return
  }
  window.electronAPI.openExternalLink(url)
}

/**
 * appReady
 * 앱 준비 완료를 메인 프로세스에 알린다.
 */
export function appReady(): void {
  if (!window.electronAPI?.appReady) return
  window.electronAPI.appReady()
}

/**
 * getMcpServers
 * 등록된 MCP 서버 목록을 조회한다.
 */
export async function getMcpServers(): Promise<any[]> {
  if (!window.electronAPI?.getMcpServers) return []
  try {
    return await window.electronAPI.getMcpServers()
  } catch (e) {
    console.error('[getMcpServers] MCP 서버 목록 조회 실패:', e)
    return []
  }
}

/**
 * llmDownloadModel
 * LLM 모델을 허브로부터 다운로드한다.
 */
export async function llmDownloadModel(payload: { url: string; filename: string; type?: 'llm' | 'code' }): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmDownloadModel) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmDownloadModel(payload)
}

/**
 * onLLMDownloadProgress
 * LLM 모델 다운로드 진행 상태 변경 이벤트를 구독한다.
 */
export function onLLMDownloadProgress(callback: (data: any) => void): () => void {
  if (!window.electronAPI?.onLLMDownloadProgress) return () => {}
  return window.electronAPI.onLLMDownloadProgress(callback)
}

/**
 * llmRestart
 * LLM 엔진을 재시작한다.
 */
export async function llmRestart(): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmRestart) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmRestart()
}


/** llmStart */
export async function llmStart(modelPath: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmStart) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmStart(modelPath)
}

/** llmStop */
export async function llmStop(): Promise<void> {
  if (!window.electronAPI?.llmStop) return
  return window.electronAPI.llmStop()
}


/** appMinimize */
export function appMinimize(): void {
  if (!window.electronAPI?.appMinimize) return
  window.electronAPI.appMinimize()
}

/** appMaximize */
export function appMaximize(): void {
  if (!window.electronAPI?.appMaximize) return
  window.electronAPI.appMaximize()
}

/** appClose */
export function appClose(): void {
  if (!window.electronAPI?.appClose) return
  window.electronAPI.appClose()
}

/** getZoomFactor */
export async function getZoomFactor(): Promise<number> {
  if (!window.electronAPI?.getZoomFactor) return 1.0
  return window.electronAPI.getZoomFactor()
}

/** setZoomFactor */
export function setZoomFactor(factor: number): void {
  if (!window.electronAPI?.setZoomFactor) return
  window.electronAPI.setZoomFactor(factor)
}

/** showMessageBox */
export async function showMessageBox(options: any): Promise<{ response: number }> {
  if (!window.electronAPI?.showMessageBox) return { response: 0 }
  return window.electronAPI.showMessageBox(options)
}

/** llmGetGpuName */
export async function llmGetGpuName(): Promise<string> {
  if (!window.electronAPI?.llmGetGpuName) return ''
  return window.electronAPI.llmGetGpuName()
}

/** planGetStatus */
export async function planGetStatus(): Promise<boolean> {
  if (!window.electronAPI?.planGetStatus) return false
  return window.electronAPI.planGetStatus()
}

/** planSetStatus */
export async function planSetStatus(isPro: boolean): Promise<{ success: boolean; isPro?: boolean; error?: string }> {
  if (!window.electronAPI?.planSetStatus) return { success: false, error: 'API not available' }
  return window.electronAPI.planSetStatus(isPro)
}

/** isFreeMode */
export async function isFreeMode(): Promise<boolean> {
  if (!window.electronAPI?.isFreeMode) return true
  return window.electronAPI.isFreeMode()
}

/** mcpSpawn */
export async function mcpSpawn(serverId: string, command: string, args: string[]): Promise<any> {
  if (!window.electronAPI?.mcpSpawn) return null
  return window.electronAPI.mcpSpawn(serverId, command, args)
}

/** mcpCall */
export async function mcpCall(serverId: string, request: any): Promise<any> {
  if (!window.electronAPI?.mcpCall) return null
  return window.electronAPI.mcpCall(serverId, request)
}

/** mcpKill */
export async function mcpKill(serverId: string): Promise<any> {
  if (!window.electronAPI?.mcpKill) return null
  return window.electronAPI.mcpKill(serverId)
}

/** onExportProgress */
export function onExportProgress(callback: (data: ExportProgressEvent) => void): () => void {
  if (!window.electronAPI?.onExportProgress) return () => {}
  return window.electronAPI.onExportProgress(callback)
}

/** printToPDF */
export async function printToPDF(htmlContent: string): Promise<string | null> {
  if (!window.electronAPI?.printToPDF) return null
  return window.electronAPI.printToPDF(htmlContent)
}

/** newWindow */
export function newWindow(): void {
  if (!window.electronAPI?.newWindow) return
  window.electronAPI.newWindow()
}

/** closeApp */
export function closeApp(): void {
  if (!window.electronAPI?.closeApp) return
  window.electronAPI.closeApp()
}

/** saveExportedFile */
export async function saveExportedFile(data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (!window.electronAPI?.saveExportedFile) return null
  return window.electronAPI.saveExportedFile(data, isBase64, defaultName, filters)
}

/** exportConvert */
export async function exportConvert(payload: { blocks: any[]; format: string; defaultName: string }): Promise<{ success: boolean; savedPath?: string; error?: string }> {
  if (!window.electronAPI?.exportConvert) return { success: false, error: 'API not available' }
  return window.electronAPI.exportConvert(payload)
}

/** runPythonCode */
export async function runPythonCode(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
  if (!window.electronAPI?.runPythonCode) return { success: false, error: 'API not available' }
  return window.electronAPI.runPythonCode(code)
}

/** webSearch */
export async function webSearch(query: string): Promise<any> {
  if (!window.electronAPI?.webSearch) return null
  return window.electronAPI.webSearch(query)
}

/** onServerStatus */
export function onServerStatus(callback: (status: any) => void): () => void {
  if (!window.electronAPI?.onServerStatus) return () => {}
  return window.electronAPI.onServerStatus(callback)
}

/** startCollaborationServer */
export async function startCollaborationServer(port: number): Promise<any> {
  if (!window.electronAPI?.startCollaborationServer) return null
  return window.electronAPI.startCollaborationServer(port)
}

/** stopCollaborationServer */
export async function stopCollaborationServer(): Promise<any> {
  if (!window.electronAPI?.stopCollaborationServer) return null
  return window.electronAPI.stopCollaborationServer()
}

/** startModelDownload */
export async function startModelDownload(params: any): Promise<any> {
  if (!window.electronAPI?.startModelDownload) return null
  return window.electronAPI.startModelDownload(params)
}

/** cancelModelDownload */
export async function cancelModelDownload(modelId: string): Promise<any> {
  if (!window.electronAPI?.cancelModelDownload) return null
  return window.electronAPI.cancelModelDownload(modelId)
}

/** getDownloadStatus */
export async function getDownloadStatus(modelId: string): Promise<any> {
  if (!window.electronAPI?.getDownloadStatus) return null
  return window.electronAPI.getDownloadStatus(modelId)
}

/** mcpGetToken */
export async function mcpGetToken(): Promise<string | null> {
  if (!window.electronAPI?.mcpGetToken) return null
  return window.electronAPI.mcpGetToken()
}
