import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { MarkdownEditor } from './components/MarkdownEditor'
import { DiffModal } from './components/DiffModal'
import { SettingsModal, type AppSettings, type HotkeyConfig } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { MenuBar } from './components/MenuBar'
import { AboutModal } from './components/AboutModal'
import { MarkdownGuideModal } from './components/MarkdownGuideModal'
import { AIPanel } from './components/AIPanel'
import { Minimap } from './components/Minimap'
import { RightTabStrip } from './components/RightTabStrip'
import { MarketplaceModal } from './components/MarketplaceModal'
import { PricingModal } from './components/PricingModal'
import { ExportModal } from './components/ExportModal'
import type { ExportProgress } from './components/ExportModal'
import { ResizeHandle } from './components/ResizeHandle'
import { useCollaboration } from './hooks/useCollaboration'
import { useHistory } from './hooks/useHistory'
import { useAI } from './hooks/useAI'
import { useChat } from './hooks/useChat'
import { usePanelResize } from './hooks/usePanelResize'
import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { JupyterBlock } from './components/JupyterBlock'
import type { EditorMode, ExportFormat, DocumentSnapshot } from '../shared/types'
import { PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  blocksToHTML, exportToWord, exportToExcel,
  exportToPPTX, exportToHWPX, exportToXML,
} from './utils/exporters'
import { normalizeBlocks } from './utils/normalizeBlocks'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { FloatingChat } from './components/FloatingChat'
import { packMarkdownToADC, unpackADCToMarkdown } from './utils/adcPackager'
import { DrawingBlock } from './components/DrawingBlock'
import { FindReplaceBar } from './components/FindReplaceBar'

// ── 키보드 단축키 동적 매칭 헬퍼 함수 ───────────────────────────
const matchHotkey = (e: KeyboardEvent, hotkeyStr: string) => {
  if (!hotkeyStr) return false
  
  const parts = hotkeyStr.toLowerCase().split('+')
  const key = parts.pop()
  
  const needCtrl = parts.includes('control') || parts.includes('ctrl')
  const needShift = parts.includes('shift')
  const needAlt = parts.includes('alt')
  const needMeta = parts.includes('meta') || parts.includes('cmd')
  
  const hasCtrl = e.ctrlKey || e.metaKey
  const hasShift = e.shiftKey
  const hasAlt = e.altKey
  const hasMeta = e.metaKey
  
  if (needCtrl && !hasCtrl) return false
  if (needShift && !hasShift) return false
  if (needAlt && !hasAlt) return false
  if (needMeta && !hasMeta) return false
  
  // 보조키를 요구하지 않는데 눌려있다면 일치하지 않는 것으로 처리
  if (!needCtrl && hasCtrl) return false
  if (!needShift && hasShift) return false
  
  return e.key.toLowerCase() === key
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    jupyter: JupyterBlock,
    drawing: DrawingBlock
  }
})

// jupyter 블록을 마크다운 변환 시 표준 codeBlock으로 복구하는 도우미 (drawing 블록 포함)
function convertJupyterToCodeBlocks(blocks: any[]): any[] {
  return blocks.map(block => {
    const copy = { ...block }
    if (copy.type === 'jupyter') {
      copy.type = 'codeBlock'
      const lang = copy.props?.language || 'javascript'
      const finalCodeText = copy.props?.code || ''
      copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
      copy.props = {
        language: lang
      }
    } else if (copy.type === 'drawing') {
      copy.type = 'codeBlock'
      const dataText = copy.props?.data || '[]'
      copy.content = [{ type: 'text', text: dataText, styles: {} }]
      copy.props = {
        language: 'ameva-drawing'
      }
    } else if (copy.children) {
      copy.children = convertJupyterToCodeBlocks(copy.children)
    }
    return copy
  })
}

// ── 랜덤 사용자 설정 ─────────────────────────────────────────
const COLLAB_COLORS = ['#a855f7', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e']
const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)]
const randomUsername = `User_${Math.random().toString(36).substring(2, 7).toUpperCase()}`

// ── 마크다운 전처리 ───────────────────────────────────────────
function normalizeMarkdown(raw: string): string {
  let content = raw.replace(/\r\n/g, '\n')
  content = content.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

  const parts = content.split('```')
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i]) {
      parts[i] = parts[i].replace(/\n\s*\n/g, '\n\u200B\n')
      parts[i] = parts[i].replace(/</g, '__LT_TEMP__')
      parts[i] = parts[i].replace(/>/g, '__GT_TEMP__')
    }
  }
  content = parts.join('```')
  
  // opening fence 정밀 매칭 (뒤에 알파벳/숫자 언어명이 오고 개행이 오는 경우)
  content = content.replace(/\n*```([a-zA-Z0-9_-]+)[^\n]*\n+/g, (match, lang) => {
    const l = lang.toLowerCase()
    const mapped = l === 'js' ? 'javascript' : l === 'ts' ? 'typescript' : l === 'py' ? 'python' : l
    return `\n\n\`\`\`${mapped}\n`
  })
  // closing fence 또는 언어가 없는 fence 정밀 매칭
  content = content.replace(/\n*```[ \t]*\n+/g, '\n```\n\n')
  
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

function cleanCodeBlocks(blocks: any[]) {
  const supportedLangs = ['python', 'py', 'javascript', 'js', 'html', 'css', 'c', 'cpp', 'java', 'xml', 'json', 'text', 'txt', 'plaintext', 'mermaid', 'bash', 'sh', 'typescript', 'ts', 'sql', 'ameva-drawing']
  blocks.forEach(block => {
    if (block.type === 'codeBlock') {
      const text = block.content ? block.content.map((c: any) => c.text).join('') : ''
      let cleaned = text.replace(/\u200B/g, '').replace(/__LT_TEMP__/g, '<').replace(/__GT_TEMP__/g, '>')
      const lines = cleaned.split('\n')
      const firstLine = lines[0]?.trim()
      
      let lang = 'javascript'
      let finalCode = cleaned
      
      // 1단계: 정밀 주석 메타데이터 매칭 시도
      const amevaLangMatch = firstLine ? firstLine.match(/^(?:\/\/#|--|<!--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\](?:\s*-->)?/) || firstLine.match(/^(?:\/\/|#|--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\]/) : null
      if (amevaLangMatch) {
        lang = amevaLangMatch[1].toLowerCase()
        finalCode = lines.slice(1).join('\n')
      } 
      // 2단계: 첫 번째 줄 단어 매칭 시도 (지원 언어명 매칭 또는 블록의 설정 언어와 일치하는 경우 강제 스트립)
      else if (firstLine && (
        supportedLangs.includes(firstLine.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === block.props.language.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === 'py' && block.props.language.toLowerCase() === 'python') ||
        (block.props?.language && firstLine.toLowerCase() === 'js' && block.props.language.toLowerCase() === 'javascript') ||
        (block.props?.language && firstLine.toLowerCase() === 'ts' && block.props.language.toLowerCase() === 'typescript')
      )) {
        lang = firstLine.toLowerCase() === 'py' ? 'python' : firstLine.toLowerCase() === 'js' ? 'javascript' : firstLine.toLowerCase() === 'ts' ? 'typescript' : firstLine.toLowerCase()
        if (block.props?.language && !supportedLangs.includes(firstLine.toLowerCase())) {
          lang = block.props.language.toLowerCase()
        }
        finalCode = lines.slice(1).join('\n')
      } 
      // 3단계: 기본 block.props.language 매칭 시도 (js, ts, py 단축어 매핑 포함)
      else {
        const rawLang = (block.props?.language || 'javascript').toLowerCase()
        lang = rawLang === 'js' ? 'javascript' : rawLang === 'ts' ? 'typescript' : rawLang === 'py' ? 'python' : rawLang
      }
      
      // ameva-drawing 인 경우 jupyter 로 가는 대신 drawing 블록으로 다이렉트 변환
      if (lang === 'ameva-drawing') {
        block.type = 'drawing'
        block.props = {
          data: finalCode
        }
        block.content = undefined
        return
      }

      block.type = 'jupyter'
      block.props = {
        language: lang,
        code: finalCode,
        runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
      }
      block.content = undefined
    }
    if (block.type === 'image' && block.props?.url) {
      const url = block.props.url.toLowerCase()
      const isVideo = url.endsWith('.mp4') || 
                      url.endsWith('.webm') || 
                      url.endsWith('.mov') || 
                      url.endsWith('.ogg') ||
                      url.startsWith('data:video/')
      if (isVideo) {
        block.type = 'video'
      }
    }
    if (block.children) {
      cleanCodeBlocks(block.children)
    }
  })
}

function ensureBlockIds(blocks: any[]) {
  const generateId = () => Math.random().toString(36).substring(2, 10)
  blocks.forEach(block => {
    if (!block.id) {
      block.id = generateId()
    }
    if (block.children) {
      ensureBlockIds(block.children)
    }
  })
}

function cleanMarkdownCodeBlocks(markdown: string): string {
  const norm = (l: string) => {
    const low = l.toLowerCase()
    if (low === 'js') return 'javascript'
    if (low === 'ts') return 'typescript'
    if (low === 'py') return 'python'
    if (low === 'txt') return 'text'
    if (low === 'sh') return 'bash'
    return low
  }
  return markdown.replace(/```([a-zA-Z0-9_-]+)\n\s*([a-zA-Z0-9_-]+)\n/g, (match, lang1, lang2) => {
    if (norm(lang1) === norm(lang2)) {
      return `\`\`\`${lang1}\n`
    }
    return match
  })
}


async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

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

async function parseFileToMarkdown(content: string, filePath: string, isBinary: boolean): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  
  if (!isBinary) {
    if (ext === 'ipynb') {
      try {
        const notebook = JSON.parse(content)
        const cells = notebook.cells || []
        const mdLines: string[] = []
        const kernelLang = notebook.metadata?.kernelspec?.language || 'python'
        
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
  
  const binaryString = window.atob(content)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const arrayBuffer = bytes.buffer
  
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToMarkdown({ arrayBuffer })
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
      // [SEC-W-018] ExcelJS 사용 — xlsx CVE-2023-30533 해소
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

async function convertMarkdownToBinary(editorInstance: BlockNoteEditor, filePath: string): Promise<string> {
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
    return arrayBufferToBase64(arrayBuffer)
  }
  
  if (ext === 'xlsx') {
    const uint8 = await exportToExcel(rawBlocks)
    return arrayBufferToBase64(uint8.buffer)
  }
  
  if (ext === 'hwpx') {
    const blob = await exportToHWPX(rawBlocks)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer)
  }
  
  if (ext === 'pdf') {
    const html = blocksToHTML(rawBlocks)
    if (window.electronAPI?.printToPDF) {
      const base64 = await window.electronAPI.printToPDF(html)
      return base64
    }
    // [HIGH-002] 브라우저 환경: 숨김젠 iframe + window.print() fallback
    // Electron 없으면 브라우저 인쇄 대화상자를 연다
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
    return null
  }
  
  if (ext === 'adc') {
    const markdown = await editorInstance.blocksToMarkdownLossy(rawBlocks)
    const blob = await packMarkdownToADC(markdown)
    const arrayBuffer = await blob.arrayBuffer()
    return arrayBufferToBase64(arrayBuffer)
  }
  
  throw new Error(`Unsupported binary save format: ${ext}`)
}

// ── 메인 앱 컴포넌트 ─────────────────────────────────────────
export default function App() {
  const [documentId] = useState('default-doc')
  const [username] = useState(randomUsername)
  const [userColor] = useState(randomColor)

  const [editorMode, setEditorMode] = useState<EditorMode>('welcome')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState('')
  const [isChatFloating, setIsChatFloating] = useState(false)
  const [hasChatUnread, setHasChatUnread] = useState(false)

  // ── 파일 오픈 모드 및 다중 파일 관리 상태 ──
  const [fileOpenMode, setFileOpenMode] = useState<'replace' | 'append' | 'tab'>('replace')
  const [appendedFiles, setAppendedFiles] = useState<{ id: string; filePath: string; startBlockId: string }[]>([])
  const [tabs, setTabs] = useState<{ id: string; filePath: string | null; content: string; blocks: any[] }[]>([
    { id: 'default', filePath: null, content: '', blocks: [] }
  ])
  const [activeTabId, setActiveTabId] = useState<string | null>('default')
  const currentContentRef = useRef('')

  useEffect(() => {
    currentContentRef.current = currentContent
  }, [currentContent])

  // 탭별 작성 내용 실시간 동기화
  useEffect(() => {
    if (fileOpenMode === 'tab' && activeTabId) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return { ...t, content: currentContent }
        }
        return t
      }))
    }
  }, [currentContent, activeTabId, fileOpenMode])



  // 에디터 영역 CSS zoom (1.0 = 100%, Electron 네이티브 줄 미사용)
  const [editorZoom, setEditorZoom] = useState(1.0)

  // 브라우저 전체 zoom (webFrame.setZoomFactor) — 에디터 외 영역
  const [browserZoom, setBrowserZoom] = useState(1.0)

  useEffect(() => {
    if (window.electronAPI?.getZoomFactor) {
      window.electronAPI.getZoomFactor().then(val => {
        if (typeof val === 'number') setBrowserZoom(val)
      })
    }
  }, [])


  const [showStatusBar, setShowStatusBar] = useState(true)
  const [downloadStatus, setDownloadStatus] = useState<any>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 🔍 찾기 및 바꾸기 (Find & Replace) 제어 상태
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findReplaceMode, setFindReplaceMode] = useState<'find' | 'replace'>('find')

  // 실시간 모델 다운로드 상태 및 토스트 메세지 연동
  useEffect(() => {
    if (window.electronAPI?.onLLMDownloadProgress) {
      const unsub = window.electronAPI.onLLMDownloadProgress((status: any) => {
        setDownloadStatus(prev => {
          const filenameOnly = status.filename.split(/[\\/]/).pop()
          
          // 다운로드 신규 추가 시
          if (!prev && status) {
            setToastMessage(`📥 [다운로드 시작] '${filenameOnly}' 다운로드 작업이 시작되었습니다.`)
            setTimeout(() => setToastMessage(null), 3500)
          }
          
          // 다운로드 완료 시 (progress 100)
          if (status.progress === 100 && (!prev || prev.progress < 100)) {
            setToastMessage(`🎉 [설치 완료] '${filenameOnly}' 모델 설치가 완료되었습니다!`)
            setTimeout(() => {
              setToastMessage(null)
              setDownloadStatus(null)
            }, 4000)
          }
          
          return status
        })
      })
      return () => unsub()
    }
  }, [])

  const [showSidebar, setShowSidebar] = useState(true)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState<string>('ai')
  const [showMarketplaceModal, setShowMarketplaceModal] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)

  // 🦾 SaaS Pro Plan 상태 및 시작 인자 기전
  const [isProPlan, setIsProPlan] = useState<boolean>(() => {
    try {
      return localStorage.getItem('is-pro-plan') === 'true'
    } catch {
      return false
    }
  })
  const [isFreeModeLocked, setIsFreeModeLocked] = useState(false)
  const [mcpServersState, setMcpServersState] = useState<any[]>([])

  // 초기 시작 시 무료 기전 플래그 체크 및 MCP 리스트 로드
  useEffect(() => {
    const initFlagsAndMcp = async () => {
      if (window.electronAPI?.planGetStatus) {
        const backendPro = await window.electronAPI.planGetStatus()
        console.log('[App] 메인 프로세스로부터 로드한 요금제 상태:', backendPro ? '👑 PRO' : 'FREE')
        localStorage.setItem('is-pro-plan', String(backendPro))
        setIsProPlan(backendPro)
      }

      if (window.electronAPI?.isFreeMode) {
        const isFree = await window.electronAPI.isFreeMode()
        if (isFree) {
          console.log('[App] --free 시작 플래그 감지. 무료 모드로 강제 기동합니다.')
          localStorage.setItem('is-pro-plan', 'false')
          setIsProPlan(false)
          setIsFreeModeLocked(true)
        }
      }
      
      // MCP 설정 불러오기
      try {
        const stored = localStorage.getItem('mcp-servers-config')
        if (stored) {
          setMcpServersState(JSON.parse(stored))
        } else {
          // 기본값 동기화
          setMcpServersState([
            {
              id: 'mcp-wasm-gateway',
              name: 'AMEVA OS WASM Gateway',
              type: 'http',
              url: 'http://127.0.0.1:11553/mcp',
              enabled: true
            }
          ])
        }
      } catch (e) {
        console.error('[App] MCP 로드 오류:', e)
      }
    }
    
    initFlagsAndMcp()
  }, [])

  // 환경설정 창 닫히거나 변경되었을 때 실시간 상태 갱신 리로드 헬퍼
  const refreshMcpServers = () => {
    try {
      const stored = localStorage.getItem('mcp-servers-config')
      if (stored) setMcpServersState(JSON.parse(stored))
      
      const proStored = localStorage.getItem('is-pro-plan') === 'true'
      setIsProPlan(proStored)
    } catch {}
  }
  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
      const existingScript = document.getElementById(`script-plugin-${id}`)
      if (!existingScript) {
        const res = await fetch(scriptUrl)
        if (!res.ok) throw new Error('스크립트 다운로드 실패')
        const scriptText = await res.text()
        
        const script = document.createElement('script')
        script.id = `script-plugin-${id}`
        script.text = scriptText
        document.body.appendChild(script)
      }

      return new Promise<void>((resolve, reject) => {
        let checkCount = 0
        const checkInterval = setInterval(() => {
          checkCount++
          if ((window as any).AMEVA_PLUGINS?.[id]) {
            clearInterval(checkInterval)
            
            const current = settings.installedPlugins || []
            if (!current.includes(id)) {
              const next = [...current, id]
              handleUpdateSettings({ installedPlugins: next })
            }
            resolve()
          }
          if (checkCount > 15) {
            clearInterval(checkInterval)
            reject(new Error('플러그인 로드 타임아웃'))
          }
        }, 100)
      })
    } catch (err) {
      console.error('플러그인 로드 오류:', err)
      throw err
    }
  }

  const handleUninstallPlugin = (id: string) => {
    const script = document.getElementById(`script-plugin-${id}`)
    if (script) {
      script.remove()
    }
    if ((window as any).AMEVA_PLUGINS?.[id]) {
      delete (window as any).AMEVA_PLUGINS[id]
    }
    
    const current = settings.installedPlugins || []
    const next = current.filter((p) => p !== id)
    handleUpdateSettings({ installedPlugins: next })

    if ((id === 'outline' || id === 'calculator') && activeRightTab === id) {
      setActiveRightTab('ai')
    }
  }

  const handleToggleRightTab = (tab: string) => {
    if (showAIPanel && activeRightTab === tab) {
      setShowAIPanel(false)
    } else {
      setActiveRightTab(tab)
      setShowAIPanel(true)
    }
  }

  const [settings, setSettings] = useState<AppSettings>(() => {
    const DEFAULT: AppSettings = {
      showPeersPointer: true,
      showPeersDrag: true,
      showCodeConsole: true,
      autoSnapshot: true,
      theme: 'dark',
      wordWrap: true,
      showMinimap: true,
      installedPlugins: [],
      hotkeys: {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }
    }
    try {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.hotkeys && (parsed.hotkeys.toggleMode === 'Control+h' || parsed.hotkeys.toggleMode === 'Control+v')) {
          parsed.hotkeys.toggleMode = 'Control+e'
          localStorage.setItem('app-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT, ...parsed }
      }
    } catch {}
    return DEFAULT
  })

  // [PERF] 앱 최초 마운트 시 settings.installedPlugins 에 남아있는 익스텐션 목록 복구 로드
  // 메인 UI가 가볍고 부드럽게 먼저 로드될 수 있도록 1200ms 레이지 로딩(Lazy loading) 및 병렬 가동 처리
  useEffect(() => {
    if (settings.installedPlugins && settings.installedPlugins.length > 0) {
      const timer = setTimeout(() => {
        settings.installedPlugins.forEach(async (id) => {
          const scriptUrl = `http://localhost:3010/plugins/${id}.js`
          try {
            await handleInstallPlugin(id, scriptUrl)
          } catch (e) {
            console.error(`부팅 시 플러그인 ${id} 자동 활성화 실패:`, e)
          }
        })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // ── YouTube PiP (Picture-in-Picture) 플로팅 상태 및 제어 ──
  const [pipVideoId, setPipVideoId] = useState<string | null>(null)
  const [pipPosition, setPipPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 260 })
  const [isDraggingPip, setIsDraggingPip] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    (window as any).AMEVA_TRIGGER_YOUTUBE_PIP = (videoId: string) => {
      setPipVideoId(videoId)
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPip) {
        setPipPosition({
          x: Math.max(10, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x)),
          y: Math.max(10, Math.min(window.innerHeight - 240, e.clientY - dragOffset.y))
        })
      }
    }
    const handleMouseUp = () => {
      setIsDraggingPip(false)
    }

    if (isDraggingPip) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPip, dragOffset])

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const [serverPort, setServerPort] = useState(1234)
  const [serverHost, setServerHost] = useState('localhost')
  const [useLocalServer, setUseLocalServer] = useState(true)

  // ── 패널 크기 조절 (usePanelResize) ──────────────────────
  const {
    width: sidebarWidth,
    isDragging: isSidebarDragging,
    handleMouseDown: handleSidebarResizeStart,
  } = usePanelResize({
    storageKey: 'sidebar',
    defaultWidth: 280,
    minWidth: 160,
    maxWidth: 520,
    direction: 'right',
  })

  const {
    width: aiPanelWidth,
    isDragging: isAIPanelDragging,
    handleMouseDown: handleAIPanelResizeStart,
  } = usePanelResize({
    storageKey: 'ai-panel',
    defaultWidth: 320,
    minWidth: 220,
    maxWidth: 600,
    direction: 'left',
  })

  // ── Export 진행 상태 ────────────────────────────────────────
  const IDLE_PROGRESS: ExportProgress = { phase: 'idle', format: '', percent: 0, message: '' }
  const [exportProgress, setExportProgress] = useState<ExportProgress>(IDLE_PROGRESS)
  const [exportMinimized, setExportMinimized] = useState(false)
  const [showModelHub, setShowModelHub] = useState(false) // 🤖 AI 모델 셋업 허브 모달 전역화

  // ── [PERF] 코어 퍼포먼스: 문서 최우선 로드 및 부속 패널 지연(Progressive Loading) 기법 ──
  const [isSidebarReady, setIsSidebarReady] = useState(false)
  const [isAIPanelReady, setIsAIPanelReady] = useState(false)

  useEffect(() => {
    const timerSidebar = setTimeout(() => setIsSidebarReady(true), 250) // 문서 로드 완료 직후 로딩
    const timerAI = setTimeout(() => setIsAIPanelReady(true), 1500)      // AI 엔진 및 우측 패널 연동은 1.5초 뒤 늦게 가동
    return () => {
      clearTimeout(timerSidebar)
      clearTimeout(timerAI)
    }
  }, [])

  // ── 훅 초기화 ──────────────────────────────────────────────
  const {
    ydoc, provider, peers, serverRunning, serverInfo, serverIp,
    isConnected, toggleLocalServer, handleMouseMove,
    updateDragSelection, updateBlockHighlight, editorContainerRef,
    isActive, collaborationLink,
  } = useCollaboration(documentId, username, userColor, serverPort, serverHost, useLocalServer)

  const { snapshots, createSnapshot, deleteSnapshot, getLineDiff } = useHistory(documentId)

  const {
    messages: aiMessages, isGenerating, isAvailable, models,
    settings: aiSettings, generateResponse, abortGeneration,
    clearHistory: clearAIHistory, updateSettings: updateAISettings,
    updateMessageDiffState, updateInsertSuggestionStatus, engineLogs,
    refreshModels, importModel,
  } = useAI()

  const { messages: chatMessages, sendMessage: sendChatMessage, clearMessages: clearChatMessages } = useChat(
    ydoc, provider, username, userColor, serverRunning
  )

  // 채팅 읽지 않음(unread) 주황점 감지 연계
  useEffect(() => {
    if (chatMessages.length === 0) return
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg.author !== username && (isChatFloating || activeTabId !== 'chat')) {
      setHasChatUnread(true)
    }
  }, [chatMessages, isChatFloating, activeTabId])

  // ── BlockNote 에디터 ────────────────────────────────────────
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null)
  const isInitialLoad = useRef(true)

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
  }, [editor, currentContent])

  // ── AI 에디터 텍스트 연동 및 적용 ─────────────────────────────
  const [selectedText, setSelectedText] = useState('')
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  // 🤖 AI 컨텍스트 주입용 참조된 블록(라인) 상태 정의
  const [taggedBlocks, setTaggedBlocks] = useState<{ id: string; text: string }[]>([])

  // 🤖 원본 콘텐츠 보관 상태 (수정 여부(isDirty) 판별 전용)
  const [originalContent, setOriginalContent] = useState<string>('')

  // 🤖 최근 저장 완료 시각 보관 상태
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null)

  // 🤖 에디터에서 별표 버튼 클릭 시 에이전트 패널을 자동으로 기동해주기 위한 커스텀 설정 함수
  const customSetTaggedBlocks = useCallback((
    val: React.SetStateAction<{ id: string; text: string }[]>
  ) => {
    setTaggedBlocks(prev => {
      const next = typeof val === 'function' ? val(prev) : val
      if (next.length > prev.length) {
        setShowAIPanel(true)
        setActiveRightTab('ai')
        setToastMessage('선택한 블록이 AI 어시스턴트에 참조 태그되었습니다.')
        setTimeout(() => {
          setToastMessage(prev => prev === '선택한 블록이 AI 어시스턴트에 참조 태그되었습니다.' ? null : prev)
        }, 3000)
      }
      return next
    })
  }, [])

  // 🤖 Ctrl+N 입력 시 새 탭을 추가하고 활성화하는 헬퍼
  const handleNewTab = useCallback(() => {
    if (!editor) return
    
    // 현재 탭의 변경 사항 저장
    const currentBlocks = [...editor.document]
    const activeId = activeTabId

    const newTabId = Math.random().toString(36).substring(2, 10)
    const newTab = {
      id: newTabId,
      filePath: null,
      content: '',
      blocks: [
        {
          id: Math.random().toString(36).substring(2, 10),
          type: 'paragraph',
          content: []
        }
      ],
      originalContent: '',
      lastSavedTime: null
    }

    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeId) {
          return { ...t, filePath: filePath, content: currentContent, blocks: currentBlocks, originalContent: originalContent, lastSavedTime: lastSavedTime }
        }
        return t
      })
      return [...updated, newTab]
    })

    setActiveTabId(newTabId)
    setFilePath(null)
    setCurrentContent('')
    setOriginalContent('')
    setLastSavedTime(null)
    
    setTimeout(() => {
      editor.replaceBlocks(editor.document, newTab.blocks)
    }, 0)
  }, [editor, activeTabId, filePath, currentContent, originalContent, lastSavedTime])

  // 🤖 참조된 블록(라인) 자동 스크롤 및 하이라이트 효과 적용 함수
  const handleScrollToBlock = useCallback((blockId: string) => {
    const el = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const outer = el.closest('.bn-block-outer') || el
      if (outer) {
        outer.setAttribute('data-highlighted-temp', 'true')
        setTimeout(() => {
          outer.removeAttribute('data-highlighted-temp')
        }, 1500)
      }
    }
  }, [])

  const handleApplySuggestion = useCallback((text: string, mode: 'replace' | 'insert', blockId?: string, isCodeBlock?: boolean, lang?: string) => {
    if (!editor) return
    try {
      // 🦾 [Jupyter 삽입 연동] 챗봇의 코드블럭에서 '본문에 삽입'을 누른 경우, 실행 가능한 에디터 고유의 jupyter 블록으로 인서트
      if (isCodeBlock) {
        try {
          const finalLang = lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : lang === 'py' ? 'python' : (lang || 'javascript')
          const blockPayload = {
            type: 'jupyter',
            props: {
              language: finalLang,
              code: text,
              runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
            }
          }
          
          const doc = editor.document || []
          const activeBlock = editor.getTextCursorPosition()?.block
          if (activeBlock) {
            editor.insertBlocks([blockPayload], activeBlock, 'after')
          } else {
            editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
          }
          return
        } catch (jErr) {
          console.error('[Jupyter Auto-Insert Failed]', jErr)
        }
      }

      if (blockId) {
        try {
          const targetBlock = editor.getBlock(blockId)
          if (targetBlock) {
            if (targetBlock.type === 'jupyter') {
              editor.updateBlock(blockId, {
                type: 'jupyter',
                props: { ...targetBlock.props, code: text }
              })
            } else {
              editor.updateBlock(blockId, {
                content: text
              })
            }
            return
          }
        } catch (bErr) {
          console.warn('블록 단위 직접 업데이트 실패, selection 폴백 실행:', bErr)
        }
      }

      const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
      if (view) {
        const { state, dispatch } = view
        const { tr, selection } = state
        if (mode === 'replace') {
          dispatch(tr.replaceSelectionWith(state.schema.text(text)))
        } else {
          dispatch(tr.insertText(text, selection.to))
        }
        // 에디터 포커싱 및 연동 초기화
        setTimeout(() => {
          try {
            if (view && view.dom && document.body.contains(view.dom) && typeof view.focus === 'function') {
              view.focus()
            }
          } catch (e) {
            console.warn('Failed to focus editor view:', e)
          }
          setSelectedText('')
        }, 20)
      }
    } catch (err) {
      console.error('AI 제안 에디터 반영 실패:', err)
    }
  }, [editor])

  /**
   * AI 삽입 제안 승인 핸들러
   * InsertSuggestion의 afterBlockId 위치 다음에 더블 타입 블록을 삽입한다.
   */
  const handleApplyInsertSuggestion = useCallback((
    msgId: string,
    afterBlockId: string,
    blockType: string,
    content: string,
    level?: number,
    suggestionIndex?: number
  ) => {
    if (!editor) return
    try {
      // BlockNote 삽입 페이로드 생성
      const blockPayload: any = {
        id: Math.random().toString(36).substring(2, 10),
        type: blockType === 'heading' ? 'heading'
          : blockType === 'bulletListItem' ? 'bulletListItem'
          : blockType === 'numberedListItem' ? 'numberedListItem'
          : 'paragraph',
        content: [{ type: 'text', text: content, styles: {} }],
      }
      if (blockType === 'heading' && level) {
        blockPayload.props = { level: Math.min(3, Math.max(1, level)) as 1 | 2 | 3 }
      }

      const doc = editor.document
      if (!doc || doc.length === 0) {
        // 빈 문서: 첫 번째 블록으로 교체
        editor.replaceBlocks(doc, [blockPayload])
      } else if (afterBlockId === 'START') {
        editor.insertBlocks([blockPayload], doc[0], 'before')
      } else if (afterBlockId === 'END') {
        editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
      } else {
        // 실제 블록 ID 찾기
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(doc)
        const targetBlock = flatBlocks.find(b => b.id === afterBlockId)
        if (targetBlock) {
          editor.insertBlocks([blockPayload], targetBlock, 'after')
        } else {
          // 찾지 못하면 맨 끝에 삽입
          editor.insertBlocks([blockPayload], doc[doc.length - 1], 'after')
        }
      }

      updateInsertSuggestionStatus(msgId, 'accepted', blockPayload.id, undefined, suggestionIndex)
    } catch (err) {
      console.error('AI 삽입 제안 에디터 반영 실패:', err)
    }
  }, [editor, updateInsertSuggestionStatus])

  useEffect(() => {
    let activeEditor: BlockNoteEditor
    
    // 이전 에디터가 있다면 클린업 호출 필요 (BlockNote 인스턴스 파괴)
    if (editor) {
      try {
        // BlockNote는 별도의 destroy 메소드가 없거나 내부적 자원을 사용하므로 
        // 레퍼런스를 정리하고 새로 할당합니다.
      } catch (e) {}
    }

    const uploadFileHandler = async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('파일 읽기 실패'))
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    }

    if (ydoc && provider && isActive) {
      activeEditor = BlockNoteEditor.create({
        schema,
        collaboration: {
          provider,
          fragment: ydoc.getXmlFragment('document-store'),
          user: { name: username, color: userColor },
        },
        uploadFile: uploadFileHandler,
      })
    } else {
      activeEditor = BlockNoteEditor.create({
        schema,
        uploadFile: uploadFileHandler,
      })
    }

    setEditor(activeEditor)

    // 최초 로드 시에만 기본 웰컴 문서 주입
    if (isInitialLoad.current && (!isActive || !provider)) {
      isInitialLoad.current = false
      const welcomeMD = `# 🚀 AMEVA Workstation

차세대 AI 기반 통합 협업 워크스테이션에 오신 것을 환영합니다!

## ✨ 주요 기능

1. **AI 어시스턴트**: 우측 상단 ✨ 버튼으로 로컬 LLM AI 패널을 열어보세요.
2. **실시간 협업**: 사이드바 협업 탭에서 서버를 시작하고 동료와 함께 편집하세요.
3. **실시간 채팅**: 협업 연결 후 채팅 탭에서 실시간 메시지를 주고받을 수 있습니다.
4. **코드 실행**: 코드 블록에서 JavaScript, Python, SQL, HTML을 직접 실행할 수 있습니다.
5. **포맷 변환**: PDF, Word, Excel, PPT, 한글 HWPX 등으로 내보낼 수 있습니다.

---

### 🗄️ 가상 SQLite WASM 데이터베이스 예시
일렉트론 메모리상에 상주하는 가상 SQLite DB입니다. SELECT 실행 시 예쁜 반응형 그리드 테이블로 즉시 표출됩니다!

\`\`\`sql
-- 임시 테이블 생성 및 가상 데이터 삽입
CREATE TABLE IF NOT EXISTS developers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  role TEXT,
  level TEXT
);

INSERT INTO developers (name, role, level) VALUES 
('Antigravity', 'AI Assistant', 'Legendary'),
('User', 'Fullstack Developer', 'Senior'),
('Explorer', 'WASM Specialist', 'Junior');

-- 데이터 쿼리 조회 (결과가 표로 렌더링됩니다!)
SELECT * FROM developers;
\`\`\`

### 🎨 Live HTML 샌드박스 렌더러 예시
HTML/CSS/JS로 만든 화려한 웹 컴포넌트 프리뷰를 격리된 샌드박스 안에서 즉시 실시간 렌더링하여 확인합니다.

\`\`\`html
<div style="
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px;
  border-radius: 12px;
  color: white;
  text-align: center;
  font-family: sans-serif;
  box-shadow: 0 10px 20px rgba(0,0,0,0.3);
">
  <h2 style="margin:0 0 10px 0;">🎉 AMEVA Live Sandbox</h2>
  <p style="opacity:0.9; margin: 0 0 20px 0;">격리된 iframe 위에서 HTML/CSS가 실시간 작동합니다!</p>
  <button onclick="alert('반갑습니다! 실시간 샌드박스 버튼입니다.')" style="
    background: white;
    color: #764ba2;
    border: none;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  ">클릭해 보세요</button>
</div>
\`\`\`

### 💻 JavaScript 실행 예시

\`\`\`javascript
// JavaScript 실행 테스트
const nums = [1, 2, 3, 4, 5]
const sum = nums.reduce((a, b) => a + b, 0)
console.log('합계:', sum)
console.log('평균:', sum / nums.length)
\`\`\`

### 📊 Mermaid 다이어그램

\`\`\`mermaid
graph TD
    A[사용자] --> B[AMEVA Workstation]
    B --> C[AI 어시스턴트]
    B --> D[실시간 협업]
    B --> E[문서 변환]
    C --> F[로컬 LLM]
    D --> G[Y.js CRDT]
\`\`\`
`
      setCurrentContent(welcomeMD)
      if (window.electronAPI?.appReady) {
        window.electronAPI.appReady()
      }
    } else {
      // 웰컴 문서 로드하지 않는 기동 분기 (새 창, 협업 연결 창 등)
      if (window.electronAPI?.appReady) {
        window.electronAPI.appReady()
      }
    }
  }, [ydoc, provider, isActive])

  // ── 테마 적용 ───────────────────────────────────────────────
  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // ── 에디터 변경 → 마크다운 동기화 (300ms 디바운스로 인풋 랙 해결) ────────────────
  const activeBlockIdRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!editor) return
    let isUpdating = false

    const handleEditorChange = async () => {
      // 1. 블록 갱신 및 헤더 자동 변환 등 사용자 입력 돔과 커서 상태를 해치는 코드는 딜레이 없이 동기식 즉시 수행
      if (isUpdating) return

      const cursor = editor.selection
      let currentId: string | null = null

      if (cursor?.anchorBlock) {
        const activeBlock = cursor.anchorBlock
        currentId = activeBlock.id

        if (activeBlock.type === 'paragraph') {
          const text = activeBlock.content ? (activeBlock.content as any).map((c: any) => c.text).join('') : ''
          const match = text.match(/^(#{1,3})([^\s#].*)$/)
          if (match) {
            const level = match[1].length
            isUpdating = true
            try {
              editor.updateBlock(activeBlock.id, {
                type: 'heading',
                props: { level: level as any },
                content: [{ type: 'text', text: match[2], styles: {} }]
              })
            } catch {}
            isUpdating = false
          }
        }
      }

      if (currentId !== activeBlockIdRef.current) {
        const prevId = activeBlockIdRef.current
        activeBlockIdRef.current = currentId
        setActiveBlockId(currentId)

        if (prevId) {
          try {
            const prevBlock = editor.getBlock(prevId)
            if (prevBlock?.type === 'heading') {
              const text = prevBlock.content ? (prevBlock.content as any).map((c: any) => c.text).join('') : ''
              const match = text.match(/^(#{1,3}\s)(.*)$/)
              if (match) {
                isUpdating = true
                editor.updateBlock(prevId, { content: [{ type: 'text', text: match[2], styles: {} }] })
                isUpdating = false
              }
            }
          } catch {}
        }

        if (currentId) {
          try {
            const currentBlock = editor.getBlock(currentId)
            if (currentBlock?.type === 'heading') {
              const level = currentBlock.props?.level || 1
              const text = currentBlock.content ? (currentBlock.content as any).map((c: any) => c.text).join('') : ''
              const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### '
              if (!text.startsWith(prefix)) {
                isUpdating = true
                editor.updateBlock(currentId, { content: [{ type: 'text', text: prefix + text, styles: {} }] })
                isUpdating = false
              }
            }
          } catch {}
        }
      }

      // 2. 무거운 blocksToMarkdownLossy 파싱 및 React 전체 렌더링 상태 갱신만 300ms 디바운스로 진행
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)

      syncTimeoutRef.current = setTimeout(async () => {
        if (isUpdating) return
        isUpdating = true

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
                editor.updateBlock(activeId, { content: [{ type: 'text', text: match[2], styles: {} }] })
                activeHeadingCleared = true
              }
            }
          } catch {}
        }

        try {
          const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
          if (markdown.trim() !== currentContentRef.current.trim()) setCurrentContent(markdown)
        } catch (err) {
          console.error('Markdown sync failed:', err)
        } finally {
          if (activeHeadingCleared && activeId) {
            try { editor.updateBlock(activeId, { content: [{ type: 'text', text: activeHeadingText, styles: {} }] }) } catch {}
          }
          isUpdating = false
        }
      }, 300)
    }

    editor.onChange(handleEditorChange)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [editor, currentContent])

  // ── OS argv 파일 열기 ──────────────────────────────────────
  useEffect(() => {
    if (window.electronAPI && editor) {
      const unsub = window.electronAPI.onFileOpenArgv(async (_event, file) => {
        if (fileOpenMode === 'append') {
          await appendMarkdownIntoEditor(editor, file.content, file.filePath.split(/[\\/]/).pop() || '파일')
        } else if (fileOpenMode === 'tab') {
          await openFileInTab(editor, file.content, file.filePath)
        } else {
          setFilePath(file.filePath)
          await loadMarkdownIntoEditor(editor, file.content)
        }
      })
      return () => unsub()
    }
  }, [editor, fileOpenMode])

  // ── 자동 스냅샷 (3분) ──────────────────────────────────────
  useEffect(() => {
    if (!settings.autoSnapshot || !currentContent) return
    const id = setInterval(() => createSnapshot(`자동 백업`, currentContent), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [settings.autoSnapshot, currentContent, createSnapshot])

  // ── 단축키 ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const hotkeys = settings.hotkeys || {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }

      if (matchHotkey(e, hotkeys.zoomIn)) {
        e.preventDefault()
        handleZoomIn()
      } else if (matchHotkey(e, hotkeys.zoomOut)) {
        e.preventDefault()
        handleZoomOut()
      } else if (matchHotkey(e, hotkeys.zoomReset)) {
        e.preventDefault()
        handleZoomReset()
      } else if (matchHotkey(e, hotkeys.save)) {
        e.preventDefault()
        if (e.altKey || e.shiftKey) {
          handleSaveAsFile()
        } else {
          handleSaveFile()
        }
      } else if (matchHotkey(e, hotkeys.newFile)) {
        e.preventDefault()
        if (fileOpenMode === 'tab') {
          handleNewTab()
        } else if (fileOpenMode === 'append') {
          if (editor) {
            const doc = editor.document
            if (doc.length > 0) {
              const newBlockId = Math.random().toString(36).substring(2, 10)
              const newBlockPayload = {
                id: newBlockId,
                type: 'paragraph' as const,
                content: []
              }
              editor.insertBlocks([newBlockPayload], doc[doc.length - 1], 'after')
              
              setTimeout(() => {
                try {
                  editor.setTextCursorPosition(newBlockId, 'start')
                  handleScrollToBlock(newBlockId)
                } catch (err) {}
              }, 50)
            }
          }
        } else {
          // fileOpenMode === 'replace'
          const isDirty = currentContent !== originalContent
          if (isDirty) {
            const saveAndOpenNew = window.confirm('현재 수정 중인 문서가 있습니다. 기존 문서를 저장하고 새 창을 여시겠습니까?\n\n(취소를 누르면 현재 문서가 새 빈 문서로 대체됩니다.)')
            if (saveAndOpenNew) {
              await handleSaveFile()
              if (window.electronAPI?.newWindow) {
                window.electronAPI.newWindow()
              }
            } else {
              handleStartNewDocument()
            }
          } else {
            if (window.electronAPI?.newWindow) {
              window.electronAPI.newWindow()
            } else {
              handleStartNewDocument()
            }
          }
        }
      } else if (matchHotkey(e, hotkeys.open)) {
        e.preventDefault()
        handleOpenFile()
      } else if (matchHotkey(e, hotkeys.pdfExport)) {
        e.preventDefault()
        handleExport('pdf')
      } else if (matchHotkey(e, hotkeys.toggleAI)) {
        e.preventDefault()
        setShowAIPanel(p => !p)
      } else if (matchHotkey(e, hotkeys.toggleMode)) {
        e.preventDefault()
        handleSwitchMode(editorMode === 'edit' ? 'preview' : 'edit')
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setFindReplaceMode('find')
        setShowFindReplace(prev => !prev)
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setFindReplaceMode('replace')
        setShowFindReplace(prev => !prev)
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'd' || e.key === 'D') {
          if (editor) {
            e.preventDefault()
            const pos = editor.getTextCursorPosition()
            if (pos?.block?.id) {
              editor.removeBlocks([pos.block.id])
            }
          }
        }
        else if (e.key === '1') {
          if (editor) {
            e.preventDefault()
            const pos = editor.getTextCursorPosition()
            if (pos?.block?.id) {
              editor.updateBlock(pos.block.id, { type: 'heading', props: { level: 1 } })
            }
          }
        }
        else if (e.key === '2') {
          if (editor) {
            e.preventDefault()
            const pos = editor.getTextCursorPosition()
            if (pos?.block?.id) {
              editor.updateBlock(pos.block.id, { type: 'heading', props: { level: 2 } })
            }
          }
        }
        else if (e.key === '3') {
          if (editor) {
            e.preventDefault()
            const pos = editor.getTextCursorPosition()
            if (pos?.block?.id) {
              editor.updateBlock(pos.block.id, { type: 'heading', props: { level: 3 } })
            }
          }
        }
        else if (e.key === '/') {
          if (editor) {
            e.preventDefault()
            const pos = editor.getTextCursorPosition()
            if (pos?.block) {
              editor.insertInlineContent([{ type: 'text', text: '/', styles: {} }])
            }
          }
        }
      }
    }

    // Ctrl+Wheel: 발생 위치에 따라 다르게 동작
    //   ① 에디터 영역 내부  → CSS zoom (editorZoom state) — 에디터 콘텐츠만 확대
    //   ② 사이드바/기타 영역 → webFrame.setZoomFactor() (Electron) 또는 브라우저 기본 줌 (Web 브라우저)
    const handleWheelZoom = (e: WheelEvent) => {
      if (!e.ctrlKey) return

      const editorWrapper = document.querySelector('.editor-zoom-wrapper')
      const isInsideEditor = editorWrapper?.contains(e.target as Node) ?? false

      console.log('[Zoom Debug] target:', e.target, 'isInsideEditor:', isInsideEditor, 'electronAPI:', !!window.electronAPI)

      if (isInsideEditor) {
        // ① 에디터 CSS zoom: 브라우저 기본 줌을 막고 React 상태로 줌 적용
        e.preventDefault()
        const delta = e.deltaY < 0 ? 0.1 : -0.1
        setEditorZoom(prev => Math.min(2.5, Math.max(0.4, Math.round((prev + delta) * 10) / 10)))
      } else {
        // ② 사이드바/기타 영역
        if (window.electronAPI?.setZoomFactor) {
          // Electron 환경: 기본 줌 막고 Electron webContents.setZoomFactor 실행
          e.preventDefault()
          const step = e.deltaY < 0 ? 0.1 : -0.1
          setBrowserZoom(prev => {
            const next = Math.min(3.0, Math.max(0.3, Math.round((prev + step) * 10) / 10))
            console.log('[Zoom Debug] setting browser zoom factor to:', next)
            window.electronAPI!.setZoomFactor!(next)
            return next
          })
        } else {
          // 일반 웹 브라우저 환경: e.preventDefault()를 호출하지 않고 그대로 흘려보내 브라우저 기본 줌이 동작하도록 함
          console.log('[Zoom Debug] Web browser environment: letting browser zoom handle the event')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheelZoom, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheelZoom)
    }
  }, [editor, filePath, currentContent, editorMode, editorZoom, browserZoom])


  // ── 창 제어 ────────────────────────────────────────────────
  const ZOOM_STEP = 0.1
  const ZOOM_MIN  = 0.4
  const ZOOM_MAX  = 2.5
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10))

  const handleZoomIn    = () => setEditorZoom(prev => clampZoom(prev + ZOOM_STEP))
  const handleZoomOut   = () => setEditorZoom(prev => clampZoom(prev - ZOOM_STEP))
  const handleZoomReset = () => {
    // 에디터 CSS zoom 리셋
    setEditorZoom(1.0)
    // 브라우저(사이드바) zoom도 함께 리셋
    if (window.electronAPI?.setZoomFactor) {
      window.electronAPI.setZoomFactor(1.0)
      setBrowserZoom(1.0)
    }
  }
  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  // ── 파일 로드 헬퍼 ─────────────────────────────────────────
  // 파일 열기·argv 수신 양쪽에서 공통으로 사용
  // 핵심:
  //  1. normalizeMarkdown → tryParseMarkdownToBlocks → cleanCodeBlocks
  //  2. replaceBlocks 로 한 번에 교체 (removeBlocks 후 document[0]이 undefined가 되는 문제 회피)
  //  3. 삽입 완료 후 blocksToMarkdownLossy 로 역변환 → currentContent 설정
  //     (__LT_TEMP__ 등 임시 토큰이 preview에 노출되는 문제 차단)
  const loadMarkdownIntoEditor = async (targetEditor: BlockNoteEditor, rawContent: string, isBinary = false, path = '') => {
    const markdown = await parseFileToMarkdown(rawContent, path || filePath || '', isBinary)
    const normalized = normalizeMarkdown(markdown)

    // [PERF] 대용량 문서 점진적(Progressive) 렌더링 알고리즘
    const lines = normalized.split('\n')
    if (lines.length > 200 && !isBinary) {
      const firstChunk = lines.slice(0, 120).join('\n')
      const remainingChunk = lines.slice(120).join('\n')

      const firstBlocks = await targetEditor.tryParseMarkdownToBlocks(firstChunk)
      cleanCodeBlocks(firstBlocks)
      ensureBlockIds(firstBlocks)
      targetEditor.replaceBlocks(targetEditor.document, firstBlocks)
      setCurrentContent(normalized)
      setOriginalContent(normalized)

      setTimeout(async () => {
        try {
          const remainingBlocks = await targetEditor.tryParseMarkdownToBlocks(remainingChunk)
          cleanCodeBlocks(remainingBlocks)
          ensureBlockIds(remainingBlocks)
          const doc = targetEditor.document
          if (doc.length > 0) {
            targetEditor.insertBlocks(remainingBlocks, doc[doc.length - 1], 'after')
          }
        } catch (e) {
          console.warn('남은 청크 비동기 로딩 오류:', e)
        }
      }, 25)
    } else {
      // 일반 소형 파일
      const blocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      targetEditor.replaceBlocks(targetEditor.document, blocks)
      try {
        const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
        setCurrentContent(derived)
        setOriginalContent(derived)
      } catch {
        setCurrentContent(markdown)
        setOriginalContent(markdown)
      }
    }
  }

  // 아래로 계속 이어서 열기 (Append Mode)
  const appendMarkdownIntoEditor = async (targetEditor: BlockNoteEditor, rawContent: string, fileName: string, isBinary = false, path = '') => {
    const markdown = await parseFileToMarkdown(rawContent, path, isBinary)
    const normalized = normalizeMarkdown(markdown)
    const newBlocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(newBlocks)
    ensureBlockIds(newBlocks)
    
    const headerBlockId = 'file-header-' + Math.random().toString(36).substr(2, 9)
    const headerBlock = {
      id: headerBlockId,
      type: 'heading' as const,
      props: { level: 2 },
      content: [{ type: 'text' as const, text: `파일: ${fileName}`, styles: {} }],
      children: []
    }
    
    const currentBlocks = [...targetEditor.document]
    const updatedBlocks = [...currentBlocks, headerBlock, ...newBlocks]
    
    targetEditor.replaceBlocks(targetEditor.document, updatedBlocks)
    
    const fileId = 'appended-' + Math.random().toString(36).substr(2, 9)
    setAppendedFiles(prev => {
      if (prev.length === 0) {
        return [
          {
            id: 'base-file',
            filePath: filePath ? filePath.split(/[\\/]/).pop() || '무제 문서.md' : '무제 문서.md',
            startBlockId: targetEditor.document[0]?.id || ''
          },
          { id: fileId, filePath: fileName, startBlockId: headerBlockId }
        ]
      }
      return [...prev, { id: fileId, filePath: fileName, startBlockId: headerBlockId }]
    })
    
    setTimeout(() => {
      const el = document.querySelector(`[data-id="${headerBlockId}"], [data-block-id="${headerBlockId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const outer = el?.closest('.bn-block-outer') || el
      if (outer) {
        outer.setAttribute('data-highlighted-temp', 'true')
        setTimeout(() => {
          outer.removeAttribute('data-highlighted-temp')
        }, 1800)
      }
    }, 150)
    
    try {
      const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
      setCurrentContent(derived)
    } catch {
      setCurrentContent(markdown)
    }
  }

  // 탭으로 새로 열기 (Tab Mode)
  const openFileInTab = async (targetEditor: BlockNoteEditor, fileContent: string, path: string, isBinary = false) => {
    const currentBlocks = [...targetEditor.document]
    const currentActiveId = activeTabId
    
    const markdown = await parseFileToMarkdown(fileContent, path, isBinary)
    const normalized = normalizeMarkdown(markdown)
    const newBlocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(newBlocks)
    ensureBlockIds(newBlocks)
    
    const newTabId = 'tab-' + Math.random().toString(36).substr(2, 9)
    const newTab = {
      id: newTabId,
      filePath: path,
      content: markdown,
      blocks: newBlocks,
      originalContent: markdown,
      lastSavedTime: new Date()
    }
    
    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === currentActiveId) {
          return { ...t, filePath: filePath, content: currentContent, blocks: currentBlocks, originalContent: originalContent, lastSavedTime: lastSavedTime }
        }
        return t
      })
      return [...updated, newTab]
    })
    
    setActiveTabId(newTabId)
    setFilePath(path)
    setCurrentContent(markdown)
    setOriginalContent(markdown)
    setLastSavedTime(new Date())
    
    targetEditor.replaceBlocks(targetEditor.document, newBlocks)
  }

  // 탭 직접 선택 전환
  const handleSelectTab = useCallback(async (tabId: string) => {
    if (!editor) return
    const currentBlocks = [...editor.document]
    const activeId = activeTabId
    
    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === activeId) {
          return { ...t, filePath: filePath, content: currentContent, blocks: currentBlocks, originalContent: originalContent, lastSavedTime: lastSavedTime }
        }
        return t
      })
      
      const targetTab = updated.find(t => t.id === tabId)
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
      
      return updated
    })
    
    setActiveTabId(tabId)
  }, [editor, activeTabId, filePath, currentContent, originalContent, lastSavedTime])

  // 탭 닫기
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId)
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
        return [defaultTab]
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
      return remaining
    })
  }, [editor, activeTabId])

  // 열기 모드 변경 핸들러
  const handleSwitchOpenMode = (mode: 'replace' | 'append' | 'tab') => {
    setFileOpenMode(mode)
    if (mode === 'replace') {
      setAppendedFiles([])
      setTabs([{ id: 'default', filePath: filePath, content: currentContent, blocks: [] }])
      setActiveTabId('default')
    } else if (mode === 'append') {
      setAppendedFiles([
        {
          id: 'base-file',
          filePath: filePath ? filePath.split(/[\\/]/).pop() || '무제 문서.md' : '무제 문서.md',
          startBlockId: editor?.document[0]?.id || ''
        }
      ])
    } else if (mode === 'tab') {
      setTabs([{ id: 'default', filePath: filePath, content: currentContent, blocks: [] }])
      setActiveTabId('default')
    }
  }

  // 이어서 열린 특정 파일 위치로 이동
  const handleSelectAppendedFile = useCallback((startBlockId: string) => {
    const el = document.querySelector(`[data-id="${startBlockId}"], [data-block-id="${startBlockId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const outer = el.closest('.bn-block-outer') || el
      outer.setAttribute('data-highlighted-temp', 'true')
      setTimeout(() => {
        outer.removeAttribute('data-highlighted-temp')
      }, 1800)
    }
  }, [])

  // ── 파일 관리 ──────────────────────────────────────────────
  const handleOpenFile = async () => {
    if (!editor) return
    if (window.electronAPI) {
      const file = await window.electronAPI.openFile()
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
      // 브라우저 환경 (Electron 없음)
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
  }

  const handleSaveFile = async () => {
    if (!editor) return
    const path = filePath || 'document.md'
    const ext = path.split('.').pop()?.toLowerCase() || 'md'
    
    const rawBlocks = convertJupyterToCodeBlocks(editor.document)
    const markdown = await editor.blocksToMarkdownLossy(rawBlocks)
    const hasMedia = markdown.includes('data:video/') || markdown.includes('data:audio/')
    
    if (hasMedia && ['md', 'markdown', 'txt'].includes(ext)) {
      if (window.electronAPI?.showMessageBox) {
        const boxRes = await window.electronAPI.showMessageBox({
          type: 'question',
          buttons: ['예 (권장)', '아니오'],
          defaultId: 0,
          title: '아메바 문서 포맷 변환 권장',
          message: '문서에 대용량 미디어 파일(동영상/오디오)이 감지되었습니다.\n미디어 공유가 완벽하게 지원되고 용량이 절감되는 아메바 문서 포맷(.adc)으로 변환하여 저장하시겠습니까?\n\n(아니오를 선택하시면 일반 마크다운 형식으로 저장이 계속 진행됩니다.)',
        })
        
        if (boxRes.response === 0) {
          const savedPath = await window.electronAPI.saveFile('', undefined)
          if (savedPath) {
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
            await window.electronAPI.saveFile(contentToSave, savedPath)
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
    
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFile(contentToSave, filePath || undefined)
      if (savedPath) {
        setFilePath(savedPath)
        setOriginalContent(markdown)
        setLastSavedTime(new Date())
        createSnapshot(`저장본 (${new Date().toLocaleTimeString()})`, contentToSave)
      }
    } else {
      triggerBrowserDownload(contentToSave, filePath || 'document.' + ext)
      createSnapshot('웹 브라우저 저장본', contentToSave)
    }
  }

  const handleSaveAsFile = async () => {
    if (!editor) return
    const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
    
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFile(markdown, undefined)
      if (savedPath) {
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
        
        await window.electronAPI.saveFile(contentToSave, savedPath)
        setFilePath(savedPath)
        setOriginalContent(markdown)
        setLastSavedTime(new Date())
        createSnapshot('다른 이름으로 저장본', contentToSave)
      }
    } else {
      // [HIGH-003] 브라우저 환경: Markdown 다운로드 + 다른 형식 안내
      const wantOther = window.confirm(
        '브라우저에서는 파일 저장 대화상자가 지원되지 않습니다.\n' +
        'Markdown(.md) 파일로 다운로드하시겠습니까?\n' +
        '(Excel, PDF 등 다른 형식은 상단 [내보내기] 메뉴를 사용하세요)'
      )
      if (wantOther) {
        triggerBrowserDownload(markdown, 'document_new.md')
      }
    }
  }

  // ── 내보내기 ───────────────────────────────────────────────
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!editor) return

    // 진행 모달 열기
    const setP = (percent: number, message: string) =>
      setExportProgress(prev => ({ ...prev, percent, message }))

    setExportMinimized(false)
    setExportProgress({ phase: 'running', format, percent: 0, message: '문서 분석 중...' })

    try {
      // ── 단계 1: 문서 변환 준비 (0~20%)
      await new Promise(r => setTimeout(r, 80))
      const rawBlocks = convertJupyterToCodeBlocks(editor.document)
      setP(15, '블록 데이터 수집 중...')

      // 핀심: BlockNote block 구조를 export가 지원하는 NormalizedBlock로 변환
      // 이 단계에서 map is not a function 를 방지한다
      const blocks = normalizeBlocks(rawBlocks)
      console.log(`[Export] normalizeBlocks: ${blocks.length}개 블록 변환 완료`, blocks)
      setP(25, '콘텐츠 변환 중...')

      let savedPath: string | null = null

      if (window.electronAPI) {
        // ── Electron 환경 ─────────────────────────────────────
        switch (format) {

          case 'md': {
            setP(40, 'Markdown 생성 중...')
            const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              markdown, false, 'document.md',
              [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
            )
            break
          }

          case 'html': {
            setP(40, 'HTML 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'html', defaultName: 'document.html' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'pdf': {
            setP(30, 'HTML 렌더링 중...')
            const html = blocksToHTML(blocks)
            setP(50, 'PDF 렌더링 (Chromium)...')
            savedPath = await window.electronAPI.printToPDF(html)
            break
          }

          case 'docx': {
            setP(40, 'Word 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'docx', defaultName: 'document.docx' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'xlsx': {
            setP(40, 'Excel 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'xlsx', defaultName: 'tables.xlsx' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'pptx': {
            setP(40, 'PowerPoint 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'pptx', defaultName: 'presentation.pptx' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'hwpx': {
            setP(40, '한글 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'hwpx', defaultName: 'document.hwpx' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'xml': {
            setP(40, 'XML 변환 중...')
            const res = await window.electronAPI.exportConvert({ blocks, format: 'xml', defaultName: 'document.xml' })
            savedPath = res.success ? res.savedPath : undefined
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          default:
            throw new Error(`지원하지 않는 형식입니다: ${format}`)
        }

      } else {
        // ── 브라우저 환경 (Electron 없음) ─────────────────────
        switch (format) {
          case 'md': {
            const md = await editor.blocksToMarkdownLossy(editor.document)
            triggerBrowserDownload(md, 'document.md')
            savedPath = 'document.md (브라우저 다운로드)'
            break
          }
          case 'html': {
            const html = blocksToHTML(blocks)
            triggerBrowserDownload(html, 'document.html')
            savedPath = 'document.html (브라우저 다운로드)'
            break
          }
          case 'pdf': {
            const html = blocksToHTML(blocks)
            const iframe = document.createElement('iframe')
            Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
            document.body.appendChild(iframe)
            const doc = iframe.contentWindow?.document || iframe.contentDocument
            if (doc) {
              doc.write(html); doc.close()
              await new Promise(r => setTimeout(r, 500))
              iframe.contentWindow?.focus(); iframe.contentWindow?.print()
              document.body.removeChild(iframe)
            }
            savedPath = 'PDF 인쇄 대화상자'
            break
          }
          case 'docx': triggerBrowserDownload(await exportToWord(blocks), 'document.docx'); savedPath = 'document.docx'; break
          case 'xlsx': triggerBrowserDownload(new Blob([(await exportToExcel(blocks)).buffer]), 'tables.xlsx'); savedPath = 'tables.xlsx'; break
          case 'pptx': triggerBrowserDownload(new Blob([await exportToPPTX(blocks)]), 'presentation.pptx'); savedPath = 'presentation.pptx'; break
          case 'hwpx': triggerBrowserDownload(await exportToHWPX(blocks), 'document.hwpx'); savedPath = 'document.hwpx'; break
          case 'xml': triggerBrowserDownload(exportToXML(blocks), 'document.xml'); savedPath = 'document.xml'; break
          default: throw new Error(`지원하지 않는 형식입니다: ${format}`)
        }
      }

      // 사용자가 저장 다이얼로그에서 취소한 경우
      if (!savedPath) {
        setExportProgress(IDLE_PROGRESS)
        return
      }

      // ── 완료 처리 (90~100%)
      setP(90, '파일 저장 완료 중...')
      await new Promise(r => setTimeout(r, 120))
      setP(100, '완료!')

      setExportProgress(prev => ({
        ...prev,
        phase: 'success',
        percent: 100,
        message: '저장 완료',
        savedPath,
      }))

      // ✅ 성공 시에만 confetti
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981'],
      })

      // 2초 후 최소화 상태로 전환 (성공 메시지 유지)
      setTimeout(() => {
        setExportMinimized(true)
        // 추가 2초 후 완전히 닫기
        setTimeout(() => setExportProgress(IDLE_PROGRESS), 2000)
      }, 2000)

    } catch (err: any) {
      setExportProgress(prev => ({
        ...prev,
        phase: 'error',
        percent: prev.percent,
        message: '변환 실패',
        error: err?.message ?? String(err),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // ── 스냅샷 diff ────────────────────────────────────────────
  const [selectedSnapshot, setSelectedSnapshot] = useState<DocumentSnapshot | null>(null)
  const [isDiffOpen, setIsDiffOpen] = useState(false)

  const handleSelectSnapshotForDiff = (snapshot: DocumentSnapshot) => {
    setSelectedSnapshot(snapshot)
    setIsDiffOpen(true)
  }

  const handleRollback = async (rollbackContent: string) => {
    if (!editor) return
    await loadMarkdownIntoEditor(editor, rollbackContent)
  }

  // Preview 전환 시 에디터 상태를 먼저 flush → currentContent 최신화 보장
  // mermaid 블록은 blocksToMarkdownLossy가 fence를 잃을 수 있으므로 직접 재구성
  const handleSwitchMode = async (mode: EditorMode) => {
    // 1. 'edit' 모드를 나갈 때: 에디터 블록들을 마크다운 텍스트로 변환하여 currentContent 갱신
    if (editorMode === 'edit' && (mode === 'preview' || mode === 'raw') && editor) {
      try {
        // 1차: BlockNote의 표준 변환 시도
        let latest = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))

        // 2차: mermaid 블록을 직접 스캔하여 누락된 fence 보완
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

    // 2. 'edit' 모드로 돌아올 때: raw 마크다운(currentContentRef)을 파싱하여 에디터 블록으로 로드
    if (mode === 'edit' && editor) {
      try {
        const normalized = normalizeMarkdown(currentContentRef.current)
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
      const normalized = normalizeMarkdown(currentContent || welcomeMD)
      const blocks = await editor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      editor.replaceBlocks(editor.document, blocks)
      setCurrentContent(currentContent || welcomeMD)
      setOriginalContent(currentContent || welcomeMD)
      setEditorMode('edit')
    } catch (err) {
      console.error('웰컴 편집 로드 실패:', err)
      setEditorMode('edit')
    }
  }

  const handleStartNewDocument = () => {
    if (editor) {
      editor.replaceBlocks(editor.document, [
        {
          id: Math.random().toString(36).substring(2, 10),
          type: 'paragraph',
          content: []
        }
      ])
    }
    setCurrentContent('')
    setFilePath(null)
    setOriginalContent('')
    setEditorMode('edit')
  }


  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem('app-settings', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const handleOpenGithub = () => {
    if (window.electronAPI?.openExternalLink) {
      window.electronAPI.openExternalLink('https://github.com/uno-km/AMEVA-Model-Nexus')
    } else {
      // [MEDIUM-006] 브라우저 fallback: 새 탭으로 열기
      window.open('https://github.com/uno-km/AMEVA-Model-Nexus', '_blank', 'noopener,noreferrer')
    }
  }

  const handleCloseApp = () => {
    if (window.electronAPI?.closeApp) {
      window.electronAPI.closeApp()
    }
    // 브라우저에서는 창 닫기 불가 — 조용히 무시
  }

  // ── 렌더 ───────────────────────────────────────────────────
  return (
    <div
      data-theme={settings.theme}
      style={{
        display: 'flex', flexDirection: 'column',
        width: '100vw', height: '100vh',
        backgroundColor: 'var(--bg-deep)', overflow: 'hidden',
      }}
    >
      {/* 타이틀바 드래그 스페이서 */}
      <div className="titlebar-spacer" />

      {/* 메뉴바 */}
      <MenuBar
        onOpenFile={handleOpenFile}
        onSaveFile={handleSaveFile}
        onSaveAs={handleSaveAsFile}
        onPrint={() => handleExport('pdf')}
        onCloseApp={handleCloseApp}
        onNewWindow={() => window.electronAPI?.newWindow()}
        editorMode={editorMode}
        setEditorMode={handleSwitchMode}
        showStatusBar={showStatusBar}
        setShowStatusBar={setShowStatusBar}
        showConsole={settings.showCodeConsole}
        setShowConsole={(val) => handleUpdateSettings({ showCodeConsole: val })}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenGithub={handleOpenGithub}
        onOpenMarketplace={() => setShowMarketplaceModal(true)}
        onOpenPricing={() => setShowPricingModal(true)}
        hotkeys={settings.hotkeys}
        isProPlan={isProPlan} // [BM-FREE-MODE] 유료 상태 전달
      />

      {/* 메인 레이아웃: 사이드바 + 에디터 + AI패널 */}
      <div className="main-layout-row">

        {/* 사이드바 토글 버튼 (닫혀있을 때만 플로팅) */}
        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            style={{
              position: 'absolute',
              left: '10px',
              top: '12px', width: '28px', height: '28px',
              borderRadius: '6px', background: 'var(--bg-glass)',
              border: '1px solid var(--border-glow)', color: 'var(--text-main)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 102,
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}
            title="사이드바 열기"
          >
            <PanelLeft size={16} />
          </button>
        )}

        {/* 사이드바 */}
        {showSidebar && (
          <div
            style={{
              width: sidebarWidth,
              flexShrink: 0,
              flexGrow: 0,
              height: '100%',
              position: 'relative',
            }}
          >
            {isSidebarReady ? (
              <Sidebar
                filePath={filePath}
                editorMode={editorMode}
                setEditorMode={handleSwitchMode}
                onOpenFile={handleOpenFile}
                onSaveFile={handleSaveFile}
                onExport={handleExport}
                snapshots={snapshots}
                onCreateSnapshot={(title) => createSnapshot(title, currentContent)}
                onDeleteSnapshot={deleteSnapshot}
                onSelectSnapshotForDiff={handleSelectSnapshotForDiff}
                peers={peers}
                serverRunning={isActive}
                serverPort={serverPort}
                setServerPort={setServerPort}
                serverHost={serverHost}
                setServerHost={setServerHost}
                useLocalServer={useLocalServer}
                setUseLocalServer={setUseLocalServer}
                onToggleServer={() => toggleLocalServer(serverPort)}
                collaborationLink={collaborationLink}
                isConnected={isConnected}
                fileOpenMode={fileOpenMode}
                setFileOpenMode={handleSwitchOpenMode}
                appendedFiles={appendedFiles}
                onSelectAppendedFile={handleSelectAppendedFile}
                tabs={tabs}
                activeTabId={activeTabId}
                onSelectTab={handleSelectTab}
                onCloseTab={handleCloseTab}
                onToggleSidebar={() => setShowSidebar(p => !p)}
                chatMessages={chatMessages}
                onChatSend={sendChatMessage}
                onChatClear={clearChatMessages}
                username={username}
                userColor={userColor}
                isChatFloating={isChatFloating}
                onToggleChatFloat={() => {
                  setIsChatFloating(!isChatFloating)
                  if (!isChatFloating) setHasChatUnread(false)
                }}
                hotkeys={settings.hotkeys}
              />
            ) : (
              <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#0a0a0f', height: '100%', borderRight: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}>
                <div style={{ height: '24px', background: 'rgba(139,92,246,0.08)', borderRadius: '6px', width: '70%', opacity: 0.5 }} />
                <div style={{ height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', opacity: 0.5 }} />
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.01)', borderRadius: '8px', opacity: 0.3 }} />
              </div>
            )}
            {/* 사이드바 우측 경계 리사이즈 핸들 */}
            <ResizeHandle
              onMouseDown={handleSidebarResizeStart}
              isDragging={isSidebarDragging}
              placement="right"
            />
          </div>
        )}

        {/* 에디터 영역만 CSS zoom 적용 — 사이드바/AI패널 미적용 */}
        <div
          className="editor-zoom-wrapper"
          data-focus-region="editor"
          style={{
            zoom: editorZoom,
            height: `${100 / editorZoom}%`,
            position: 'relative',   /* outline 표시 영역 확보 */
          }}
        >
          <MarkdownEditor
            editor={editor}
            editorMode={editorMode}
            peers={settings.showPeersPointer ? peers : []}
            onMouseMove={handleMouseMove}
            onSelectionChange={settings.showPeersDrag ? updateDragSelection : () => {}}
            onBlockHighlight={serverRunning ? updateBlockHighlight : undefined}
            editorContainerRef={editorContainerRef}
            currentContent={currentContent}
            setCurrentContent={setCurrentContent}
            wordWrap={settings.wordWrap}
            showCodeRunner={settings.showCodeConsole}
            theme={settings.theme}
            onSelectedTextChange={setSelectedText}
            installedPlugins={settings.installedPlugins || []}
            onOpenFile={handleOpenFile}
            onStartWelcomeEdit={handleStartWelcomeEdit}
            onStartNewDocument={handleStartNewDocument}
            taggedBlocks={taggedBlocks}
            setTaggedBlocks={customSetTaggedBlocks}
            tabs={tabs}
            isProPlan={isProPlan}
          />
          {settings.showMinimap && (settings.installedPlugins || []).includes('minimap') && editor && (
            <Minimap
              editor={editor}
              editorContainerRef={editorContainerRef}
              blocks={editor.document}
            />
          )}
        </div>

        {/* AI 패널 (우측): zoom 무연 고정 */}
        <div
          className="ai-panel-wrapper"
          data-focus-region="ai-panel"
          style={{
            position: 'relative',
            width: showAIPanel ? aiPanelWidth : 0,
            transition: isAIPanelDragging ? 'none' : 'width 0.2s ease',
          }}
        >
          {/* AI 패널 좌측 경계 리사이즈 핸들 (패널이 열렸을 때만 표시) */}
          {showAIPanel && (
            <ResizeHandle
              onMouseDown={handleAIPanelResizeStart}
              isDragging={isAIPanelDragging}
              placement="left"
            />
          )}
          {isAIPanelReady ? (
            <AIPanel
              isOpen={showAIPanel}
              onClose={() => setShowAIPanel(false)}
              messages={aiMessages}
               isGenerating={isGenerating}
              isAvailable={isAvailable}
              models={models}
              settings={aiSettings}
              onSend={(msg, ctx, orig, bId, runtimeSettings) => {
                generateResponse(msg, ctx, orig, bId, runtimeSettings, editor, taggedBlocks)
                setTaggedBlocks([])
              }}
              onAbort={abortGeneration}
              onClear={clearAIHistory}
              onUpdateSettings={updateAISettings}
              currentContent={currentContent}
              panelWidth={aiPanelWidth}
              selectedText={selectedText}
              onClearSelectedText={() => setSelectedText('')}
              onApplySuggestion={handleApplySuggestion}
              onUpdateDiffState={updateMessageDiffState}
              onApplyInsertSuggestion={handleApplyInsertSuggestion}
              onUpdateInsertSuggestionStatus={updateInsertSuggestionStatus}
              activeBlockId={activeBlockId || undefined}
              editor={editor}
              blocks={editor ? editor.document : []}
              activeTab={activeRightTab}
              installedPlugins={settings.installedPlugins || []}
              engineLogs={engineLogs}
              showModelHub={showModelHub}
              setShowModelHub={setShowModelHub}
              taggedBlocks={taggedBlocks}
              setTaggedBlocks={setTaggedBlocks}
              refreshModels={refreshModels}
              importModel={importModel}
              downloadStatus={downloadStatus}
              setDownloadStatus={setDownloadStatus}
              onScrollToBlock={handleScrollToBlock}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>AI 엔진 및 도구 준비 중...</span>
            </div>
          )}
        </div>

        {/* 📋 극도로 미려한 코랩 스타일 우측 고정 탭 스트립 (bookmarks) */}
        <RightTabStrip
          activeTab={activeRightTab}
          isOpen={showAIPanel}
          onToggleTab={handleToggleRightTab}
          hasChatUnread={hasChatUnread}
          installedPlugins={settings.installedPlugins || []}
          hotkeys={settings.hotkeys}
          isProPlan={isProPlan}
        />
      </div>

      {/* 상태바 */}
      {showStatusBar && (
        <StatusBar
          filePath={filePath}
          currentContent={currentContent}
          zoomLevel={editorZoom}
          browserZoom={browserZoom}
          peers={peers}
          serverRunning={serverRunning}
          wordWrap={settings.wordWrap}
          onToggleWordWrap={() => handleUpdateSettings({ wordWrap: !settings.wordWrap })}
          onOpenSettings={() => setIsSettingsOpen(true)}
          downloadStatus={downloadStatus}
          isDirty={currentContent !== originalContent}
          lastSavedTime={lastSavedTime}
          aiSettings={aiSettings}
          aiAvailable={isAvailable}
          mcpServers={mcpServersState} // [FIX-MCP-UI] 실시간 MCP 서버 목록 전달
          isProPlan={isProPlan}
        />
      )}

      {/* YouTube Floating PiP Player */}
      {pipVideoId && (
        <div
          style={{
            position: 'fixed',
            left: pipPosition.x,
            top: pipPosition.y,
            width: '340px',
            height: '220px',
            background: '#18181c',
            border: '1.5px solid var(--primary)',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* 드래그 가능한 헤더 바 */}
          <div
            style={{
              height: '28px',
              background: '#0f0f11',
              borderBottom: '1px solid #2e2e38',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              cursor: 'move',
            }}
            onMouseDown={(e) => {
              setIsDraggingPip(true)
              setDragOffset({
                x: e.clientX - pipPosition.x,
                y: e.clientY - pipPosition.y
              })
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>📺 Floating YouTube PiP Player</span>
            <button
              onClick={() => setPipVideoId(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          </div>
          
          {/* 유튜브 Iframe 프레임 */}
          <div style={{ flex: 1, background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${pipVideoId}?autoplay=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; encrypted-media"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      )}

      {/* 모달들 */}
      <DiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        snapshot={selectedSnapshot}
        currentContent={currentContent}
        getLineDiff={getLineDiff}
        onRollback={handleRollback}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false)
          refreshMcpServers() // [FIX-MCP-UI] 닫힐 때 설정 명세 동기화 리로드
        }}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        username={username}
        userColor={userColor}
        onUpdateUser={(name, color) => {
          setUsername(name)
          setUserColor(color)
        }}
        onOpenModelHub={() => {
          setIsSettingsOpen(false)
          setShowModelHub(true)
        }}
      />
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenGithub={handleOpenGithub}
      />
      <MarkdownGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* 마켓플레이스 모달 */}
      <MarketplaceModal
        isOpen={showMarketplaceModal}
        onClose={() => setShowMarketplaceModal(false)}
        installedPlugins={settings.installedPlugins || []}
        onInstallPlugin={handleInstallPlugin}
        onUninstallPlugin={handleUninstallPlugin}
        isProPlan={isProPlan}
      />

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />

      {/* 내보내기 진행 모달 */}
      <ExportModal
        progress={exportProgress}
        minimized={exportMinimized}
        onMinimize={() => setExportMinimized(prev => !prev)}
        onClose={() => { setExportProgress(IDLE_PROGRESS); setExportMinimized(false) }}
        onOpenFile={(path) => {
          const fileUrl = path.startsWith('http') ? path : `file:///${path.replace(/\\/g, '/')}`
          if (window.electronAPI?.openExternalLink) {
            window.electronAPI.openExternalLink(fileUrl)
          } else if (path.startsWith('http')) {
            // [MEDIUM-006] 브라우저 fallback: http URL만 다른 탭으로
            window.open(path, '_blank', 'noopener,noreferrer')
          }
          // 로컈 file:// 경로는 브라우저에서 접근 불가
        }}
      />

      {isChatFloating && (
        <FloatingChat
          messages={chatMessages}
          onSend={sendChatMessage}
          onClear={clearChatMessages}
          username={username}
          userColor={userColor}
          serverRunning={serverRunning}
          onDockBack={() => setIsChatFloating(false)}
          hasUnread={hasChatUnread}
          onClearUnread={() => setHasChatUnread(false)}
        />
      )}

      {/* 🤖 AIPanel이 닫혔거나 비활성화인 상태에서도 셋팅창 등에서 모델 허브 모달을 띄울 수 있도록 보완 */}
      {showModelHub && (!showAIPanel || !isAIPanelReady) && (
        <AIPanel
          isOpen={false}
          onClose={() => {}}
          messages={[]}
          isGenerating={false}
          isAvailable={isAvailable}
          models={models}
          settings={aiSettings}
          onSend={() => {}}
          onAbort={() => {}}
          onClear={() => {}}
          onUpdateSettings={() => {}}
          currentContent={currentContent}
          showModelHub={showModelHub}
          setShowModelHub={setShowModelHub}
          refreshModels={refreshModels}
          downloadStatus={downloadStatus}
          setDownloadStatus={setDownloadStatus}
          taggedBlocks={taggedBlocks}
          setTaggedBlocks={setTaggedBlocks}
          onScrollToBlock={handleScrollToBlock}
        />
      )}

      {/* 📥 글로벌 모델 다운로드 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '46px',
          right: '20px',
          background: 'rgba(5, 5, 10, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: '8px',
          padding: '10px 16px',
          color: '#fff',
          fontSize: '12.5px',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(6, 182, 212, 0.15)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideUp 0.3s ease-out',
        }}>
          <Sparkles size={14} style={{ color: 'var(--secondary)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🔍 찾기 및 바꾸기 (Find & Replace) 플로팅 바 */}
      <FindReplaceBar
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        editor={editor}
        onScrollToBlock={handleScrollToBlock}
        initialMode={findReplaceMode}
      />
    </div>
  )
}
