import type {
  LLMGenerateParams,
  LLMGenerateResult,
  LLMDoneEventData,
  LLMLogEventData,
  ModelInfo,
  HealthCheckResult,
  ModelImportResult,
  ModelDownloadProgressEvent
} from '../ipcTypes'

export async function llmGenerate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API not available' }
  }
  return window.electronAPI.llmGenerate(params)
}

export function llmAbort(sessionId: string): void {
  if (!window.electronAPI) return
  window.electronAPI.llmAbort(sessionId)
}

export function onLLMToken(sessionId: string, callback: (token: string) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMToken(sessionId, callback)
}

export function onLLMDone(sessionId: string, callback: (data: LLMDoneEventData) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMDone(sessionId, callback)
}

export function onLLMLog(callback: (data: LLMLogEventData) => void): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onLLMLog(callback)
}

export async function llmGetLogs(): Promise<string> {
  if (!window.electronAPI?.llmGetLogs) return ''
  try {
    return await window.electronAPI.llmGetLogs()
  } catch (e) {
    console.error('[llmGetLogs] 로그 조회 실패:', e)
    return ''
  }
}

export function llmAddLog(data: LLMLogEventData): void {
  if (!window.electronAPI?.llmAddLog) return
  window.electronAPI.llmAddLog(data)
}

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

export async function llmListModels(type?: string): Promise<ModelInfo[]> {
  if (!window.electronAPI) return []
  try {
    return await window.electronAPI.llmListModels(type)
  } catch (e) {
    console.error('[llmListModels] 모델 목록 조회 실패:', e)
    return []
  }
}

export async function llmImportModel(sourcePath: string): Promise<ModelImportResult> {
  if (!window.electronAPI) return { success: false, error: 'API not available' }
  return window.electronAPI.llmImportModel(sourcePath)
}

export function onModelDownloadProgress(callback: (data: ModelDownloadProgressEvent) => void): () => void {
  if (!window.electronAPI?.onModelDownloadProgress) return () => {}
  return window.electronAPI.onModelDownloadProgress(callback)
}

export async function llmDownloadModel(payload: { url: string; filename: string; type?: 'llm' | 'code' }): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmDownloadModel) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmDownloadModel(payload)
}

export function onLLMDownloadProgress(callback: (data: ModelDownloadProgressEvent) => void): () => void {
  if (!window.electronAPI?.onLLMDownloadProgress) return () => {}
  return window.electronAPI.onLLMDownloadProgress(callback)
}

export async function llmRestart(): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmRestart) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmRestart()
}

export async function llmStart(modelPath: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmStart) {
    return { success: false, error: 'API not available' }
  }
  return window.electronAPI.llmStart(modelPath)
}

export async function llmStop(): Promise<void> {
  if (!window.electronAPI?.llmStop) return
  return window.electronAPI.llmStop()
}

export async function llmGetGpuName(): Promise<string> {
  if (!window.electronAPI?.llmGetGpuName) return ''
  return window.electronAPI.llmGetGpuName()
}
