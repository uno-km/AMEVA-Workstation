import { useCallback } from 'react'
import type { AIMessage } from '../../../types/aiTypes'

export function useAddMessages(setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void) {
  return useCallback((
    userMsg: AIMessage,
    assistantId: string,
    originalText?: string,
    blockId?: string
  ): void => {
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      originalText,
      diffState: originalText ? 'pending' : undefined,
      blockId,
      reasoningTrace: [],
      finalAnswer: undefined,
      reasoningStatus: undefined
    }

    setMessages((prev) => [
      ...prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
      userMsg,
      assistantMsg
    ])
  }, [setMessages])
}
