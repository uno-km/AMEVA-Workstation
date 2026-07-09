/**
 * @file useAppTabs.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useAppTabs.ts
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
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { type AmevaEditor, type AmevaPartialBlock } from '../../editor/amevaBlockSchema'
import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds } from '../../utils/markdownUtils'

export function useAppTabs(
  editor: AmevaEditor | null,
  filePath: string | null,
  setFilePath: (path: string | null) => void,
  currentContent: string,
  setCurrentContent: (content: string) => void,
  originalContent: string,
  setOriginalContent: (content: string) => void,
  lastSavedTime: Date | null,
  setLastSavedTime: (time: Date | null) => void
) {
  const {
    tabs,
    setTabs,
    addTab,
    removeTab,
    activeTabId,
    setActiveTabId,
    updateActiveTab,
  } = useWorkspaceStore()

  // 탭 생성
  const handleNewTab = useCallback(() => {
    if (!editor) return
    
    // 현재 탭의 변경 사항 저장
    const currentBlocks = [...editor.document]
    
    const newTabId = Math.random().toString(36).substring(2, 10)
    const newTabBlocks: AmevaPartialBlock[] = [
      {
        id: Math.random().toString(36).substring(2, 10),
        type: 'paragraph',
        content: []
      }
    ]
    const newTab = {
      id: newTabId,
      filePath: null,
      content: '',
      blocks: newTabBlocks,
      originalContent: '',
      lastSavedTime: null
    }

    updateActiveTab({ filePath, content: currentContent, blocks: currentBlocks, originalContent, lastSavedTime })
    addTab(newTab)

    setActiveTabId(newTabId)
    setFilePath(null)
    setCurrentContent('')
    setOriginalContent('')
    setLastSavedTime(null)
    
    setTimeout(() => {
      editor.replaceBlocks(editor.document, newTab.blocks)
    }, 0)
  }, [editor, activeTabId, filePath, currentContent, originalContent, lastSavedTime, addTab, updateActiveTab, setFilePath, setCurrentContent, setOriginalContent, setLastSavedTime, setActiveTabId])

  // 탭 직접 선택 전환
  const handleSelectTab = useCallback(async (tabId: string) => {
    if (!editor) return
    const currentBlocks = [...editor.document]
    
    updateActiveTab({ filePath, content: currentContent, blocks: currentBlocks, originalContent, lastSavedTime })
    
    const targetTab = tabs.find(t => t.id === tabId)
    if (targetTab) {
      setTimeout(async () => {
        setFilePath(targetTab.filePath)
        setCurrentContent(targetTab.content)
        setOriginalContent(targetTab.originalContent !== undefined ? targetTab.originalContent : targetTab.content)
        setLastSavedTime(targetTab.lastSavedTime !== undefined ? targetTab.lastSavedTime : null)
        
        if (targetTab.blocks && targetTab.blocks.length > 0) {
          ensureBlockIds(targetTab.blocks)
          editor.replaceBlocks(editor.document, targetTab.blocks)
        } else {
          const normalized = normalizeMarkdown(targetTab.content || '')
          const parsed = await editor.tryParseMarkdownToBlocks(normalized)
          cleanCodeBlocks(parsed)
          ensureBlockIds(parsed)
          editor.replaceBlocks(editor.document, parsed)
        }
      }, 0)
    }
    
    setActiveTabId(tabId)
  }, [
    editor, activeTabId, filePath, currentContent, originalContent, lastSavedTime, tabs,
    updateActiveTab, setFilePath, setCurrentContent, setOriginalContent, setLastSavedTime, setActiveTabId
  ])

  // 탭 닫기
  const handleCloseTab = useCallback((tabId: string) => {
    const remaining = tabs.filter(t => t.id !== tabId)
    if (remaining.length === 0) {
      const defaultTab = { id: 'default', filePath: null, content: '', blocks: [], originalContent: '', lastSavedTime: null }
      if (editor) {
        editor.replaceBlocks(editor.document, [])
      }
      setFilePath(null)
      setCurrentContent('')
      setOriginalContent('')
      setLastSavedTime(null)
      setActiveTabId('default')
      setTabs([defaultTab])
      return
    }
    
    if (activeTabId === tabId) {
      const nextTab = remaining[0]
      setActiveTabId(nextTab.id)
      setFilePath(nextTab.filePath)
      setCurrentContent(nextTab.content)
      setOriginalContent(nextTab.originalContent !== undefined ? nextTab.originalContent : nextTab.content)
      setLastSavedTime(nextTab.lastSavedTime !== undefined ? nextTab.lastSavedTime : null)
      if (editor) {
        if (nextTab.blocks && nextTab.blocks.length > 0) {
          editor.replaceBlocks(editor.document, nextTab.blocks)
        } else {
          editor.replaceBlocks(editor.document, [])
        }
      }
    }
    setTabs(remaining)
  }, [
    editor, activeTabId, tabs, setFilePath, setCurrentContent, setOriginalContent,
    setLastSavedTime, setActiveTabId, setTabs
  ])

  return {
    handleNewTab,
    handleSelectTab,
    handleCloseTab,
  }
}
