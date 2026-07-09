/**
 * @file useUpdateInsertStatus.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/message-state/useUpdateInsertStatus.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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
