import { useCallback } from 'react'
import type { AIMessage } from '../../../types/aiTypes'

export function useUpdateDiffState(setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void) {
  return useCallback((
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
}
