import type { ReasoningTraceEvent } from '../../shared/reasoningTypes'

export interface InsertSuggestion {
  afterBlockId: string
  blockType: 'heading' | 'paragraph' | 'bulletListItem' | 'numberedListItem' | 'table'
  level?: 1 | 2 | 3
  content: string
  reasonText?: string
  status: 'pending' | 'accepted' | 'rejected'
  siblingBlockIds?: string[]
  siblingIndex?: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  error?: boolean
  aborted?: boolean
  taggedBlocks?: { id: string; text: string }[]
  originalText?: string
  proposedText?: string
  diffState?: 'pending' | 'accepted' | 'rejected'
  blockId?: string
  insertSuggestion?: InsertSuggestion
  insertSuggestions?: InsertSuggestion[]
  reasoningTraces?: ReasoningTraceEvent[]
  isReasoningCollapsed?: boolean
  isThinking?: boolean
}

export interface AISettings {
  modelPath: string
  codeModelPath?: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  apiType?: 'local' | 'api' | 'wasm' | 'ollama'
  apiKey?: string
  apiEndpoint?: string
  apiModel?: string
  gpuOnly?: boolean
}

export const DEFAULT_SETTINGS: AISettings = {
  modelPath: 'C:\\ameva\\models\\llm\\qwen2.5-3b-instruct-q4_k_m.gguf',
  codeModelPath: '',
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: `당신은 AMEVA 문서 에디터에 내장된 AI 문서 편집 에이전트입니다.`,
  apiType: 'local',
  gpuOnly: true
}
