import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { type AmevaEditor as AppEditor, type AmevaPartialBlock as AppPartialBlock } from '../../editor/amevaBlockSchema'
import { handleHeadingFormat } from './editor-sync/handleHeadingFormat'
import { handleUrlConversion } from './editor-sync/handleUrlConversion'

export function useAppEditorSync({
  editor,
  setActiveBlockId,
  setCurrentContent,
  currentContent,
  autoSnapshot,
  createSnapshot,
}: {
  editor: AppEditor | null
  setActiveBlockId: (id: string | null) => void
  setCurrentContent: (content: string) => void
  currentContent: string
  autoSnapshot: boolean
  createSnapshot: (title: string, content?: string) => void
}) {
  const activeBlockIdRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processedUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!editor) return
    let isUpdating = false

    const handleEditorChange = async () => {
      if (isUpdating) return

      handleHeadingFormat(editor, activeBlockIdRef, setActiveBlockId, (val) => isUpdating = val)

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)

      syncTimeoutRef.current = setTimeout(async () => {
        if (isUpdating) return
        isUpdating = true

        handleUrlConversion(editor, processedUrlsRef)

        let activeHeadingCleared = false
        let activeHeadingText = ''
        const activeId = activeBlockIdRef.current

        if (activeId) {
          try {
            const ab = editor.getBlock(activeId)
            if (ab?.type === 'heading') {
              const text = ab.content ? (ab.content as any).map((c: any) => c.text).join('') : ''
              const match = text.match(/^(#{1,3}\s)(.*)$/)
              if (match) {
                activeHeadingText = text
                 editor.updateBlock(activeId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
                activeHeadingCleared = true
              }
            }
          } catch {}
        }

        try {
          const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
          if (markdown.trim() !== useWorkspaceStore.getState().currentContent.trim()) setCurrentContent(markdown)
        } catch (err) {
          console.error('Markdown sync failed:', err)
        } finally {
          if (activeHeadingCleared && activeId) {
            try { editor.updateBlock(activeId, { content: [{ type: 'text', text: activeHeadingText, styles: {} }] } as AppPartialBlock) } catch {}
          }
          isUpdating = false
        }
      }, 300)
    }

    editor.onChange(handleEditorChange)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [editor, setActiveBlockId, setCurrentContent])

  useEffect(() => {
    if (!autoSnapshot || !currentContent) return
    const id = setInterval(() => createSnapshot(`자동 백업`, currentContent), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [autoSnapshot, currentContent, createSnapshot])
}
