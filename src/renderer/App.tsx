import { useUIStore } from './stores/useUIStore'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { useProcessStore } from './stores/useProcessStore'
import { useAppBootstrap } from './hooks/app/useAppBootstrap'
import { useAppTabs } from './hooks/app/useAppTabs'
import { useAppIpcBridge } from './hooks/app/useAppIpcBridge'
import { useGlobalShortcuts } from './hooks/app/useGlobalShortcuts'
import { useAppFileOperations } from './hooks/app/useAppFileOperations'
import { useAppAISuggestions } from './hooks/app/useAppAISuggestions'
import * as ipc from './services/ipc/electronApiAdapter'
import { useState, useEffect, useRef, useCallback } from 'react'

import { useYoutubePiP } from './hooks/app/useYoutubePiP'
import { Sidebar } from './components/Sidebar'
import { MarkdownEditor } from './components/MarkdownEditor'
import { DiffModal } from './components/DiffModal'
import { SettingsModal, type AppSettings } from './components/SettingsModal'
import { StatusBar } from './components/StatusBar'
import { MenuBar } from './components/MenuBar'
import { AboutModal } from './components/AboutModal'
import { MarkdownGuideModal } from './components/MarkdownGuideModal'
import { AIPanel } from './components/AIPanel'
import { Minimap } from './components/Minimap'
import { RightTabStrip } from './components/RightTabStrip'
import { MarketplaceModal } from './components/MarketplaceModal'
import { PricingModal } from './components/PricingModal'
import { ExportModal, IDLE_PROGRESS } from './components/ExportModal'
import { ResizeHandle } from './components/ResizeHandle'
import { useCollaboration } from './hooks/useCollaboration'
import { useHistory } from './hooks/useHistory'
import { useAI } from './hooks/useAI'
import { useChat } from './hooks/useChat'
import { usePanelResize } from './hooks/usePanelResize'
import type { EditorMode, DocumentSnapshot } from '../shared/types'
import { PanelLeft, Sparkles } from 'lucide-react'
import { useAppExport } from './hooks/app/useAppExport'
import { FloatingChat } from './components/FloatingChat'
import { FindReplaceBar } from './components/FindReplaceBar'
import { convertJupyterToCodeBlocks, normalizeMarkdown, cleanCodeBlocks, ensureBlockIds, cleanMarkdownCodeBlocks } from './utils/markdownUtils'



import { BlockNoteEditor } from "@blocknote/core"
import { amevaSchema as schema, type AmevaEditor as AppEditor, type AmevaPartialBlock as AppPartialBlock } from './editor/amevaBlockSchema'



// ── 랜덤 사용자 설정 ─────────────────────────────────────────
const COLLAB_COLORS = ['#a855f7', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e']
const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)]
const randomUsername = `User_${Math.random().toString(36).substring(2, 7).toUpperCase()}`

// ── 메인 앱 컴포넌트 ─────────────────────────────────────────
const DEFAULT_WELCOME_TEXT = `# 🚀 AMEVA Workstation

(AMEVA-OS WebAssembly Kernel & AI Hub)

이곳에서 문서 작성, 코드 실행, 파일 시스템 탐색을 할 수 있습니다.`;

export default function App() {
  const [documentId] = useState('default-doc')
  const [username, setUsername] = useState(randomUsername)
  const [userColor, setUserColor] = useState(randomColor)

  const {
    filePath, setFilePath, currentContent, setCurrentContent, appendContent,
    originalContent, setOriginalContent, lastSavedTime, setLastSavedTime,
    fileOpenMode, setFileOpenMode, tabs, setTabs, updateActiveTab,
    activeTabId, setActiveTabId, appendedFiles, setAppendedFiles,
    selectedText, setSelectedText, activeBlockId, setActiveBlockId,
    taggedBlocks, setTaggedBlocks,
    selectedSnapshot, setSelectedSnapshot
  } = useWorkspaceStore()


  const {
    messages: aiMessages, isGenerating, isAvailable, models,
    settings: aiSettings, generateResponse, abortGeneration,
    clearHistory: clearAIHistory, updateSettings: updateAISettings,
    updateMessageDiffState, updateInsertSuggestionStatus, engineLogs, setEngineLogs,
    refreshModels, importModel, pendingQueue, removeFromQueue,
  } = useAI()

  const {
    ydoc, provider, peers, serverRunning,
    isConnected, toggleLocalServer, handleMouseMove,
    updateDragSelection, updateBlockHighlight, editorContainerRef,
    isActive, collaborationLink,
  } = useCollaboration(documentId, username, userColor, 1234, 'localhost', true)

  const { snapshots, createSnapshot, deleteSnapshot, getLineDiff } = useHistory(documentId)

  const [editor, setEditor] = useState<AppEditor | null>(null)

  const [editorMode, setEditorMode] = useState<EditorMode>('welcome')

  const {
    loadMarkdownIntoEditor,
    appendMarkdownIntoEditor,
    openFileInTab,
    handleStartNewDocument,
    handleOpenFile,
    handleSaveFile,
    handleSaveAsFile
  } = useAppFileOperations(editor, setEditorMode, createSnapshot)

  const {
    customSetTaggedBlocks,
    handleScrollToBlock,
    handleApplySuggestion,
    handleApplyInsertSuggestion
  } = useAppAISuggestions(editor, updateInsertSuggestionStatus)

  const { handleNewTab, handleSelectTab, handleCloseTab } = useAppTabs(
    editor,
    filePath,
    setFilePath,
    currentContent,
    setCurrentContent,
    originalContent,
    setOriginalContent,
    lastSavedTime,
    setLastSavedTime
  )

  const { handleExport } = useAppExport(editor)

  const {
    isSettingsOpen, setIsSettingsOpen, isAboutOpen, setIsAboutOpen,
    isGuideOpen, setIsGuideOpen, isDiffOpen, setIsDiffOpen,
    showMarketplaceModal, setShowMarketplaceModal,
    showPricingModal, setShowPricingModal, showModelHub, setShowModelHub,
    showAIPanel, setShowAIPanel, toggleAIPanel, activeRightTab, setActiveRightTab,
    showSidebar, setShowSidebar, showStatusBar, setShowStatusBar,
    toastMessage, showFindReplace, setShowFindReplace,
    findReplaceMode, isChatFloating, setIsChatFloating,
    hasChatUnread, setHasChatUnread
  } = useUIStore()

  const {
    downloadStatus, setDownloadStatus,
    exportProgress, setExportProgress,
    exportMinimized, setExportMinimized, toggleExportMinimized,
    isProPlan, setIsProPlan,
    mcpServersState, setMcpServersState,
    editorZoom, setEditorZoom, adjustEditorZoom, browserZoom, setBrowserZoom
  } = useProcessStore()



  const handleZoomIn = () => adjustEditorZoom(0.1)
  const handleZoomOut = () => adjustEditorZoom(-0.1)
  const handleZoomReset = () => {
    setEditorZoom(1.0)
    if (ipc.isElectronEnv()) {
      ipc.setZoomFactor(1.0)
      setBrowserZoom(1.0)
    }
  }
  const handleToggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const [settings, setSettings] = useState<AppSettings>(() => {
    const DEFAULT: AppSettings = {
      showPeersPointer: true, showPeersDrag: true, showCodeConsole: true, autoSnapshot: true,
      theme: 'dark', wordWrap: true, showMinimap: true, installedPlugins: [],
      hotkeys: {
        save: 'Control+s', open: 'Control+o', newFile: 'Control+n', pdfExport: 'Control+p',
        toggleAI: 'Control+\\', toggleMode: 'Control+e', zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
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

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const [serverPort, setServerPort] = useState(1234)
  const [serverHost, setServerHost] = useState('localhost')
  const [useLocalServer, setUseLocalServer] = useState(true)

  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
      const existingScript = document.getElementById(`script-plugin-${id}`)
      if (!existingScript) {
        const res = await fetch(scriptUrl)
        if (!res.ok) throw new Error('플러그인 다운로드 실패')
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
              setSettings(prev => {
                const next = { ...prev, installedPlugins: [...(prev.installedPlugins || []), id] }
                localStorage.setItem('app-settings', JSON.stringify(next))
                return next
              })
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
      console.error('플러그인 로드 실패:', err)
      throw err
    }
  }

  const { isSidebarReady, isAIPanelReady } = useAppBootstrap(settings, handleInstallPlugin)

  useAppIpcBridge(useCallback(async (file) => {
    if (!editor) return
    if (fileOpenMode === 'append') {
      await appendMarkdownIntoEditor(editor, file.content, file.filePath.split(/[\\/]/).pop() || '파일', file.isBinary, file.filePath)
    } else if (fileOpenMode === 'tab') {
      await openFileInTab(editor, file.content, file.filePath, file.isBinary)
    } else {
      setFilePath(file.filePath)
      await loadMarkdownIntoEditor(editor, file.content, file.isBinary, file.filePath)
    }
  }, [editor, fileOpenMode, appendMarkdownIntoEditor, openFileInTab, loadMarkdownIntoEditor, setFilePath]))

  const { pipVideoId, setPipVideoId, pipPosition, handlePiPMouseDown } = useYoutubePiP()

  const handleUninstallPlugin = (id: string) => {
    const script = document.getElementById(`script-plugin-${id}`)
    if (script) script.remove()
    if ((window as any).AMEVA_PLUGINS?.[id]) delete (window as any).AMEVA_PLUGINS[id]
    
    setSettings(prev => {
      const next = { ...prev, installedPlugins: (prev.installedPlugins || []).filter(p => p !== id) }
      localStorage.setItem('app-settings', JSON.stringify(next))
      return next
    })

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

  const { width: sidebarWidth, isDragging: isSidebarDragging, handleMouseDown: handleSidebarResizeStart } = usePanelResize({
    storageKey: 'sidebar', defaultWidth: 280, minWidth: 160, maxWidth: 520, direction: 'right'
  })
  const { width: aiPanelWidth, isDragging: isAIPanelDragging, handleMouseDown: handleAIPanelResizeStart } = usePanelResize({
    storageKey: 'ai-panel', defaultWidth: 320, minWidth: 220, maxWidth: 600, direction: 'left'
  })

  useEffect(() => {
    if (fileOpenMode === 'tab' && activeTabId) {
      updateActiveTab({ content: currentContent })
    }
  }, [currentContent, activeTabId, fileOpenMode, updateActiveTab])
  
  const refreshMcpServers = () => {
    try {
      const stored = localStorage.getItem('mcp-servers-config')
      if (stored) setMcpServersState(JSON.parse(stored))
      const proStored = localStorage.getItem('is-pro-plan') === 'true'
      setIsProPlan(proStored)
    } catch {}
  }



  const { messages: chatMessages, sendMessage: sendChatMessage, clearMessages: clearChatMessages } = useChat(
    ydoc, provider, username, userColor, serverRunning
  )

  useEffect(() => {
    if (chatMessages.length === 0) return
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg.author !== username && (isChatFloating || activeTabId !== 'chat')) {
      setHasChatUnread(true)
    }
  }, [chatMessages, isChatFloating, activeTabId])

  const processedUrlsRef = useRef<Set<string>>(new Set())
  const isInitialLoad = useRef(true)

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



  useEffect(() => {
    let activeEditor: AppEditor
    
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
      if (ipc.isElectronEnv()) {
        ipc.appReady()
      }
    } else {
      if (ipc.isElectronEnv()) {
        ipc.appReady()
      }
    }
  }, [ydoc, provider, isActive, username, userColor, setCurrentContent])

  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const activeBlockIdRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!editor) return
    let isUpdating = false

    const handleEditorChange = async () => {
      if (isUpdating) return

      const cursor = editor.getTextCursorPosition()
      let currentId: string | null = null

      if (cursor?.block) {
        const activeBlock = cursor.block
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
              } as AppPartialBlock)
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
                editor.updateBlock(prevId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
                isUpdating = false
              }
            }
          } catch {}
        }

        if (currentId) {
          try {
            const currentBlock = editor.getBlock(currentId)
            if (currentBlock?.type === 'heading') {
              const level = (currentBlock.props as any)?.level || 1
              const text = currentBlock.content ? (currentBlock.content as any).map((c: any) => c.text).join('') : ''
              const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### '
              if (!text.startsWith(prefix)) {
                isUpdating = true
                 editor.updateBlock(currentId, { content: [{ type: 'text', text: prefix + text, styles: {} }] } as AppPartialBlock)
                isUpdating = false
              }
            }
          } catch {}
        }
      }

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)

      syncTimeoutRef.current = setTimeout(async () => {
        if (isUpdating) return
        isUpdating = true

        try {
          const cursor = editor.getTextCursorPosition()
          const activeBlock = cursor?.block
          if (activeBlock && activeBlock.type === 'paragraph') {
            const contentArr = activeBlock.content as any[]
            if (contentArr && contentArr.length === 1 && contentArr[0].type === 'text') {
              const textVal = contentArr[0].text.trim()
              const urlPattern = /^(https?:\/\/[^\s]+)$/i
              if (urlPattern.test(textVal)) {
                if (!processedUrlsRef.current.has(activeBlock.id)) {
                  processedUrlsRef.current.add(activeBlock.id)

                  const blockId = activeBlock.id
                  let videoId = ''
                  if (textVal.includes('youtube.com/watch?v=')) {
                    videoId = textVal.split('watch?v=')[1].split('&')[0]
                  } else if (textVal.includes('youtu.be/')) {
                    videoId = textVal.split('youtu.be/')[1].split('?')[0]
                  }

                  if (videoId) {
                    editor.updateBlock(blockId, {
                      type: 'youtube',
                      props: { url: textVal, videoId: videoId }
                    })
                  } else {
                    editor.updateBlock(blockId, {
                      type: 'linkPreview',
                      props: {
                        url: textVal,
                        title: 'Loading preview...',
                        description: 'URL 프리뷰 데이터를 페치하고 있습니다...',
                        thumbnail: ''
                      }
                    })

                    if ((window as any).electronAPI?.fetchUrlMetadata) {
                      (window as any).electronAPI.fetchUrlMetadata(textVal).then((metadata: any) => {
                        try {
                          editor.updateBlock(blockId, {
                            type: 'linkPreview',
                            props: {
                              url: textVal,
                              title: metadata.title || 'Untitled Page',
                              description: metadata.description || '',
                              thumbnail: metadata.image || ''
                            }
                          })
                        } catch (updateErr) {
                          console.error('Failed to update LinkPreview block with metadata:', updateErr)
                        }
                      }).catch((fetchErr: any) => {
                        try {
                          editor.updateBlock(blockId, {
                            type: 'linkPreview',
                            props: {
                              url: textVal,
                              title: '연결 실패',
                              description: `메타데이터 수집 오류: ${fetchErr.message}`,
                              thumbnail: ''
                            }
                          })
                        } catch {}
                      })
                    }
                  }
                }
              }
            }
          }
        } catch (urlErr) {
          console.error('[URL Auto-Convert Failed]', urlErr)
        }

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
                 editor.updateBlock(activeId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
                activeHeadingCleared = true
              }
            }
          } catch {}
        }

        try {
          const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
          if (markdown.trim() !== useWorkspaceStore.getState().currentContent.trim()) setCurrentContent(markdown)
        } catch (err) {
          console.error('Markdown sync failed:', err)
        } finally {
          if (activeHeadingCleared && activeId) {
            try { editor.updateBlock(activeId, { content: [{ type: 'text', text: activeHeadingText, styles: {} }] } as AppPartialBlock) } catch {}
          }
          isUpdating = false
        }
      }, 300)
    }

    editor.onChange(handleEditorChange)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [editor, setActiveBlockId, setCurrentContent])

  useEffect(() => {
    if (!settings.autoSnapshot || !currentContent) return
    const id = setInterval(() => createSnapshot(`자동 백업`, currentContent), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [settings.autoSnapshot, currentContent, createSnapshot])





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


  // ── 내보내기 ───────────────────────────────────────────────


  // ── 스냅샷 diff ────────────────────────────────────────────

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
        const normalized = normalizeMarkdown(useWorkspaceStore.getState().currentContent)
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
      const normalized = normalizeMarkdown(currentContent || DEFAULT_WELCOME_TEXT)
      const blocks = await editor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      editor.replaceBlocks(editor.document, blocks)
      setCurrentContent(currentContent || DEFAULT_WELCOME_TEXT)
      setOriginalContent(currentContent || DEFAULT_WELCOME_TEXT)
      setEditorMode('edit')
    } catch (err) {
      console.error('웰컴 편집 로드 실패:', err)
      setEditorMode('edit')
    }
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
    if (ipc.isElectronEnv()) {
      ipc.openExternalLink('https://github.com/uno-km/AMEVA-Model-Nexus')
    } else {
      // [MEDIUM-006] 브라우저 fallback: 새 탭으로 열기
      window.open('https://github.com/uno-km/AMEVA-Model-Nexus', '_blank', 'noopener,noreferrer')
    }
  }

  const handleCloseApp = () => {
    if (ipc.isElectronEnv()) {
      ipc.closeApp()
    }
    // 브라우저에서는 창 닫기 불가 — 조용히 무시
  }

  useGlobalShortcuts({
    settings,
    editor,
    filePath,
    currentContent,
    editorMode,
    onSave: handleSaveFile,
    onOpen: handleOpenFile,
    onNewTab: handleNewTab,
    onToggleAI: toggleAIPanel,
    onToggleMode: () => {
      setEditorMode(editorMode === 'edit' ? 'preview' : 'edit')
    },
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset
  })

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
        onNewWindow={ipc.newWindow}
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
                 onToggleSidebar={() => setShowSidebar(!showSidebar)}
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
              onSend={(msg: string, ctx?: string, orig?: string, bId?: string, runtimeSettings?: Parameters<typeof generateResponse>[4]) => {
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
              setEngineLogs={setEngineLogs}
              showModelHub={showModelHub}
              setShowModelHub={setShowModelHub}
              taggedBlocks={taggedBlocks}
              setTaggedBlocks={setTaggedBlocks}
              refreshModels={refreshModels}
              importModel={importModel}
              downloadStatus={downloadStatus}
              setDownloadStatus={setDownloadStatus}
              onScrollToBlock={handleScrollToBlock}
              pendingQueue={pendingQueue}
              removeFromQueue={removeFromQueue}
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
            onMouseDown={handlePiPMouseDown}
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
              allowFullScreen
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
         onMinimize={toggleExportMinimized}
        onClose={() => { setExportProgress(IDLE_PROGRESS); setExportMinimized(false) }}
        onOpenFile={(path) => {
          const fileUrl = path.startsWith('http') ? path : `file:///${path.replace(/\\/g, '/')}`
          ipc.openExternalLink(fileUrl)
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
          pendingQueue={pendingQueue}
          removeFromQueue={removeFromQueue}
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
