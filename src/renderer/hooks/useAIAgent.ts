/**
 * useAIAgent.ts (Refactored Facade)
 *
 * AI 에이전트 훅 파사드 (Facade Pattern).
 * 이 훅은 세부 구현 훅들을 조합하여 UI 컴포넌트에 단일 진입점을 제공한다.
 */

import { useRef, useCallback, useEffect } from 'react'
import { useAIState } from '../stores/useAIState'
import { useAILogStore } from '../stores/useAILogStore'
import { useAIIpc } from './ai/useAIIpc'
import { useAIStreamProcessor } from './ai/useAIStreamProcessor'
import { useAIMessageState } from './ai/useAIMessageState'
import { useAIQueue } from './ai/useAIQueue'
import { useAIEngineLogs } from './ai/useAIEngineLogs'
import * as ipc from '../services/ipc/electronApiAdapter'

// Extracted Hooks
import { useAIModels } from './ai/useAIModels'
import { useAIHealthCheck } from './ai/useAIHealthCheck'
import { useAIBlockProcessor } from './ai/useAIBlockProcessor'
import { useAIResponseHandler } from './ai/useAIResponseHandler'
import { useAIGenerator } from './ai/useAIGenerator'

export function useAIAgent() {
  const {
    isGenerating,
    setIsGenerating: _setIsGenerating,
    isAvailable,
    setIsAvailable,
    models,
    setModels,
    codeModels,
    setCodeModels,
    settings,
    updateSettings
  } = useAIState()
  
  const isGeneratingRef = useRef(false)
  const setIsGenerating = useCallback((val: boolean) => {
    _setIsGenerating(val)
    isGeneratingRef.current = val
  }, [_setIsGenerating])

  const { engineLogs, setEngineLogs } = useAIEngineLogs()
  const { subscribeSession, unsubscribeSession } = useAIIpc()

  
  const {
    rawAccumRef,
    currentAssistantIdRef,
    currentSessionIdRef,
    resetSession,
    processToken,
    finalize
  } = useAIStreamProcessor()

  const {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  } = useAIMessageState()

  const {
    pendingQueue,
    removeFromQueue,
    enqueue,
    checkAndProcessNextQueue,
    clearQueue
  } = useAIQueue(isGeneratingRef)

  const { setMessages, setStreamingText } = useAILogStore()
  const editorRef = useRef<any>(null)
  const processNextQueueRef = useRef<(() => void) | null>(null)

  const setSettings = useCallback((updater: any) => {
    const next = typeof updater === 'function' ? updater(settings) : updater
    updateSettings(next)
  }, [settings, updateSettings])

  const { refreshModels } = useAIModels(settings, setSettings, setModels, setCodeModels, setIsAvailable)
  useAIHealthCheck(settings, setIsAvailable)
  
  const { handleDone } = useAIResponseHandler(
    currentSessionIdRef,
    currentAssistantIdRef,
    rawAccumRef,
    finalize,
    finalizeAssistantMessage,
    unsubscribeSession,
    editorRef,
    processNextQueueRef
  )

  const { generateResponse } = useAIGenerator(
    settings,
    messages,
    isGeneratingRef,
    enqueue,
    setIsGenerating,
    setMessages,
    setStreamingText,
    resetSession,
    addUserAndAssistantMessages,
    processToken,
    subscribeSession,
    setEngineLogs,
    handleDone,
    editorRef,
    processNextQueueRef,
    currentAssistantIdRef
  )

  useEffect(() => {
    processNextQueueRef.current = () => checkAndProcessNextQueue(generateResponse)
  }, [checkAndProcessNextQueue, generateResponse])

  const abortGeneration = useCallback(() => {
    clearQueue()
    setMessages(useAILogStore.getState().messages.filter((m) => !m.id.startsWith('msg_queue_')))
    if (!ipc.isElectronEnv() || !isGenerating) return
    const currentSessionId = currentSessionIdRef.current || 'default'
    ipc.llmAbort(currentSessionId)
  }, [isGenerating, clearQueue, setMessages, currentSessionIdRef])

  const clearHistory = useCallback(() => {
    setMessages([])
    setStreamingText('')
  }, [setMessages, setStreamingText])

  const { processBlock } = useAIBlockProcessor(settings)

  const handleUpdateMessageDiffState = useCallback((msgId: string, state: 'accepted' | 'rejected') => {
    updateMessageDiffState(msgId, state, () => processNextQueueRef.current?.())
  }, [updateMessageDiffState])

  const handleUpdateInsertSuggestionStatus = useCallback((
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number
  ) => {
    updateInsertSuggestionStatus(
      msgId, status, newAfterBlockId, newSiblingIndex, suggestionIndex,
      () => processNextQueueRef.current?.()
    )
  }, [updateInsertSuggestionStatus])

  return {
    messages,
    isGenerating,
    isAvailable,
    models,
    codeModels,
    settings,
    streamingText: useAILogStore((s) => s.streamingText),
    engineLogs,
    setEngineLogs,
    generateResponse,
    processBlock,
    abortGeneration,
    clearHistory,
    updateSettings,
    updateMessageDiffState: handleUpdateMessageDiffState,
    updateInsertSuggestionStatus: handleUpdateInsertSuggestionStatus,
    pendingQueue,
    removeFromQueue,
    refreshModels
  }
}