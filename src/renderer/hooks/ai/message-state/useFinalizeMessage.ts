import { useCallback } from 'react'
import type { AIMessage, InsertSuggestion } from '../../../types/aiTypes'
import type { ReasoningTraceEvent } from '../../../../shared/reasoningTypes'
import { isAbortError as checkAbortError } from '../../../services/ai/cleanAIResponse'

export function useFinalizeMessage(
  setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void,
  setStreamingText: (val: string) => void,
  setIsGenerating: (val: boolean) => void
) {
  return useCallback((params: {
    targetId: string | null
    sanitizeResult: { finalContent: string; thinkingContent?: string; hadInternalTags: boolean }
    rawForEdit: string
    success: boolean
    error?: string
    editSuggestion: { blockId: string; proposedText: string; cleanContent: string } | null
    insertSuggestions: InsertSuggestion[]
  }) => {
    const { targetId, sanitizeResult, rawForEdit: _rawForEdit, success, error, editSuggestion, insertSuggestions } = params

    setIsGenerating(false)
    setStreamingText('')

    setMessages((prev) => {
      let updated = false
      const next = prev.map((m) => {
        if (targetId && m.id === targetId) {
          updated = true
          const isAbort = checkAbortError(error)

          let cleanContent: string
          if (!success) {
            cleanContent = isAbort
              ? (sanitizeResult.finalContent.trim() || m.content || '사용자가 답변을 중단했습니다')
              : (error || '오류가 발생했습니다.')
          } else {
            cleanContent = sanitizeResult.finalContent
          }

          const finalTrace: ReasoningTraceEvent[] = sanitizeResult.thinkingContent
            ? [{
                id: `trace_final_${m.id}`,
                source: 'model' as const,
                type: 'thinking' as const,
                text: sanitizeResult.thinkingContent,
                model: 'streaming',
                timestamp: new Date().toISOString()
              }]
            : (m.reasoningTrace ?? [])

          return {
            ...m,
            isStreaming: false,
            error: !success && !isAbort,
            aborted: isAbort || m.aborted,
            content: cleanContent,
            finalAnswer: success ? sanitizeResult.finalContent : undefined,
            reasoningTrace: finalTrace,
            reasoningStatus: sanitizeResult.hadInternalTags ? 'ok' : m.reasoningStatus,
            proposedText: (success || (isAbort && cleanContent.trim()))
              ? (editSuggestion ? editSuggestion.proposedText : cleanContent)
              : undefined,
            originalText: (success || (isAbort && cleanContent.trim()))
              ? (editSuggestion ? m.originalText : m.originalText)
              : undefined,
            diffState: (editSuggestion && success) ? 'pending' : m.diffState,
            blockId: editSuggestion ? editSuggestion.blockId : m.blockId,
            insertSuggestion: success ? insertSuggestions[0] : undefined,
            insertSuggestions: success ? insertSuggestions : undefined
          }
        }
        return m
      })

      if (!updated && next.length > 0 && next[next.length - 1].role === 'assistant') {
        const lastIdx = next.length - 1
        const lastMsg = next[lastIdx]
        const isAbort = checkAbortError(error)

        let cleanContent: string
        if (!success) {
          cleanContent = isAbort
            ? (sanitizeResult.finalContent.trim() || lastMsg.content || '사용자가 답변을 중단했습니다')
            : (error || '오류가 발생했습니다.')
        } else {
          cleanContent = sanitizeResult.finalContent
        }

        next[lastIdx] = {
          ...lastMsg,
          isStreaming: false,
          error: !success && !isAbort,
          aborted: isAbort || lastMsg.aborted,
          content: cleanContent,
          finalAnswer: success ? sanitizeResult.finalContent : undefined,
          reasoningStatus: sanitizeResult.hadInternalTags ? 'ok' : lastMsg.reasoningStatus,
          proposedText: (success || (isAbort && cleanContent.trim())) ? cleanContent : undefined
        }
      }

      return next.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    })
  }, [setMessages, setStreamingText, setIsGenerating])
}
