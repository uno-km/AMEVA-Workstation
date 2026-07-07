import { useState, useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { packMarkdownToADC, unpackADCToMarkdown } from '../../utils/adcPackager'
import { convertJupyterToCodeBlocks, normalizeMarkdown, cleanCodeBlocks, ensureBlockIds } from '../../utils/markdownUtils'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'
import {
  blocksToHTML, exportToWord, exportToExcel, exportToHWPX
} from '../../utils/exporters'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'

// local helpers moved from App.tsx
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return window.btoa(binary)
}

function triggerBrowserDownload(data: Blob | string, filename: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function convertMarkdownToIpynb(markdown: string): string {
  const cells: any[] = []
  const lines = markdown.split('\n')
  let currentMarkdownLines: string[] = []
  let isCodeBlock = false
  let codeBlockLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        cells.push({
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: codeBlockLines.map((l, idx) => idx === codeBlockLines.length - 1 ? l : l + '\n')
        })
        codeBlockLines = []
        isCodeBlock = false
      } else {
        if (currentMarkdownLines.length > 0) {
          cells.push({
            cell_type: 'markdown',
            metadata: {},
            source: currentMarkdownLines.map((l, idx) => idx === currentMarkdownLines.length - 1 ? l : l + '\n')
          })
          currentMarkdownLines = []
        }
        isCodeBlock = true
      }
    } else {
      if (isCodeBlock) {
        codeBlockLines.push(line)
      } else {
        currentMarkdownLines.push(line)
      }
    }
  }
  
  if (currentMarkdownLines.length > 0) {
    cells.push({
      cell_type: 'markdown',
      metadata: {},
      source: currentMarkdownLines.map((l, idx) => idx === currentMarkdownLines.length - 1 ? l : l + '\n')
    })
  }
  
  const notebook = {
    cells,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }
    },
    nbformat: 4,
    nbformat_minor: 2
  }
  return JSON.stringify(notebook, null, 2)
}

async function convertMarkdownToBinary(editorInstance: any, filePath: string): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  const copyBlocks = (blocks: any[]): any[] => {
    return blocks.map(block => {
      const copy = { ...block }
      if (copy.type === 'jupyter') {
        copy.type = 'codeBlock'
        const lang = copy.props?.language || 'javascript'
        const finalCodeText = copy.props?.code || ''
        copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
        copy.props = { language: lang }
      } else if (copy.children) {
        copy.children = copyBlocks(copy.children)
      }
      return copy
    })
  }
  const rawBlocks = copyBlocks(editorInstance.document)
  
  if (ext === 'docx') {
    const blob = await exportToWord(rawBlocks)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer as ArrayBuffer)
  }
  
  if (ext === 'xlsx') {
    const uint8 = await exportToExcel(rawBlocks)
    return arrayBufferToBase64(uint8.buffer as ArrayBuffer)
  }
  
  if (ext === 'hwpx') {
    const blob = await exportToHWPX(rawBlocks)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer as ArrayBuffer)
  }
  
  if (ext === 'pdf') {
    const html = blocksToHTML(rawBlocks)
    if (ipc.isElectronEnv()) {
      const base64 = await ipc.printToPDF(html)
      return base64 || ''
    }
    // [HIGH-002] 브라우저 환경: 숨김 iframe + window.print() fallback
    await new Promise<void>((resolve) => {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-9999px'
      iframe.style.left = '-9999px'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      document.body.appendChild(iframe)
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (iframeDoc) {
        iframeDoc.open()
        iframeDoc.write(html)
        iframeDoc.close()
        iframe.contentWindow?.focus()
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => {
            document.body.removeChild(iframe)
            resolve()
          }, 500)
        }, 300)
      } else {
        document.body.removeChild(iframe)
        resolve()
      }
    })
    return ''
  }
  
  if (ext === 'adc') {
    const markdown = await editorInstance.blocksToMarkdownLossy(rawBlocks)
    const blob = await packMarkdownToADC(markdown)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer)
  }
  
  return ''
}

async function parseFileToMarkdown(content: string, filePath: string, isBinary: boolean): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  if (!isBinary) {
    if (ext === 'ipynb') {
      try {
        const json = JSON.parse(content)
        const cells = json.cells || []
        const mdLines: string[] = []
        
        let kernelLang = 'python'
        try {
          kernelLang = json.metadata?.kernelspec?.language || 'python'
        } catch {}
        
        for (const cell of cells) {
          const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source || ''
          if (cell.cell_type === 'markdown') {
            mdLines.push(source)
            mdLines.push('')
          } else if (cell.cell_type === 'code') {
            mdLines.push(`\`\`\`${kernelLang}`)
            mdLines.push(source)
            mdLines.push('```')
            mdLines.push('')
          }
        }
        return mdLines.join('\n')
      } catch (err: any) {
        return `Error parsing Jupyter Notebook: ${err.message}`
      }
    }
    return content
  }
  
  let binaryString = ''
  try {
    binaryString = window.atob(content.replace(/\s/g, ''))
  } catch (e) {
    console.warn('[parseFileToMarkdown] atob 디코딩 실패, 원본 텍스트 폴백 사용:', e)
    return content
  }
  
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const arrayBuffer = bytes.buffer
  
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const result = await (mammoth as any).convertToMarkdown({ arrayBuffer })
      return result.value
    } catch (err: any) {
      try {
        const zip = await JSZip.loadAsync(arrayBuffer)
        const docXml = await zip.file('word/document.xml')?.async('text')
        if (!docXml) return `Error parsing DOCX: word/document.xml not found`
        const pMatches = docXml.match(/<w:p[\s\S]*?>([\s\S]*?)<\/w:p>/g) || []
        const lines: string[] = []
        for (const pXml of pMatches) {
          const tMatches = pXml.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || []
          let pText = ''
          for (const tXml of tMatches) {
            const text = tXml.replace(/<w:t[\s\S]*?>/, '').replace('</w:t>', '')
            pText += text
          }
          lines.push(pText)
        }
        return lines.join('\n\n')
      } catch (innerErr: any) {
        return `Error parsing DOCX: ${err.message} (Backup failed: ${innerErr.message})`
      }
    }
  }

  if (ext === 'adc') {
    try {
      const markdown = await unpackADCToMarkdown(arrayBuffer)
      return markdown
    } catch (err: any) {
      return `Error unpacking Ameva Document: ${err.message}`
    }
  }
  
  if (ext === 'hwpx') {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer)
      const sectionXml = await zip.file('Contents/section0.xml')?.async('text')
      if (!sectionXml) return 'Error parsing HWPX: section0.xml not found'
      const pMatches = sectionXml.match(/<hp:p[\s\S]*?>([\s\S]*?)<\/hp:p>/g) || []
      const lines: string[] = []
      for (const pXml of pMatches) {
        const tMatches = pXml.match(/<hp:t[\s\S]*?>([\s\S]*?)<\/hp:t>/g) || []
        let pText = ''
        for (const tXml of tMatches) {
          const text = tXml.replace(/<hp:t[\s\S]*?>/, '').replace('</hp:t>', '')
          pText += text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        }
        lines.push(pText.trim())
      }
      return lines.join('\n\n')
    } catch (err: any) {
      return `Error parsing HWPX: ${err.message}`
    }
  }
  
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(bytes.buffer as ArrayBuffer)
      const mdLines: string[] = []
      wb.eachSheet((worksheet) => {
        mdLines.push(`## Sheet: ${worksheet.name}`)
        mdLines.push('')
        const sheetRows: string[][] = []
        worksheet.eachRow((row) => {
          const cells = (row.values as any[]).slice(1).map(v =>
            v != null ? String(v).replace(/\|/g, '\\|') : ''
          )
          sheetRows.push(cells)
        })
        if (sheetRows.length === 0) {
          mdLines.push('*Empty Sheet*')
          mdLines.push('')
          return
        }
        const mdTableLines = sheetRows.map((cells, idx) => {
          const line = '| ' + cells.join(' | ') + ' |'
          if (idx === 0) {
            const separator = '| ' + cells.map(() => '---').join(' | ') + ' |'
            return line + '\n' + separator
          }
          return line
        })
        mdLines.push(mdTableLines.join('\n'))
        mdLines.push('')
      })
      return mdLines.join('\n')
    } catch (err: any) {
      return `Error parsing Excel: ${err.message}`
    }
  }
  
  return `Binary file loaded. Content size: ${bytes.length} bytes.`
}

export function useAppFileOperations(
  editor: AmevaEditor | null,
  setEditorMode: (mode: 'welcome' | 'edit' | 'preview' | 'write' | 'raw') => void,
  createSnapshot: (name: string, content: string) => void
) {
  const {
    filePath, setFilePath,
    currentContent, setCurrentContent,
    originalContent, setOriginalContent,
    lastSavedTime, setLastSavedTime,
    fileOpenMode,
    setAppendedFiles,
    setTabs,
    setActiveTabId,
    activeTabId,
    updateActiveTab,
    addTab,
    tabs
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
    setAppendedFiles(prev => [...prev, { id: `append-${Date.now()}`, filePath: fileName, startBlockId: firstBlockId }])

    const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
    setCurrentContent(derived)
  }, [setAppendedFiles, setCurrentContent])

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
      editor.replaceBlocks(editor.document, [
        {
          id: Math.random().toString(36).substring(2, 10),
          type: 'paragraph',
          content: [] as any
        }
      ])
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
