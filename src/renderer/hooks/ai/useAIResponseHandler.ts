import { useCallback } from 'react'
import { parseEditSuggestion, parseInsertSuggestions } from '../../services/ai/aiStreamParser'
import type { InsertSuggestion } from '../../types/aiTypes'

export function useAIResponseHandler(
  currentSessionIdRef: React.MutableRefObject<string | null>,
  currentAssistantIdRef: React.MutableRefObject<string | null>,
  rawAccumRef: React.MutableRefObject<string>,
  finalize: () => { finalContent: string; rawContent: string },
  finalizeAssistantMessage: (args: any) => void,
  unsubscribeSession: () => void,
  editorRef: React.MutableRefObject<any>,
  processNextQueueRef: React.MutableRefObject<(() => void) | null>
) {
  const handleDone = useCallback((
    data: { success: boolean; error?: string },
    sessId: string,
    _assistantId: string,
    taggedBlocks?: { id: string; text: string }[],
    intent?: string
  ) => {
    if (sessId !== currentSessionIdRef.current) return

    const sanitizeResult = finalize()
    const rawForEdit = rawAccumRef.current
    const targetId = currentAssistantIdRef.current

    // EDIT_SUGGESTION 파싱
    const editSuggestionResult = data.success ? parseEditSuggestion(rawForEdit) : null

    // INSERT_SUGGESTION 파싱
    let siblingBlockIds: string[] = []
    if (editorRef.current) {
      try {
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(editorRef.current.document || [])
        siblingBlockIds = flatBlocks.map((b: any) => b.id)
      } catch (e) {
        console.warn('[useAIAgent] 에디터 블록 목록 조회 실패:', e)
      }
    }

    const insertResult = (!editSuggestionResult && data.success)
      ? parseInsertSuggestions(rawForEdit, sanitizeResult.finalContent, siblingBlockIds)
      : null

    const insertSuggestions: InsertSuggestion[] = insertResult?.suggestions ?? []

    // EDIT_SUGGESTION 자동 반영 (에디터 직접 업데이트)
    if (editSuggestionResult && data.success && editorRef.current) {
      try {
        const { blockId: editBlockId, proposedText } = editSuggestionResult
        const block = editorRef.current.getBlock(editBlockId)
        if (block) {
          if (block.type === 'jupyter') {
            editorRef.current.updateBlock(editBlockId, {
              type: 'jupyter',
              props: { ...block.props, code: proposedText }
            })
          } else {
            editorRef.current.updateBlock(editBlockId, {
              content: [{ type: 'text', text: proposedText, styles: {} }]
            })
          }
        }
      } catch (e) {
        console.error('[useAIAgent] EDIT_SUGGESTION 자동 반영 실패:', e)
      }
    }

    // INSERT_SUGGESTION 자동 반영
    if (insertSuggestions.length > 0 && data.success && editorRef.current) {
      insertSuggestions.forEach((s) => {
        if (s.afterBlockId && s.afterBlockId !== 'undefined') {
          try {
            editorRef.current.insertBlocks(
              [{
                type: s.blockType === 'heading' ? 'heading' : 'paragraph',
                props: s.level ? { level: s.level } : undefined,
                content: [{ type: 'text', text: s.content, styles: {} }]
              }],
              s.afterBlockId,
              'after'
            )
          } catch (insErr) {
            console.warn('[useAIAgent] INSERT_SUGGESTION 자동 반영 실패:', insErr)
          }
        }
      })
    }

    // taggedBlocks 폴백 자동 반영
    if (!editSuggestionResult && insertSuggestions.length === 0 && data.success && editorRef.current) {
      if (taggedBlocks && taggedBlocks.length > 0 && (intent === 'EDIT' || intent === 'WRITE')) {
        try {
          const firstBlock = taggedBlocks[0]
          const block = editorRef.current.getBlock(firstBlock.id)
          if (block) {
            const finalClean = sanitizeResult.finalContent
              .replace(/^\[(WRITE|EDIT|CHAT|SUMMARY)\]\s*/i, '')
              .trim()
            if (block.type === 'jupyter') {
              editorRef.current.updateBlock(firstBlock.id, {
                type: 'jupyter',
                props: { ...block.props, code: finalClean }
              })
            } else {
              editorRef.current.updateBlock(firstBlock.id, {
                content: [{ type: 'text', text: finalClean, styles: {} }]
              })
            }
          }
        } catch (e) {
          console.error('[useAIAgent] 태그블록 자동 반영 실패:', e)
        }
      }
    }

    // 메시지 상태 최종 업데이트
    finalizeAssistantMessage({
      targetId,
      sanitizeResult,
      rawForEdit,
      success: data.success,
      error: data.error,
      editSuggestion: editSuggestionResult,
      insertSuggestions
    })

    // 리스너 해제
    unsubscribeSession()

    // 수정/삽입 대기 결정이 있으면 큐 실행 보류
    const hasPendingDecision = data.success && (!!editSuggestionResult || insertSuggestions.length > 0)
    if (!hasPendingDecision) {
      setTimeout(() => processNextQueueRef.current?.(), 80)
    }
  }, [currentSessionIdRef, currentAssistantIdRef, rawAccumRef, finalize, finalizeAssistantMessage, unsubscribeSession, editorRef, processNextQueueRef])

  return { handleDone }
}
