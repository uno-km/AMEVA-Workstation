import { useEffect } from 'react'
import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds } from '../../utils/markdownUtils'
import { type AmevaEditor as AppEditor, type AmevaPartialBlock as AppPartialBlock } from '../../editor/amevaBlockSchema'

export function useAppGlobalApi({
  editor,
  currentContent,
  setCurrentContent,
  appendContent,
  setShowAIPanel,
  setActiveRightTab,
}: {
  editor: AppEditor | null
  currentContent: string
  setCurrentContent: (content: string) => void
  appendContent: (content: string) => void
  setShowAIPanel: (show: boolean) => void
  setActiveRightTab: (tab: any) => void
}) {
  useEffect(() => {
    (window as any).AMEVA_INSERT_TEXT_TO_EDITOR = (text: string) => {
      if (editor) {
        try {
          const doc = editor.document
          const blockPayload: AppPartialBlock = {
            type: 'paragraph',
            content: [{ type: 'text', text: text, styles: {} }]
          }
          if (doc.length > 0) {
            editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
          } else {
            editor.insertBlocks([blockPayload], doc[0], 'before')
          }
        } catch (e) {
          console.error('[Insert Text Global API Failed]', e)
        }
      } else {
        appendContent(text)
      }
    }

    (window as any).AMEVA_ASK_AGENT = (text: string) => {
      setShowAIPanel(true)
      setActiveRightTab('ai')
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ameva:fill-ai-input', { detail: text }))
      }, 150)
    }
  }, [editor, appendContent, setShowAIPanel, setActiveRightTab])

  useEffect(() => {
    (window as any).AMEVA_GET_CURRENT_CONTENT = () => {
      return currentContent || ''
    };
    (window as any).AMEVA_SET_CURRENT_CONTENT = async (markdownText: string) => {
      if (editor) {
        try {
          const normalized = normalizeMarkdown(markdownText)
          const blocks = await editor.tryParseMarkdownToBlocks(normalized)
          cleanCodeBlocks(blocks)
          ensureBlockIds(blocks)
          editor.replaceBlocks(editor.document, blocks)
          setCurrentContent(markdownText)
        } catch (e) {
          console.error('클라우드 파일 로드 연계 실패:', e)
        }
      }
    }
  }, [editor, currentContent, setCurrentContent])
}
