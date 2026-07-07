import { useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds, convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { type AmevaEditor, type AmevaPartialBlock } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'
import {
  parseFileToMarkdown,
  convertMarkdownToBinary,
  triggerBrowserDownload
} from '../../utils/fileConverters'

export function useAppFileOperations(
  editor: AmevaEditor | null,
  setEditorMode: (mode: EditorMode) => void,
  createSnapshot: (name: string, content: string) => void
) {
  const {
    filePath, setFilePath,
    currentContent, setCurrentContent,
    originalContent, setOriginalContent,
    lastSavedTime, setLastSavedTime,
    fileOpenMode,
    appendedFiles,
    setAppendedFiles,
    setActiveTabId,
    activeTabId,
    updateActiveTab,
    addTab
  } = useWorkspaceStore()

  // 파일 로딩 핵심 로직
  const loadMarkdownIntoEditor = useCallback(async (targetEditor: AmevaEditor, rawContent: string, isBinary = false, path = '') => {
    setEditorMode('edit')
    const markdown = await parseFileToMarkdown(rawContent, path || filePath || '', isBinary)
    const normalized = normalizeMarkdown(markdown)

    const lines = normalized.split('\n')
    if (lines.length > 200 && !isBinary) {
      const firstChunk = lines.slice(0, 120).join('\n')
      const remainingChunk = lines.slice(120).join('\n')

      const firstBlocks = await targetEditor.tryParseMarkdownToBlocks(firstChunk)
      cleanCodeBlocks(firstBlocks)
      ensureBlockIds(firstBlocks)
      targetEditor.replaceBlocks(targetEditor.document, firstBlocks)

      setTimeout(async () => {
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

    setOriginalContent(markdown)
    setCurrentContent(markdown)
    setLastSavedTime(null)
  }, [filePath, setEditorMode, setOriginalContent, setCurrentContent, setLastSavedTime])

  // 이어 붙여 열기
  const appendMarkdownIntoEditor = useCallback(async (targetEditor: AmevaEditor, rawContent: string, fileName: string, isBinary = false, path = '') => {
    const markdown = await parseFileToMarkdown(rawContent, path, isBinary)
    const normalized = normalizeMarkdown(markdown)
    const newBlocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
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

  // 탭으로 새로 열기
  const openFileInTab = useCallback(async (targetEditor: AmevaEditor, fileContent: string, path: string, isBinary = false) => {
    const currentBlocks = [...targetEditor.document]
    
    updateActiveTab({ filePath, content: currentContent, blocks: currentBlocks, originalContent, lastSavedTime })

    const markdown = await parseFileToMarkdown(fileContent, path, isBinary)
    const normalized = normalizeMarkdown(markdown)
    const parsed = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(parsed)
    ensureBlockIds(parsed)

    const newTabId = Math.random().toString(36).substring(2, 10)
    const newTab = {
      id: newTabId,
      filePath: path,
      content: markdown,
      blocks: parsed,
      originalContent: markdown,
      lastSavedTime: null
    }

    addTab(newTab)
    setActiveTabId(newTabId)
    setFilePath(path)
    setOriginalContent(markdown)
    setCurrentContent(markdown)
    setLastSavedTime(null)

    setTimeout(() => {
      targetEditor.replaceBlocks(targetEditor.document, parsed)
    }, 0)
  }, [activeTabId, filePath, currentContent, originalContent, lastSavedTime, addTab, setActiveTabId, setFilePath, setOriginalContent, setCurrentContent, setLastSavedTime, updateActiveTab])

  // 새 빈 문서 시작
  const handleStartNewDocument = useCallback(() => {
    if (editor) {
      const newBlock: AmevaPartialBlock = {
        id: Math.random().toString(36).substring(2, 10),
        type: 'paragraph',
        content: []
      }
      editor.replaceBlocks(editor.document, [newBlock])
    }
    setFilePath(null)
    setOriginalContent('')
    setCurrentContent('')
    setLastSavedTime(null)
    setEditorMode('edit')
  }, [editor, setFilePath, setOriginalContent, setCurrentContent, setLastSavedTime, setEditorMode])

  // 파일 열기 대화상자 트리거
  const handleOpenFile = useCallback(async () => {
    if (!editor) return
    if (ipc.isElectronEnv()) {
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
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt,.docx,.hwpx,.pdf,.xlsx,.ipynb'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = async (evt) => {
            const content = evt.target?.result as string
            const ext = file.name.split('.').pop()?.toLowerCase() || ''
            const isBinaryFile = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(ext)
            
            if (isBinaryFile) {
              const binReader = new FileReader()
              binReader.onload = async (binEvt) => {
                const arrBuffer = binEvt.target?.result as ArrayBuffer
                const base64 = arrayBufferToBase64(arrBuffer)
                if (fileOpenMode === 'append') {
                  await appendMarkdownIntoEditor(editor, base64, file.name, true, file.name)
                } else if (fileOpenMode === 'tab') {
                  await openFileInTab(editor, base64, file.name, true)
                } else {
                  setFilePath(file.name)
                  await loadMarkdownIntoEditor(editor, base64, true, file.name)
                }
              }
              binReader.readAsArrayBuffer(file)
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

  // 파일 저장
  const handleSaveFile = useCallback(async () => {
    if (!editor) return
    const path = filePath || 'document.md'
    const ext = path.split('.').pop()?.toLowerCase() || 'md'
    
    const rawBlocks = convertJupyterToCodeBlocks(editor.document)
    const markdown = await editor.blocksToMarkdownLossy(rawBlocks)
    const hasMedia = markdown.includes('data:video/') || markdown.includes('data:audio/')
    
    if (hasMedia && ['md', 'markdown', 'txt'].includes(ext)) {
      if (ipc.isElectronEnv()) {
        const boxRes = await ipc.showMessageBox({
          type: 'question',
          buttons: ['예 (권장)', '아니오'],
          defaultId: 0,
          title: '아메바 문서 포맷 변환 권장',
          message: '문서에 대용량 미디어 파일(동영상/오디오)이 감지되었습니다.\n미디어 공유가 완벽하게 지원되고 용량이 절감되는 아메바 문서 포맷(.adc)으로 변환하여 저장하시겠습니까?\n\n(아니오를 선택하시면 일반 마크다운 형식으로 저장이 계속 진행됩니다.)',
        })
        
        if (boxRes.response === 0) {
          const saveResult = await ipc.saveFile('', undefined)
          if (saveResult && saveResult.success && saveResult.filePath) {
            const savedPath = saveResult.filePath
            const newExt = savedPath.split('.').pop()?.toLowerCase() || 'md'
            let contentToSave: string
            if (newExt === 'adc') {
              const blob = await packMarkdownToADC(markdown)
              const arrayBuffer = await blob.arrayBuffer()
              contentToSave = arrayBufferToBase64(arrayBuffer)
            } else if (newExt === 'ipynb') {
              contentToSave = convertMarkdownToIpynb(markdown)
            } else if (['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(newExt)) {
              contentToSave = await convertMarkdownToBinary(editor, savedPath)
            } else {
              contentToSave = markdown
            }
            await ipc.saveFile(contentToSave, savedPath)
            setFilePath(savedPath)
            setOriginalContent(markdown)
            setLastSavedTime(new Date())
            createSnapshot(`Ameva Document 저장본`, contentToSave)
            return
          } else {
            return
          }
        }
      } else {
        const confirmSave = window.confirm("문서에 동영상 또는 오디오 파일이 포함되어 있습니다. 아메바 전용 포맷(.adc)으로 저장하시겠습니까?")
        if (confirmSave) {
          const blob = await packMarkdownToADC(markdown)
          triggerBrowserDownload(blob, (filePath ? filePath.split('.').slice(0, -1).join('.') : 'document') + '.adc')
          return
        }
      }
    }
    
    const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
    
    let contentToSave: string
    if (ext === 'ipynb') {
      contentToSave = convertMarkdownToIpynb(markdown)
    } else if (isBinarySave) {
      contentToSave = await convertMarkdownToBinary(editor, path)
    } else {
      contentToSave = markdown
    }
    
    if (ipc.isElectronEnv()) {
      const saveResult = await ipc.saveFile(contentToSave, filePath || undefined)
      if (saveResult && saveResult.success && saveResult.filePath) {
        const savedPath = saveResult.filePath
        setFilePath(savedPath)
        setOriginalContent(markdown)
        setLastSavedTime(new Date())
        createSnapshot(`저장본 (${new Date().toLocaleTimeString()})`, contentToSave)
      }
    } else {
      triggerBrowserDownload(contentToSave, filePath || 'document.' + ext)
      createSnapshot('웹 브라우저 저장본', contentToSave)
    }
  }, [editor, filePath, setFilePath, setOriginalContent, setLastSavedTime, createSnapshot])

  // 다른 이름으로 저장
  const handleSaveAsFile = useCallback(async () => {
    if (!editor) return
    const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
    
    if (ipc.isElectronEnv()) {
      const saveResult = await ipc.saveFile(markdown, undefined)
      if (saveResult && saveResult.success && saveResult.filePath) {
        const savedPath = saveResult.filePath
        const ext = savedPath.split('.').pop()?.toLowerCase() || 'md'
        const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'adc'].includes(ext)
        let contentToSave: string
        
        if (ext === 'ipynb') {
          contentToSave = convertMarkdownToIpynb(markdown)
        } else if (isBinarySave) {
          contentToSave = await convertMarkdownToBinary(editor, savedPath)
        } else {
          contentToSave = markdown
        }
        
        await ipc.saveFile(contentToSave, savedPath)
        setFilePath(savedPath)
        setOriginalContent(markdown)
        setLastSavedTime(new Date())
        createSnapshot('다른 이름으로 저장본', contentToSave)
      }
    } else {
      const wantOther = window.confirm(
        '브라우저에서는 파일 저장 대화상자가 지원되지 않습니다.\n' +
        'Markdown(.md) 파일로 다운로드하시겠습니까?\n' +
        '(Excel, PDF 등 다른 형식은 상단 [내보내기] 메뉴를 사용하세요)'
      )
      if (wantOther) {
        triggerBrowserDownload(markdown, 'document_new.md')
      }
    }
  }, [editor, setFilePath, setOriginalContent, setLastSavedTime, createSnapshot])

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
