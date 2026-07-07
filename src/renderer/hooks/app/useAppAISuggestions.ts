import { useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { useUIStore } from '../../stores/useUIStore'
import { type AmevaEditor, type AmevaPartialBlock } from '../../editor/amevaBlockSchema'

export function useAppAISuggestions(
  editor: AmevaEditor | null,
  updateInsertSuggestionStatus?: (
    msgId: string,
    status: 'pending' | 'accepted' | 'rejected',
    newAfterBlockId?: string,
    newSiblingIndex?: number,
    suggestionIndex?: number
  ) => void
) {
  const { taggedBlocks, setTaggedBlocks, setSelectedText } = useWorkspaceStore()
  const {
    setShowAIPanel,
    setActiveRightTab,
    setToastMessage
  } = useUIStore()

  const customSetTaggedBlocks = useCallback((
    val: { id: string; text: string }[]
  ) => {
    const prev = taggedBlocks
    const next = val
    setTaggedBlocks(next)
    if (next.length > prev.length) {
      setShowAIPanel(true)
      setActiveRightTab('ai')
      setToastMessage('선택한 블록이 AI 어시스턴트에 참조 태그되었습니다.')
      setTimeout(() => {
        setToastMessage(null)
      }, 3000)
    }
  }, [taggedBlocks, setTaggedBlocks, setShowAIPanel, setActiveRightTab, setToastMessage])

  const handleScrollToBlock = useCallback((blockId: string) => {
    if (editor) {
      try {
        editor.focus()
        editor.setTextCursorPosition(blockId, 'end')
      } catch (err) {
        console.warn('editor.setTextCursorPosition failed:', err)
      }
    }
    const el = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const outer = el.closest('.bn-block-outer') || el
      if (outer) {
        outer.setAttribute('data-highlighted-temp', 'true')
        setTimeout(() => {
          outer.removeAttribute('data-highlighted-temp')
        }, 1500)
      }
    }
  }, [editor])

  const handleApplySuggestion = useCallback((text: string, mode: 'replace' | 'insert', blockId?: string, isCodeBlock?: boolean, lang?: string) => {
    if (!editor) return
    try {
      if (isCodeBlock) {
        try {
          const finalLang = lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : lang === 'py' ? 'python' : (lang || 'javascript')
          const blockPayload = {
            type: 'jupyter' as const,
            props: {
              language: finalLang,
              code: text,
              runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
            }
          }
          
          const doc = editor.document || []
          const activeBlock = editor.getTextCursorPosition()?.block
          if (activeBlock) {
            editor.insertBlocks([blockPayload], activeBlock, 'after')
          } else {
            editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
          }
          return
        } catch (jErr) {
          console.error('[Jupyter Auto-Insert Failed]', jErr)
        }
      }

      if (blockId) {
        try {
          const targetBlock = editor.getBlock(blockId)
          if (targetBlock) {
            if (targetBlock.type === 'jupyter') {
              editor.updateBlock(blockId, {
                type: 'jupyter',
                props: { ...targetBlock.props, code: text }
              } as AmevaPartialBlock)
            } else {
              editor.updateBlock(blockId, {
                content: text
              } as AmevaPartialBlock)
            }
            return
          }
        } catch (bErr) {
          console.warn('블록 단위 직접 업데이트 실패, selection 폴백 실행:', bErr)
        }
      }

      const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
      if (view) {
        const { state, dispatch } = view
        const { tr, selection } = state
        if (mode === 'replace') {
          dispatch(tr.replaceSelectionWith(state.schema.text(text)))
        } else {
          dispatch(tr.insertText(text, selection.to))
        }
        setTimeout(() => {
          try {
            if (view && view.dom && document.body.contains(view.dom) && typeof view.focus === 'function') {
              view.focus()
            }
          } catch (e) {
            console.warn('Failed to focus editor view:', e)
          }
          setSelectedText('')
        }, 20)
      }
    } catch (err) {
      console.error('AI 제안 에디터 반영 실패:', err)
    }
  }, [editor, setSelectedText])

  const handleApplyInsertSuggestion = useCallback((
    msgId: string,
    afterBlockId: string,
    blockType: string,
    content: string,
    level?: number,
    suggestionIndex?: number
  ) => {
    if (!editor) return
    try {
      const blockPayload: any = {
        id: Math.random().toString(36).substring(2, 10),
        type: blockType === 'heading' ? 'heading'
          : blockType === 'bulletListItem' ? 'bulletListItem'
          : blockType === 'numberedListItem' ? 'numberedListItem'
          : 'paragraph',
        content: [{ type: 'text', text: content, styles: {} }],
      }
      if (blockType === 'heading' && level) {
        blockPayload.props = { level: Math.min(3, Math.max(1, level)) as 1 | 2 | 3 }
      }

      const doc = editor.document
      if (!doc || doc.length === 0) {
        editor.replaceBlocks(doc, [blockPayload as AmevaPartialBlock])
      } else if (afterBlockId === 'START') {
        editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[0], 'before')
      } else if (afterBlockId === 'END') {
        editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[doc.length - 1], 'after')
      } else {
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(doc)
        const targetBlock = flatBlocks.find(b => b.id === afterBlockId)
        if (targetBlock) {
          editor.insertBlocks([blockPayload as AmevaPartialBlock], targetBlock, 'after')
        } else {
          editor.insertBlocks([blockPayload as AmevaPartialBlock], doc[doc.length - 1], 'after')
        }
      }

      if (updateInsertSuggestionStatus) {
        updateInsertSuggestionStatus(msgId, 'accepted', afterBlockId, undefined, suggestionIndex)
      }
    } catch (err) {
      console.error('Failed to apply insert suggestion:', err)
    }
  }, [editor, updateInsertSuggestionStatus])

  return {
    customSetTaggedBlocks,
    handleScrollToBlock,
    handleApplySuggestion,
    handleApplyInsertSuggestion
  }
}
