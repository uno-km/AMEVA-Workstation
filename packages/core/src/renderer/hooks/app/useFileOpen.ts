import { useCallback, useRef } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { getPlatformAdapter } from '../../../shared/adapters/platformAdapter'
import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds, convertJupyterToCodeBlocks, convertLocalPathsToMediaSchema } from '../../utils/markdownUtils'
import { parseFileToMarkdown } from '../../utils/fileConverters'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import type { AmevaEditor as AppEditor, AmevaPartialBlock } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

export function useFileOpen(
  editor: AppEditor | null,
  setEditorMode: (mode: EditorMode) => void
) {
  const {
    filePath, setFilePath,
    currentContent, setCurrentContent,
    originalContent, setOriginalContent,
    lastSavedTime, setLastSavedTime,
    fileOpenMode,
    appendedFiles, setAppendedFiles,
    setActiveTabId, activeTabId,
    updateActiveTab, addTab, tabs,
    setPdfData, setPdfFileName
  } = useWorkspaceStore()

  const loadSessionRef = useRef(0)

  const loadMarkdownIntoEditor = useCallback(async (targetEditor: AppEditor, rawContent: string, isBinary = false, path = '') => {
    setEditorMode('edit')
    loadSessionRef.current += 1
    const currentSession = loadSessionRef.current

    const parsedResult = await parseFileToMarkdown(rawContent, path || filePath || '', isBinary)
    const isAdc = typeof parsedResult !== 'string' && parsedResult && 'markdown' in parsedResult
    const markdown = isAdc ? (parsedResult as any).markdown : parsedResult

    const ext = (path || filePath || '').split('.').pop()?.toLowerCase()
    if (ext === 'pdf' && isBinary) {
      const fname = (path || filePath || 'document.pdf').split(/[\\/]/).pop() || 'document.pdf'
      setPdfData(rawContent)
      setPdfFileName(fname)
      setCurrentContent('')
      setOriginalContent('')
      setLastSavedTime(null)
      setEditorMode('edit')
      return
    }

    setPdfData(null)
    setPdfFileName('')

    const converted = convertLocalPathsToMediaSchema(markdown)
    const normalized = normalizeMarkdown(converted)
    const lines = normalized.split('\n')

    if (lines.length > 200 && !isBinary) {
      const firstChunk = lines.slice(0, 120).join('\n')
      const remainingChunk = lines.slice(120).join('\n')

      const firstBlocks = await targetEditor.tryParseMarkdownToBlocks(firstChunk)
      cleanCodeBlocks(firstBlocks)
      ensureBlockIds(firstBlocks)
      targetEditor.replaceBlocks(targetEditor.document, firstBlocks)

      setTimeout(async () => {
        if (loadSessionRef.current !== currentSession) {
          console.warn('[useAppFileOperations] 파일 로딩 취소됨 (Race Condition 방어)')
          return
        }

        const remainingBlocks = await targetEditor.tryParseMarkdownToBlocks(remainingChunk)
        cleanCodeBlocks(remainingBlocks)
        ensureBlockIds(remainingBlocks)

        const doc = targetEditor.document
        if (doc.length > 0) {
          targetEditor.insertBlocks(remainingBlocks, doc[doc.length - 1], 'after')
        }
        
        const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
        setCurrentContent(derived)
      }, 350)
    } else {
      const blocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      targetEditor.replaceBlocks(targetEditor.document, blocks)
    }

    setOriginalContent(converted)
    setCurrentContent(converted)
    setLastSavedTime(null)
  }, [filePath, setEditorMode, setOriginalContent, setCurrentContent, setLastSavedTime, setPdfData, setPdfFileName])

  const appendMarkdownIntoEditor = useCallback(async (targetEditor: AppEditor, rawContent: string, fileName: string, isBinary = false, path = '') => {
    const parsedResult = await parseFileToMarkdown(rawContent, path, isBinary)
    const isAdc = typeof parsedResult !== 'string' && parsedResult && 'markdown' in parsedResult
    const markdown = isAdc ? (parsedResult as any).markdown : parsedResult
    const sourceBlocks = isAdc ? (parsedResult as any).blocks : undefined
    const normalized = normalizeMarkdown(markdown)

    const newBlocks = sourceBlocks || await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(newBlocks)
    ensureBlockIds(newBlocks)

    const doc = targetEditor.document
    if (doc.length > 0) {
      targetEditor.insertBlocks(newBlocks, doc[doc.length - 1], 'after')
    } else {
      targetEditor.replaceBlocks(doc, newBlocks)
    }

    const firstBlockId = newBlocks[0]?.id || ''
    setAppendedFiles([...appendedFiles, { id: `append-${Date.now()}`, filePath: fileName, startBlockId: firstBlockId }])

    const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
    setCurrentContent(derived)
  }, [appendedFiles, setAppendedFiles, setCurrentContent])

  const openFileInTab = useCallback(async (targetEditor: AppEditor, fileContent: string, path: string, isBinary = false) => {
    const currentBlocks = [...targetEditor.document]
    const { pdfData: currentPdfData, pdfFileName: currentPdfFileName } = useWorkspaceStore.getState()
    
    updateActiveTab({ filePath, content: currentContent, blocks: currentBlocks, originalContent, lastSavedTime, pdfData: currentPdfData, pdfFileName: currentPdfFileName })

    const ext = path.split('.').pop()?.toLowerCase() || ''

    if (ext === 'pdf' && isBinary) {
      const newTabId = Math.random().toString(36).substring(2, 10)
      const pdfFileName = path.split('/').pop() || path.split('\\').pop() || 'document.pdf'
      const newTab = {
        id: newTabId,
        filePath: path,
        content: '',
        blocks: [],
        originalContent: '',
        lastSavedTime: null,
        pdfData: fileContent,
        pdfFileName
      }
      addTab(newTab)
      setActiveTabId(newTabId)
      setFilePath(path)
      setPdfData(fileContent)
      setPdfFileName(pdfFileName)
      setCurrentContent('')
      setOriginalContent('')
      setLastSavedTime(null)
      return
    }

    const parsedResult = await parseFileToMarkdown(fileContent, path, isBinary)
    const isAdc = typeof parsedResult !== 'string' && parsedResult && 'markdown' in parsedResult
    const markdown = isAdc ? (parsedResult as any).markdown : parsedResult
    const sourceBlocks = isAdc ? (parsedResult as any).blocks : undefined
    const converted = convertLocalPathsToMediaSchema(markdown)
    const normalized = normalizeMarkdown(converted)

    const parsed = sourceBlocks || await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(parsed)
    ensureBlockIds(parsed)

    const newTabId = Math.random().toString(36).substring(2, 10)
    const newTab = {
      id: newTabId,
      filePath: path,
      content: converted,
      blocks: parsed,
      originalContent: converted,
      lastSavedTime: null
    }

    addTab(newTab)
    setActiveTabId(newTabId)
    setFilePath(path)
    setOriginalContent(converted)
    setCurrentContent(converted)
    setLastSavedTime(null)
    setPdfData(null)
    setPdfFileName('')

    setTimeout(() => {
      targetEditor.replaceBlocks(targetEditor.document, parsed)
    }, 0)
  }, [activeTabId, filePath, currentContent, originalContent, lastSavedTime, addTab, setActiveTabId, setFilePath, setOriginalContent, setCurrentContent, setLastSavedTime, updateActiveTab, setPdfData, setPdfFileName])

  const handleStartNewDocument = useCallback(() => {
    if (editor) {
      const newBlock: AmevaPartialBlock = {
        id: Math.random().toString(36).substring(2, 10),
        type: 'paragraph',
        content: [] as any
      }
      editor.replaceBlocks(editor.document, [newBlock])
    }
    setFilePath(null)
    setOriginalContent('')
    setCurrentContent('')
    setLastSavedTime(null)
    setEditorMode('edit')
  }, [editor, setFilePath, setOriginalContent, setCurrentContent, setLastSavedTime, setEditorMode])

  const handleOpenFile = useCallback(async () => {
    if (!editor) return
    
    if (getPlatformAdapter().isNative) {
      const file = await ipc.openFile()
      if (file) {
        if (fileOpenMode === 'append') {
          await appendMarkdownIntoEditor(editor, file.content, file.filePath.split(/[\\/]/).pop() || '파일', file.isBinary, file.filePath)
        } else if (fileOpenMode === 'tab') {
          await openFileInTab(editor, file.content, file.filePath, file.isBinary)
        } else {
          setFilePath(file.filePath)
          await loadMarkdownIntoEditor(editor, file.content, file.isBinary, file.filePath)
        }
      }
    } 
    else if ((window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) {
      alert("모바일 기기에서는 파일 관리자에서 '.adc' 파일을 탭하여 AMEVA OS 앱으로 열어주세요.")
    }
    else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt,.docx,.hwpx,.pdf,.xlsx,.ipynb,.adc'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = async (evt) => {
            const content = evt.target?.result as string
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const isBinaryFile = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
            
            if (isBinaryFile) {
              const binReader = new FileReader()
              binReader.onload = async (binEvt) => {
                const base64 = binEvt.target?.result as string
                if (fileOpenMode === 'append') {
                  await appendMarkdownIntoEditor(editor, base64, file.name, true, file.name)
                } else if (fileOpenMode === 'tab') {
                  await openFileInTab(editor, base64, file.name, true)
                } else {
                  setFilePath(file.name)
                  await loadMarkdownIntoEditor(editor, base64, true, file.name)
                }
              }
              binReader.readAsDataURL(file)
            } else {
              if (fileOpenMode === 'append') {
                await appendMarkdownIntoEditor(editor, content, file.name, false, file.name)
              } else if (fileOpenMode === 'tab') {
                await openFileInTab(editor, content, file.name, false)
              } else {
                setFilePath(file.name)
                await loadMarkdownIntoEditor(editor, content, false, file.name)
              }
            }
          }
          reader.readAsText(file)
        }
      }
      input.click()
    }
  }, [editor, fileOpenMode, loadMarkdownIntoEditor, appendMarkdownIntoEditor, openFileInTab, setFilePath])

  return { loadMarkdownIntoEditor, appendMarkdownIntoEditor, openFileInTab, handleStartNewDocument, handleOpenFile }
}