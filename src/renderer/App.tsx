import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { MarkdownEditor } from './components/MarkdownEditor'
import { DiffModal } from './components/DiffModal'
import { SettingsModal, type AppSettings } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { MenuBar } from './components/MenuBar'
import { AboutModal } from './components/AboutModal'
import { MarkdownGuideModal } from './components/MarkdownGuideModal'
import { AIPanel } from './components/AIPanel'
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
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  blocksToHTML, exportToWord, exportToExcel,
  exportToPPTX, exportToHWPX, exportToXML,
} from './utils/exporters'
import { normalizeBlocks } from './utils/normalizeBlocks'

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    jupyter: JupyterBlock
  }
})

// jupyter 블록을 마크다운 변환 시 표준 codeBlock으로 복구하는 도우미
function convertJupyterToCodeBlocks(blocks: any[]): any[] {
  return blocks.map(block => {
    const copy = { ...block }
    if (copy.type === 'jupyter') {
      copy.type = 'codeBlock'
      const lang = copy.props?.language || 'javascript'
      
      // 코드 텍스트를 그대로 전달하며 언어 지정을 props.language에 실어 표준 마크다운 펜스로 저장합니다.
      const finalCodeText = copy.props?.code || ''
      copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
      copy.props = {
        language: lang
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
  content = content.replace(/\n*```([a-zA-Z0-9_-]+)[^\n]*\n+/g, '\n\n```$1\n')
  // closing fence 또는 언어가 없는 fence 정밀 매칭
  content = content.replace(/\n*```[^\n]*\n+/g, '\n```\n\n')
  
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

function cleanCodeBlocks(blocks: any[]) {
  const supportedLangs = ['python', 'py', 'javascript', 'js', 'html', 'css', 'c', 'cpp', 'java', 'xml', 'json', 'text', 'txt', 'mermaid', 'bash', 'sh', 'typescript', 'ts', 'sql']
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
          // supportedLangs에 없지만 block.props.language와 동일한 경우도 해당 언어로 세팅
          lang = block.props.language.toLowerCase()
        }
        finalCode = lines.slice(1).join('\n')
      } 
      // 3단계: 기본 block.props.language 매칭 시도
      else {
        lang = (block.props?.language || 'javascript').toLowerCase()
      }
      
      block.type = 'jupyter'
      block.props = {
        language: lang,
        code: finalCode,
        runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
      }
      block.content = undefined
    }
    if (block.children) {
      cleanCodeBlocks(block.children)
    }
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

// ── 메인 앱 컴포넌트 ─────────────────────────────────────────
export default function App() {
  const [documentId] = useState('default-doc')
  const [username] = useState(randomUsername)
  const [userColor] = useState(randomColor)

  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [currentContent, setCurrentContent] = useState('')

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
  const [showSidebar, setShowSidebar] = useState(true)
  const [showAIPanel, setShowAIPanel] = useState(false)

  const [settings, setSettings] = useState<AppSettings>(() => {
    const DEFAULT: AppSettings = {
      showPeersPointer: true,
      showPeersDrag: true,
      showCodeConsole: true,
      autoSnapshot: true,
      theme: 'dark',
      wordWrap: true,
    }
    try {
      const stored = localStorage.getItem('app-settings')
      if (stored) return { ...DEFAULT, ...JSON.parse(stored) }
    } catch {}
    return DEFAULT
  })

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])
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
    updateMessageDiffState,
  } = useAI()

  const { messages: chatMessages, sendMessage: sendChatMessage, clearMessages: clearChatMessages } = useChat(
    ydoc, provider, username, userColor, serverRunning
  )

  // ── BlockNote 에디터 ────────────────────────────────────────
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null)
  const isInitialLoad = useRef(true)

  // ── AI 에디터 텍스트 연동 및 적용 ─────────────────────────────
  const [selectedText, setSelectedText] = useState('')
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)

  const handleApplySuggestion = useCallback((text: string, mode: 'replace' | 'insert', blockId?: string) => {
    if (!editor) return
    try {
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
          view.focus()
          setSelectedText('')
        }, 20)
      }
    } catch (err) {
      console.error('AI 제안 에디터 반영 실패:', err)
    }
  }, [editor])

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
      const welcomeMD = `# 🚀 AMEVA Nexus

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
    A[사용자] --> B[AMEVA Nexus]
    B --> C[AI 어시스턴트]
    B --> D[실시간 협업]
    B --> E[문서 변환]
    C --> F[로컬 LLM]
    D --> G[Y.js CRDT]
\`\`\`
`
      const initBlocks = async () => {
        const normalized = normalizeMarkdown(welcomeMD)
        const blocks = await activeEditor.tryParseMarkdownToBlocks(normalized)
        cleanCodeBlocks(blocks)
        activeEditor.replaceBlocks(activeEditor.document, blocks)
        setCurrentContent(welcomeMD)
      }
      initBlocks()
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
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomIn() }
        else if (e.key === '-') { e.preventDefault(); handleZoomOut() }
        else if (e.key === '0') { e.preventDefault(); handleZoomReset() }
        else if (e.key === 's' || e.key === 'S') {
          e.preventDefault()
          if (e.altKey || e.shiftKey) {
            handleSaveAsFile()
          } else {
            handleSaveFile()
          }
        }
        else if (e.key === 'o') { e.preventDefault(); handleOpenFile() }
        else if (e.key === 'p') { e.preventDefault(); handleExport('pdf') }
        else if (e.key === '\\') { e.preventDefault(); setShowAIPanel(p => !p) }
        else if (e.key === 'h' || e.key === 'H' || (e.shiftKey && (e.key === 'v' || e.key === 'V'))) {
          e.preventDefault()
          handleSwitchMode(editorMode === 'edit' ? 'preview' : 'edit')
        }
        else if (e.key === 'd' || e.key === 'D') {
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
  const loadMarkdownIntoEditor = async (targetEditor: BlockNoteEditor, rawContent: string) => {
    const normalized = normalizeMarkdown(rawContent)
    const blocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(blocks)
    targetEditor.replaceBlocks(targetEditor.document, blocks)
    try {
      const derived = await targetEditor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(targetEditor.document))
      setCurrentContent(derived)
    } catch {
      // 역변환 실패 시 원본으로 폴백 (최소한 preview는 뭔가 보여줌)
      setCurrentContent(rawContent)
    }
  }

  // 아래로 계속 이어서 열기 (Append Mode)
  const appendMarkdownIntoEditor = async (targetEditor: BlockNoteEditor, rawContent: string, fileName: string) => {
    const normalized = normalizeMarkdown(rawContent)
    const newBlocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(newBlocks)
    
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
      setCurrentContent(rawContent)
    }
  }

  // 탭으로 새로 열기 (Tab Mode)
  const openFileInTab = async (targetEditor: BlockNoteEditor, fileContent: string, path: string) => {
    const currentBlocks = [...targetEditor.document]
    const currentActiveId = activeTabId
    
    const normalized = normalizeMarkdown(fileContent)
    const newBlocks = await targetEditor.tryParseMarkdownToBlocks(normalized)
    cleanCodeBlocks(newBlocks)
    
    const newTabId = 'tab-' + Math.random().toString(36).substr(2, 9)
    const newTab = {
      id: newTabId,
      filePath: path,
      content: fileContent,
      blocks: newBlocks
    }
    
    setTabs(prev => {
      const updated = prev.map(t => {
        if (t.id === currentActiveId) {
          return { ...t, filePath: filePath, content: currentContent, blocks: currentBlocks }
        }
        return t
      })
      return [...updated, newTab]
    })
    
    setActiveTabId(newTabId)
    setFilePath(path)
    setCurrentContent(fileContent)
    
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
          return { ...t, filePath: filePath, content: currentContent, blocks: currentBlocks }
        }
        return t
      })
      
      const targetTab = updated.find(t => t.id === tabId)
      if (targetTab) {
        setTimeout(async () => {
          setFilePath(targetTab.filePath)
          setCurrentContent(targetTab.content)
          
          if (targetTab.blocks && targetTab.blocks.length > 0) {
            editor.replaceBlocks(editor.document, targetTab.blocks)
          } else {
            const normalized = normalizeMarkdown(targetTab.content || '')
            const parsed = await editor.tryParseMarkdownToBlocks(normalized)
            cleanCodeBlocks(parsed)
            editor.replaceBlocks(editor.document, parsed)
          }
        }, 0)
      }
      
      return updated
    })
    
    setActiveTabId(tabId)
  }, [editor, activeTabId, filePath, currentContent])

  // 탭 닫기
  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId)
      if (remaining.length === 0) {
        const defaultTab = { id: 'default', filePath: null, content: '', blocks: [] }
        if (editor) {
          editor.replaceBlocks(editor.document, [])
        }
        setFilePath(null)
        setCurrentContent('')
        setActiveTabId('default')
        return [defaultTab]
      }
      
      if (activeTabId === tabId) {
        const nextTab = remaining[0]
        setActiveTabId(nextTab.id)
        setFilePath(nextTab.filePath)
        setCurrentContent(nextTab.content)
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
          await appendMarkdownIntoEditor(editor, file.content, file.filePath.split(/[\\/]/).pop() || '파일')
        } else if (fileOpenMode === 'tab') {
          await openFileInTab(editor, file.content, file.filePath)
        } else {
          setFilePath(file.filePath)
          await loadMarkdownIntoEditor(editor, file.content)
        }
      }
    } else {
      // 브라우저 환경 (Electron 없음)
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const reader = new FileReader()
          reader.onload = async (evt) => {
            const content = evt.target?.result as string
            if (fileOpenMode === 'append') {
              await appendMarkdownIntoEditor(editor, content, file.name)
            } else if (fileOpenMode === 'tab') {
              await openFileInTab(editor, content, file.name)
            } else {
              setFilePath(file.name)
              await loadMarkdownIntoEditor(editor, content)
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
    const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFile(markdown, filePath || undefined)
      if (savedPath) {
        setFilePath(savedPath)
        createSnapshot(`저장본 (${new Date().toLocaleTimeString()})`, markdown)
      }
    } else {
      triggerBrowserDownload(markdown, filePath || 'document.md')
      createSnapshot('웹 브라우저 저장본', markdown)
    }
  }

  const handleSaveAsFile = async () => {
    if (!editor) return
    const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFile(markdown, undefined)
      if (savedPath) { setFilePath(savedPath); createSnapshot('다른 이름으로 저장본', markdown) }
    } else {
      triggerBrowserDownload(markdown, 'document_new.md')
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
            const html = blocksToHTML(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              html, false, 'document.html',
              [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
            )
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
            setP(35, 'Word 문서 생성 중...')
            const blob = await exportToWord(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              await blobToBase64(blob), true, 'document.docx',
              [{ name: 'Word Document', extensions: ['docx'] }]
            )
            break
          }

          case 'xlsx': {
            setP(35, 'Excel 데이터 생성 중...')
            const data = exportToExcel(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              arrayBufferToBase64(data.buffer), true, 'tables.xlsx',
              [{ name: 'Excel Worksheet', extensions: ['xlsx'] }]
            )
            break
          }

          case 'pptx': {
            setP(35, 'PowerPoint 슬라이드 생성 중...')
            const data = await exportToPPTX(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              arrayBufferToBase64(data), true, 'presentation.pptx',
              [{ name: 'PowerPoint', extensions: ['pptx'] }]
            )
            break
          }

          case 'hwpx': {
            setP(35, '한글 문서 생성 중...')
            const blob = await exportToHWPX(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              await blobToBase64(blob), true, 'document.hwpx',
              [{ name: 'Hancom HWPX', extensions: ['hwpx'] }]
            )
            break
          }

          case 'xml': {
            setP(40, 'XML 변환 중...')
            const xml = exportToXML(blocks)
            setP(65, '저장 대화상자 열기...')
            savedPath = await window.electronAPI.saveExportedFile(
              xml, false, 'document.xml',
              [{ name: 'XML Document', extensions: ['xml'] }]
            )
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
          case 'xlsx': triggerBrowserDownload(new Blob([exportToExcel(blocks).buffer]), 'tables.xlsx'); savedPath = 'tables.xlsx'; break
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
        editor.replaceBlocks(editor.document, blocks)
      } catch (err) {
        console.error('[handleSwitchMode] editor blocks 로드 실패:', err)
      }
    }

    setEditorMode(mode)
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
    window.electronAPI?.openExternalLink('https://github.com/uno-km/AMEVA-Model-Nexus')
  }

  const handleCloseApp = () => {
    window.electronAPI?.closeApp()
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
      />

      {/* 메인 레이아웃: 사이드바 + 에디터 + AI패널 */}
      <div className="main-layout-row">

        {/* 사이드바 토글 버튼 */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          style={{
            position: 'absolute',
            left: showSidebar ? `${sidebarWidth - 14}px` : '10px',
            top: '12px', width: '28px', height: '28px',
            borderRadius: '6px', background: 'var(--bg-glass)',
            border: '1px solid var(--border-glow)', color: 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 102,
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          title={showSidebar ? '사이드바 접기' : '사이드바 열기'}
        >
          {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

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
              showAIPanel={showAIPanel}
              onToggleAI={() => setShowAIPanel(p => !p)}
              chatMessages={chatMessages}
              onChatSend={sendChatMessage}
              onChatClear={clearChatMessages}
              username={username}
              userColor={userColor}
            />
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
          />
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
          <AIPanel
            isOpen={showAIPanel}
            onClose={() => setShowAIPanel(false)}
            messages={aiMessages}
            isGenerating={isGenerating}
            isAvailable={isAvailable}
            models={models}
            settings={aiSettings}
            onSend={generateResponse}
            onAbort={abortGeneration}
            onClear={clearAIHistory}
            onUpdateSettings={updateAISettings}
            currentContent={currentContent}
            panelWidth={aiPanelWidth}
            selectedText={selectedText}
            onClearSelectedText={() => setSelectedText('')}
            onApplySuggestion={handleApplySuggestion}
            onUpdateDiffState={updateMessageDiffState}
            activeBlockId={activeBlockId || undefined}
          />
        </div>
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
        />
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
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
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

      {/* 내보내기 진행 모달 */}
      <ExportModal
        progress={exportProgress}
        minimized={exportMinimized}
        onMinimize={() => setExportMinimized(prev => !prev)}
        onClose={() => { setExportProgress(IDLE_PROGRESS); setExportMinimized(false) }}
        onOpenFile={(path) => {
          // Electron: shell.openPath로 파일 탐색기에서 열기
          if (window.electronAPI?.openExternalLink) {
            // 파일 경로를 file:// URL로 변환
            const fileUrl = path.startsWith('http') ? path : `file:///${path.replace(/\\/g, '/')}`
            window.electronAPI.openExternalLink(fileUrl)
          }
        }}
      />
    </div>
  )
}
