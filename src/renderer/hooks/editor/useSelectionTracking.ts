import { useCallback } from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'

export function useSelectionTracking(
  editor: AmevaEditor | null,
  onSelectedTextChange?: (text: string) => void,
  onSelectionChange?: (selection: { anchorBlockId: string; focusBlockId: string } | null) => void
) {
  const handleSelection = useCallback(() => {
    if (!editor) return

    const selText = window.getSelection()?.toString() || ''
    if (onSelectedTextChange) {
      onSelectedTextChange(selText)
    }

    const sel = editor.getSelection()
    if (sel && sel.blocks && sel.blocks.length > 0) {
      if (onSelectionChange) {
        onSelectionChange({ anchorBlockId: sel.blocks[0].id, focusBlockId: sel.blocks[sel.blocks.length - 1].id })
      }
    } else {
      if (onSelectionChange) {
        onSelectionChange(null)
      }
    }
  }, [editor, onSelectedTextChange, onSelectionChange])

  return { handleSelection }
}
