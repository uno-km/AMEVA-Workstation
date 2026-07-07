/**
 * useAIMessageState.ts
 *
 * AI 메시지 상태 및 고수준 메시지 조작 전담 훅 (Facade).
 * 하위 모듈에서 도메인 특화 조작 로직을 가져와 제공합니다.
 */

import { useAILogStore } from '../../stores/useAILogStore'
import { useAIState } from '../../stores/useAIState'
import { useAddMessages } from './message-state/useAddMessages'
import { useFinalizeMessage } from './message-state/useFinalizeMessage'
import { useUpdateDiffState } from './message-state/useUpdateDiffState'
import { useUpdateInsertStatus } from './message-state/useUpdateInsertStatus'

export function useAIMessageState() {
  const { messages, setMessages, setStreamingText } = useAILogStore()
  const { setIsGenerating } = useAIState()

  const addUserAndAssistantMessages = useAddMessages(setMessages)
  const finalizeAssistantMessage = useFinalizeMessage(setMessages, setStreamingText, setIsGenerating)
  const updateMessageDiffState = useUpdateDiffState(setMessages)
  const updateInsertSuggestionStatus = useUpdateInsertStatus(setMessages)

  return {
    messages,
    addUserAndAssistantMessages,
    finalizeAssistantMessage,
    updateMessageDiffState,
    updateInsertSuggestionStatus
  }
}
