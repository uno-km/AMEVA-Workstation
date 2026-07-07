import { useCallback } from 'react'
import type { AIMessage } from '../../../types/aiTypes'

export function useUpdateInsertStatus(setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void) {
  return useCallback((
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

      if (allResolved && onAllResolved) {
        setTimeout(onAllResolved, 80)
      }

      return next
    })
  }, [setMessages])
}
