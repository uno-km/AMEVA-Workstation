import { useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { normalizeMarkdown } from '../../utils/markdownUtils'
import { useFileOpen } from './useFileOpen'
import { useFileSave } from './useFileSave'
import type { AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

export function useAppFileOperations(
  editor: AppEditor | null,
  setEditorMode: (mode: EditorMode) => void,
  createSnapshot: (name: string, content: string) => void
) {
  const { filePath, setFilePath, setOriginalContent, setLastSavedTime, tabs, activeTabId, setActiveTabId } = useWorkspaceStore()

  const { loadMarkdownIntoEditor, appendMarkdownIntoEditor, openFileInTab, handleStartNewDocument, handleOpenFile } = useFileOpen(editor, setEditorMode)
  const { handleSaveFile, handleSaveAsFile } = useFileSave(editor, filePath, setFilePath, setOriginalContent, setLastSavedTime, createSnapshot)

  useEffect(() => {
    if (!editor) return

    const handleAutoWrite = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      const filePathVal = detail.filePath || detail.path
      const contentVal = detail.content || ''
      if (!filePathVal) return

      const targetTab = tabs.find(t => t.filePath === filePathVal)

      if (!targetTab) {
        if (filePathVal.endsWith('.log') || filePathVal.startsWith('/sys/')) {
          return
        }
        const newTabId = 'tab_' + Math.random().toString(36).substring(2, 9)
        const newTab = {
          id: newTabId,
          filePath: filePathVal,
          content: contentVal,
          blocks: [],
          originalContent: contentVal,
          lastSavedTime: new Date()
        }
        useWorkspaceStore.getState().addTab(newTab)
        setActiveTabId(newTabId)
        setEditorMode('edit')
        await openFileInTab(editor, contentVal, filePathVal, false)
      } else {
        if (filePathVal.endsWith('.log') || filePathVal.startsWith('/sys/')) {
          useWorkspaceStore.getState().updateTab(targetTab.id, { content: contentVal })
          if (activeTabId === targetTab.id) {
            await loadMarkdownIntoEditor(editor, contentVal, false, filePathVal)
          }
        } else {
          setActiveTabId(targetTab.id)
          if (activeTabId === targetTab.id) {
            await loadMarkdownIntoEditor(editor, contentVal, false, filePathVal)
          } else {
            try {
              const parsed = await editor.tryParseMarkdownToBlocks(normalizeMarkdown(contentVal))
              useWorkspaceStore.getState().updateActiveTab({
                filePath: filePathVal,
                content: contentVal,
                blocks: parsed
              })
            } catch (err: unknown) {
              console.warn('[AutoUpdate] 비활성 탭 버퍼 동기화 오류:', err)
            }
          }
        }
      }
    }

    window.addEventListener('ameva:file-auto-write', handleAutoWrite)

    return () => {
      window.removeEventListener('ameva:file-auto-write', handleAutoWrite)
    }
  }, [editor, activeTabId, tabs, openFileInTab, loadMarkdownIntoEditor, setEditorMode, setActiveTabId])

  return {
    loadMarkdownIntoEditor,
    appendMarkdownIntoEditor,
    openFileInTab,
    handleStartNewDocument,
    handleOpenFile,
    handleSaveFile,
    handleSaveAsFile
  }
}