import { useEffect } from 'react'
import { BlockNoteEditor } from '@blocknote/core'

const FENCE_LANG_MAP: Record<string, string> = {
  js: 'javascript', javascript: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python',     python: 'python',
  html: 'html', css: 'css', mermaid: 'mermaid',
  md: 'markdown',  markdown: 'markdown',
  json: 'json', xml: 'xml', sql: 'sql',
  bash: 'bash', sh: 'bash', c: 'c', cpp: 'cpp', java: 'java',
}

export function useBacktickFence(editor: BlockNoteEditor | null) {
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      try {
        const pos = editor.getTextCursorPosition()
        if (!pos) return
        const block = pos.block
        if (block.type !== 'paragraph') return

        const text = Array.isArray(block.content)
          ? block.content.map((c: any) => c.text || '').join('')
          : typeof block.content === 'string'
            ? block.content
            : ''

        if (text.startsWith('```')) {
          const langInput = text.slice(3).trim().toLowerCase()
          const matchedLang = FENCE_LANG_MAP[langInput] || 'javascript'
          e.preventDefault()

          editor.updateBlock(block.id, {
            type: 'codeBlock',
            props: { language: matchedLang },
            content: [],
          })

          setTimeout(() => {
            try {
              editor.setTextCursorPosition(block.id, 'start')
              editor.focus()
            } catch {}
          }, 20)
        }
      } catch {}
    }

    const container = document.querySelector('.bn-editor')
    if (container) {
      container.addEventListener('keydown', handleKeyDown as any)
    }
    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown as any)
      }
    }
  }, [editor])
}
