import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds, cleanMarkdownCodeBlocks, convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { type AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'
import { type EditorMode } from '../../../shared/types'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'

export function useAppModeSwitch({
  editor,
  editorMode,
  setEditorMode,
  currentContent,
  setCurrentContent,
  setOriginalContent,
  loadMarkdownIntoEditor,
  DEFAULT_WELCOME_TEXT,
}: {
  editor: AppEditor | null
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  currentContent: string
  setCurrentContent: (content: string) => void
  setOriginalContent: (content: string) => void
  loadMarkdownIntoEditor: (editor: AppEditor, content: string, isBinary?: boolean, filePath?: string) => Promise<void>
  DEFAULT_WELCOME_TEXT: string
}) {
  const handleRollback = async (rollbackContent: string) => {
    if (!editor) return
    await loadMarkdownIntoEditor(editor, rollbackContent)
  }

  const handleSwitchMode = async (mode: EditorMode) => {
    if (editorMode === 'edit' && (mode === 'preview' || mode === 'raw') && editor) {
      try {
        let latest = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))

        const blocks = editor.document as any[]
        const mermaidBlocks = blocks.filter(
          b => b.type === 'codeBlock' &&
          (b.props?.language || '').toLowerCase() === 'mermaid'
        )

        if (mermaidBlocks.length > 0) {
          const hasMermaidFence = latest.includes('```mermaid')
          if (!hasMermaidFence) {
            const lines: string[] = []
            for (const block of blocks) {
              const lang = (block.props?.language || '').toLowerCase()
              const code = Array.isArray(block.content)
                ? block.content.map((c: any) => c.text ?? '').join('')
                : typeof block.content === 'string' ? block.content : ''

              if (block.type === 'codeBlock') {
                lines.push(`\`\`\`${lang}`)
                lines.push(code)
                lines.push('```')
                lines.push('')
              } else if (block.type === 'heading') {
                const hashes = '#'.repeat(Math.min(6, Math.max(1, Number(block.props?.level) || 1)))
                lines.push(`${hashes} ${code}`)
                lines.push('')
              } else if (block.type === 'paragraph') {
                lines.push(code || '')
                lines.push('')
              } else if (block.type === 'bulletListItem') {
                lines.push(`- ${code}`)
              } else if (block.type === 'numberedListItem') {
                lines.push(`1. ${code}`)
              } else {
                if (code) { lines.push(code); lines.push('') }
              }
            }
            latest = lines.join('\n')
          }
        }

        latest = cleanMarkdownCodeBlocks(latest)
        setCurrentContent(latest)
      } catch (err) {
        console.error('[handleSwitchMode] markdown 변환 실패:', err)
      }
    }

    if (mode === 'edit' && editor) {
      try {
        const normalized = normalizeMarkdown(useWorkspaceStore.getState().currentContent)
        const blocks = await editor.tryParseMarkdownToBlocks(normalized)
        cleanCodeBlocks(blocks)
        ensureBlockIds(blocks)
        editor.replaceBlocks(editor.document, blocks)
      } catch (err) {
        console.error('[handleSwitchMode] editor blocks 로드 실패:', err)
      }
    }

    setEditorMode(mode)
  }

  const handleStartWelcomeEdit = async () => {
    if (!editor) return
    try {
      const normalized = normalizeMarkdown(currentContent || DEFAULT_WELCOME_TEXT)
      const blocks = await editor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      editor.replaceBlocks(editor.document, blocks)
      setCurrentContent(currentContent || DEFAULT_WELCOME_TEXT)
      setOriginalContent(currentContent || DEFAULT_WELCOME_TEXT)
      setEditorMode('edit')
    } catch (err) {
      console.error('웰컴 편집 로드 실패:', err)
      setEditorMode('edit')
    }
  }

  return {
    handleRollback,
    handleSwitchMode,
    handleStartWelcomeEdit,
  }
}
