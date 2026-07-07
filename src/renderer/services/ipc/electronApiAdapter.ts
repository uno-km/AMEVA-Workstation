/**
 * electronApiAdapter.ts
 *
 * window.electronAPI에 대한 단일 접근 지점 (Single Point of Access).
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
  ModelDownloadProgressEvent
} from './ipcTypes'

import type { MessageBoxOptions } from './adapters/appAdapter'
import type { MCPSpawnResult, MCPCallResponse, MCPKillResult } from './adapters/mcpAdapter'
import type { WebSearchResult } from './adapters/sandboxAdapter'
import type { CollabServerStatus, CollabServerStartResult, CollabServerStopResult } from './adapters/collabAdapter'

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
      onFileOpenArgv: (callback: (event: unknown, file: FileOpenEventData) => void) => () => void
      fetchUrlMetadata: (url: string) => Promise<UrlMetadata>
      openExternalLink: (url: string) => void
      // 앱
      appReady: () => void
      // 창 줌
      getZoomFactor?: () => Promise<number>
      setZoomFactor?: (factor: number) => void
      setZoomLevel?: (level: number) => void
      getZoomLevel?: () => Promise<number>
      // 시스템 다이얼로그
      showMessageBox?: (options: MessageBoxOptions) => Promise<{ response: number }>
      // OS 키체인
      keychainGet?: (key: string) => Promise<string | null>
      keychainSet?: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
      keychainDelete?: (key: string) => Promise<{ success: boolean; error?: string }>
      // GPU
      llmGetGpuName?: () => Promise<string>
      llmRestart?: () => Promise<{ success: boolean; error?: string }>
      // 모델 다운로드
      llmDownloadModel?: (payload: { url: string; filename: string; type?: 'llm' | 'code' }) => Promise<{ success: boolean; error?: string }>
      onLLMDownloadProgress?: (callback: (data: ModelDownloadProgressEvent) => void) => () => void
      // 플랜/구독
      planGetStatus?: () => Promise<boolean>
      planSetStatus?: (isPro: boolean) => Promise<{ success: boolean; isPro?: boolean; error?: string }>
      isFreeMode?: () => Promise<boolean>
      // MCP
      mcpSpawn?: (serverId: string, command: string, args: string[]) => Promise<MCPSpawnResult | null>
      mcpCall?: (serverId: string, request: Record<string, unknown>) => Promise<MCPCallResponse | null>
      mcpKill?: (serverId: string) => Promise<MCPKillResult | null>
      mcpGetToken?: () => Promise<string | null>
      // 내보내기
      onExportProgress?: (callback: (data: any) => void) => () => void
      printToPDF?: (htmlContent: string) => Promise<string | null>
      newWindow?: () => void
      closeApp?: () => void
      saveExportedFile?: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<string | null>
      exportConvert?: (payload: { blocks: Record<string, unknown>[]; format: string; defaultName: string }) => Promise<{ success: boolean; savedPath?: string; error?: string }>
      runPythonCode?: (code: string) => Promise<{ success: boolean; result?: string; error?: string }>
      webSearch?: (query: string) => Promise<WebSearchResult | null>
      // 협업 서버
      onServerStatus?: (callback: (status: CollabServerStatus) => void) => () => void
      startCollaborationServer?: (port: number) => Promise<CollabServerStartResult | null>
      stopCollaborationServer?: () => Promise<CollabServerStopResult | null>
      // STT
      sttTranscribe?: (payload: { audioPath: string; language?: string }) => Promise<{ success: boolean; text?: string; error?: string }>
      sttGetTempPath?: () => Promise<string | null>
    }
  }
}

export * from './adapters/llmAdapter'
export * from './adapters/fileAdapter'
export * from './adapters/appAdapter'
export * from './adapters/keychainAdapter'
export * from './adapters/mcpAdapter'
export * from './adapters/exportAdapter'
export * from './adapters/sandboxAdapter'
export * from './adapters/collabAdapter'
export * from './adapters/sttAdapter'
