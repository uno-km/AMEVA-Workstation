import { useEffect, useRef } from 'react'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

export function useCollaborationHighlight(
  editor: AmevaEditor | null,
  onBlockHighlight: ((blockId: string | null, isEditing: boolean) => void) | undefined,
  editorContainerRef: React.RefObject<HTMLDivElement | null>
) {
  const cbRef = useRef(onBlockHighlight)
  useEffect(() => {
    cbRef.current = onBlockHighlight
  }, [onBlockHighlight])

  useEffect(() => {
    if (!editor || !cbRef.current) return

    let prevActiveId: string | null = null
    let editingTimer: ReturnType<typeof setTimeout> | null = null
    let selectionTimer: ReturnType<typeof setTimeout> | null = null
    let isCurrentlyEditing = false

    const isEditorMounted = () => {
      try {
        const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
        return !!(view && view.dom && document.body.contains(view.dom))
      } catch {
        return false
      }
    }

    const clearActive = () => {
      document.querySelectorAll('[data-bn-active]').forEach(el =>
        el.removeAttribute('data-bn-active')
      )
      const bnEditor = document.querySelector('.bn-editor')
      if (bnEditor) bnEditor.removeAttribute('data-bn-editor-focused')
    }

    // 디바운스된 브로드캐스트 전송 (부모 컴포넌트 렌더링 무한 루프 예방)
    const broadcast = (blockId: string, isEditing: boolean) => {
      if (cbRef.current) cbRef.current(blockId, isEditing)
      prevActiveId = blockId
    }

    const markActive = () => {
      if (!isEditorMounted()) return
      try {
        const selection = typeof editor.getSelection === 'function' ? editor.getSelection() : undefined
        if (!selection || !selection.blocks || selection.blocks.length === 0) {
          clearActive()
          if (prevActiveId && cbRef.current) cbRef.current(null, false)
          prevActiveId = null
          return
        }
        const blockId = selection.blocks[selection.blocks.length - 1].id
        if (blockId === prevActiveId && isCurrentlyEditing) return

        clearActive()

        const blockOuter = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
        if (blockOuter) {
          const outerEl = blockOuter.closest('.bn-block-outer') ?? blockOuter
          outerEl.setAttribute('data-bn-active', 'true')
        }

        const bnEditor = document.querySelector('.bn-editor')
        if (bnEditor) bnEditor.setAttribute('data-bn-editor-focused', 'true')

        prevActiveId = blockId
      } catch {
        if (prevActiveId && cbRef.current) cbRef.current(null, false)
        prevActiveId = null
      }
    }

    const handleFocusOut = () => {
      clearActive()
      const bnEditor = document.querySelector('.bn-editor')
      if (bnEditor) bnEditor.removeAttribute('data-bn-editor-focused')
      if (prevActiveId && cbRef.current) cbRef.current(null, false)
      prevActiveId = null
    }

    const handleFocusIn = () => {
      markActive()
    }

    // 200ms 디바운스 처리된 타이핑 변경 리스너
    const handleChange = () => {
      if (!isEditorMounted()) return
      try {
        const pos = editor.getTextCursorPosition()
        if (!pos) {
          if (prevActiveId && cbRef.current) cbRef.current(null, false)
          prevActiveId = null
          isCurrentlyEditing = false
          return
        }
        const blockId = pos.block.id
        isCurrentlyEditing = true

        if (editingTimer) clearTimeout(editingTimer)
        editingTimer = setTimeout(() => {
          broadcast(blockId, true)
          
          // 추가 1.5초 후 타이핑 멈춤 전파
          setTimeout(() => {
            isCurrentlyEditing = false
            broadcast(blockId, false)
          }, 1500)
        }, 200)
      } catch {
        if (prevActiveId && cbRef.current) cbRef.current(null, false)
        prevActiveId = null
      }
    }

    // 200ms 디바운스 처리된 커서 이동 리스너
    const handleSelectionChange = () => {
      if (!isEditorMounted()) return
      try {
        const pos = editor.getTextCursorPosition()
        if (!pos) return
        const blockId = pos.block.id
        if (blockId !== prevActiveId) {
          if (selectionTimer) clearTimeout(selectionTimer)
          selectionTimer = setTimeout(() => {
            broadcast(blockId, isCurrentlyEditing)
          }, 200)
        }
      } catch {}
    }

    const handleBlur = () => {
      if (!isEditorMounted()) return
      if (editingTimer) clearTimeout(editingTimer)
      if (selectionTimer) clearTimeout(selectionTimer)
      isCurrentlyEditing = false
      if (cbRef.current) cbRef.current(null, false)
      prevActiveId = null
    }

    // editor.onChange(markActive) 제거 (selectionchange 네이티브 이벤트 하나로 병합하여 DOM 변경 재귀 루프 영구 차단)
    document.addEventListener('selectionchange', markActive)
    document.addEventListener('focusout', handleFocusOut)
    document.addEventListener('focusin', handleFocusIn)

    editor.onChange(handleChange)
    document.addEventListener('selectionchange', handleSelectionChange)
    editorContainerRef.current?.addEventListener('blur', handleBlur, true)

    return () => {
      clearActive()
      document.removeEventListener('selectionchange', markActive)
      document.removeEventListener('focusout', handleFocusOut)
      document.removeEventListener('focusin', handleFocusIn)

      if (editingTimer) clearTimeout(editingTimer)
      if (selectionTimer) clearTimeout(selectionTimer)
      document.removeEventListener('selectionchange', handleSelectionChange)
      editorContainerRef.current?.removeEventListener('blur', handleBlur, true)
    }
  }, [editor, editorContainerRef])
}
