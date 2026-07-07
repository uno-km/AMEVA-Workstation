const fs = require('fs');

let content = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

const import_block = `
import { useUIStore } from './stores/useUIStore'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { useProcessStore } from './stores/useProcessStore'
import { useAppBootstrap } from './hooks/app/useAppBootstrap'
import { useAppIpcBridge } from './hooks/app/useAppIpcBridge'
import { useGlobalShortcuts } from './hooks/app/useGlobalShortcuts'
import { useYoutubePiP } from './hooks/app/useYoutubePiP'
`;

if (!content.includes("import { useUIStore")) {
    content = content.replace("import React,", import_block.trim() + "\nimport React,");
}

const app_start_idx = content.indexOf('export default function App() {');

let sync_start_idx = content.indexOf('ydoc, provider, peers, serverRunning, serverInfo, serverIp,');

if (app_start_idx !== -1 && sync_start_idx !== -1) {
    // We want to slice right before the `  // 실시간 동기화 훅` or before `const {`
    // Let's find `const {` before the sync_start_idx
    let block_start = content.lastIndexOf('const {', sync_start_idx);
    let comment_start = content.lastIndexOf('//', block_start);
    if (comment_start !== -1 && (block_start - comment_start) < 100) {
        sync_start_idx = comment_start;
    } else {
        sync_start_idx = block_start;
    }

    const new_app_start = `export default function App() {
  const [documentId] = useState('default-doc')
  const [username] = useState(randomUsername)
  const [userColor] = useState(randomColor)

  const {
    filePath, setFilePath, currentContent, setCurrentContent,
    originalContent, setOriginalContent, lastSavedTime, setLastSavedTime,
    fileOpenMode, setFileOpenMode, tabs, setTabs,
    activeTabId, setActiveTabId, appendedFiles, setAppendedFiles,
    selectedText, setSelectedText, activeBlockId, setActiveBlockId,
    taggedBlocks, setTaggedBlocks, selectedSnapshot, setSelectedSnapshot
  } = useWorkspaceStore()

  const {
    isSettingsOpen, setIsSettingsOpen, isAboutOpen, setIsAboutOpen,
    isGuideOpen, setIsGuideOpen, isDiffOpen, setIsDiffOpen,
    showMarketplaceModal, setShowMarketplaceModal,
    showPricingModal, setShowPricingModal, showModelHub, setShowModelHub,
    showAIPanel, setShowAIPanel, activeRightTab, setActiveRightTab,
    showSidebar, setShowSidebar, showStatusBar, setShowStatusBar,
    toastMessage, setToastMessage, showFindReplace, setShowFindReplace,
    findReplaceMode, setFindReplaceMode, isChatFloating, setIsChatFloating,
    hasChatUnread, setHasChatUnread
  } = useUIStore()

  const {
    downloadStatus, setDownloadStatus,
    exportProgress, setExportProgress, resetExportProgress,
    exportMinimized, setExportMinimized,
    isProPlan, setIsProPlan, isFreeModeLocked, setIsFreeModeLocked,
    mcpServersState, setMcpServersState,
    activePlugins, setActivePlugins,
    editorZoom, setEditorZoom, browserZoom, setBrowserZoom
  } = useProcessStore()

  const [editorMode, setEditorMode] = useState<EditorMode>('welcome')

  const [settings, setSettings] = useState<AppSettings>(() => {
    const DEFAULT: AppSettings = {
      showPeersPointer: true, showPeersDrag: true, showCodeConsole: true, autoSnapshot: true,
      theme: 'dark', wordWrap: true, showMinimap: true, installedPlugins: [],
      hotkeys: {
        save: 'Control+s', open: 'Control+o', newFile: 'Control+n', pdfExport: 'Control+p',
        toggleAI: 'Control+\\\\', toggleMode: 'Control+e', zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
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

  // 1. App Bootstrap (ProPlan, FreeMode, MCP 로드, Plugin 로드, Browser Zoom 초기화)
  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
      const existingScript = document.getElementById(\`script-plugin-\${id}\`)
      if (!existingScript) {
        const res = await fetch(scriptUrl)
        if (!res.ok) throw new Error('플러그인 다운로드 실패')
        const scriptText = await res.text()
        const script = document.createElement('script')
        script.id = \`script-plugin-\${id}\`
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

  // 2. IPC Bridge (파일 오픈 이벤트, LLM 다운로드 진행 상황)
  useAppIpcBridge()

  // 3. YouTube PiP
  const { pipVideoId, setPipVideoId, pipPosition, isDraggingPip, setIsDraggingPip } = useYoutubePiP()

  const handleUninstallPlugin = (id: string) => {
    const script = document.getElementById(\`script-plugin-\${id}\`)
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

  // 패널 리사이징 상태
  const { width: sidebarWidth, isDragging: isSidebarDragging, handleMouseDown: handleSidebarResizeStart } = usePanelResize({
    storageKey: 'sidebar', defaultWidth: 280, minWidth: 160, maxWidth: 520, direction: 'right'
  })
  const { width: aiPanelWidth, isDragging: isAIPanelDragging, handleMouseDown: handleAIPanelResizeStart } = usePanelResize({
    storageKey: 'ai-panel', defaultWidth: 320, minWidth: 220, maxWidth: 600, direction: 'left'
  })

  // 에디터 탭 동기화 (스토어로 교체됨)
  useEffect(() => {
    if (fileOpenMode === 'tab' && activeTabId) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: currentContent } : t))
    }
  }, [currentContent, activeTabId, fileOpenMode, setTabs])
  
  // 새로고침 함수
  const refreshMcpServers = () => {
    try {
      const stored = localStorage.getItem('mcp-servers-config')
      if (stored) setMcpServersState(JSON.parse(stored))
      const proStored = localStorage.getItem('is-pro-plan') === 'true'
      setIsProPlan(proStored)
    } catch {}
  }

  `;
    
    content = content.substring(0, app_start_idx) + new_app_start + content.substring(sync_start_idx);
    fs.writeFileSync('src/renderer/App.tsx', content, 'utf-8');
    console.log("Successfully replaced App.tsx state block.");
} else {
    console.log(`Failed to find indices. app_start: ${app_start_idx}, sync_start: ${sync_start_idx}`);
}
