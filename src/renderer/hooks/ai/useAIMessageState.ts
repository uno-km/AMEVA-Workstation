/**
 * useAIMessageState.ts
 *
 * AI 메시지 상태 및 고수준 메시지 조작 전담 훅.
 * useAILogStore의 메시지 배열에 대한 도메인 특화 조작 함수를 제공한다.
 *
 * [단일 책임]
 * - AI 메시지 생성 (user/assistant 메시지 추가)
 * - 생성 완료 시 메시지 최종 업데이트
 * - diffState 및 insertSuggestion 상태 업데이트
 * 스트리밍 토큰 처리나 IPC 통신은 별도 훅에서 담당한다.
 */

import { useCallback } from 'react'
import { useAILogStore } from '../../stores/useAILogStore'
import { useAIState } from '../../stores/useAIState'
import type { AIMessage, InsertSuggestion } from '../../types/aiTypes'
import type { ReasoningTraceEvent } from '../../../shared/reasoningTypes'
import { isAbortError as checkAbortError } from '../../services/ai/cleanAIResponse'

/**
 * useAIMessageState
 * AI 메시지 배열에 대한 도메인 조작 함수를 제공하는 훅.
 */
export function useAIMessageState() {
  const { messages, setMessages, setStreamingText } = useAILogStore()
  const { setIsGenerating } = useAIState()

  /**
   * addUserAndAssistantMessages
   * 사용자 메시지와 스트리밍 상태의 assistant 메시지를 동시에 추가한다.
   * 기존 스트리밍 상태인 메시지는 모두 닫고 새 메시지를 추가한다.
   *
   * @returns 생성된 assistant 메시지 ID
   */
  const addUserAndAssistantMessages = useCallback((
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

    // 이전 스트리밍 메시지 강제 닫힘 후 새 메시지 추가
    setMessages((prev) => [
      ...prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
      userMsg,
      assistantMsg
    ])
  }, [setMessages])

  /**
   * finalizeAssistantMessage
   * LLM Done 이벤트 수신 시 현재 assistant 메시지를 최종 상태로 업데이트한다.
   * EDIT_SUGGESTION, INSERT_SUGGESTION, abort 처리를 포함한다.
   */
  const finalizeAssistantMessage = useCallback((params: {
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

      // targetId를 찾지 못한 경우 마지막 assistant 메시지에 폴백 적용
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

      // 모든 스트리밍 상태 강제 해제
      return next.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    })
  }, [setMessages, setStreamingText, setIsGenerating])

  /**
   * updateMessageDiffState
   * 수정 제안의 승인/거절 상태를 업데이트하고 다음 큐를 기동한다.
   */
  const updateMessageDiffState = useCallback((
    msgId: string,
    state: 'accepted' | 'rejected',
    onResolved?: () => void
  ) => {
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === msgId ? { ...m, diffState: state } : m
      )
      if (onResolved) {
        setTimeout(onResolved, 80)
      }
      return next
    })
  }, [setMessages])

  /**
   * updateInsertSuggestionStatus
   * 삽입 제안 카드의 상태를 업데이트하고, 모든 제안이 결정되면 다음 큐를 기동한다.
   * 연속 삽입 제안의 afterBlockId 체이닝(승인된 블록 ID 승계)도 처리한다.
   */
  const updateInsertSuggestionStatus = useCallback((
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number,
    onAllResolved?: () => void
  ) => {
    setMessages((prev) => {
      let allResolved = true
      const next = prev.map((m) => {
        if (m.id !== msgId) return m

        // 1. 다중 제안 배열이 있는 경우 특정 인덱스 업데이트
        if (m.insertSuggestions && m.insertSuggestions.length > 0 && suggestionIndex !== undefined) {
          const updatedSuggestions = [...m.insertSuggestions]
          const target = updatedSuggestions[suggestionIndex]

          if (target) {
            updatedSuggestions[suggestionIndex] = {
              ...target,
              status,
              ...(newAfterBlockId !== undefined ? { afterBlockId: newAfterBlockId } : {}),
              ...(newSiblingIndex !== undefined ? { siblingIndex: newSiblingIndex } : {})
            }

            // 승인 시 이후 pending 제안들의 afterBlockId를 새로 삽입된 블록 ID로 체이닝
            if (status === 'accepted' && newAfterBlockId) {
              const oldAfterBlockId = target.afterBlockId
              for (let i = suggestionIndex + 1; i < updatedSuggestions.length; i++) {
                const pending = updatedSuggestions[i]
                if (pending.status === 'pending' && pending.afterBlockId === oldAfterBlockId) {
                  updatedSuggestions[i] = { ...pending, afterBlockId: newAfterBlockId }
                }
              }
            }
          }

          if (updatedSuggestions.some((s) => s.status === 'pending')) {
            allResolved = false
          }

          return {
            ...m,
            insertSuggestions: updatedSuggestions,
            insertSuggestion: updatedSuggestions[0]
          }
        }

        // 2. 단수형 폴백 처리
        if (!m.insertSuggestion) return m
        if (status === 'pending') allResolved = false

        return {
          ...m,
          insertSuggestion: {
            ...m.insertSuggestion,
            status,
            ...(newAfterBlockId !== undefined ? { afterBlockId: newAfterBlockId } : {}),
            ...(newSiblingIndex !== undefined ? { siblingIndex: newSiblingIndex } : {})
          }
        }
      })

      // 모든 제안이 결정되면 다음 큐 기동
      if (allResolved && onAllResolved) {
        setTimeout(onAllResolved, 80)
      }

      return next
    })
  }, [setMessages])

  return {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  }
}
