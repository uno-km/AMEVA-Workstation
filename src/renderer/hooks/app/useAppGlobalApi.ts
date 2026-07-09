/**
 * @file useAppGlobalApi.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useAppGlobalApi.ts
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
