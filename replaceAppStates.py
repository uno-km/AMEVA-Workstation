import re

with open('src/renderer/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports for stores and hooks
import_block = """
import { useUIStore } from './stores/useUIStore'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { useProcessStore } from './stores/useProcessStore'
import { useAppBootstrap } from './hooks/app/useAppBootstrap'
import { useAppIpcBridge } from './hooks/app/useAppIpcBridge'
import { useGlobalShortcuts } from './hooks/app/useGlobalShortcuts'
import { useYoutubePiP } from './hooks/app/useYoutubePiP'
"""

if "import { useUIStore" not in content:
    content = content.replace("import React,", import_block.strip() + "\nimport React,")

# Find the start of the App component
app_start_idx = content.find('export default function App() {')

# The end of the state block to replace is right before:
# const {
#   ydoc, provider, peers,
sync_start_idx = content.find('  const {\n    ydoc, provider, peers')
if sync_start_idx == -1:
    sync_start_idx = content.find('  const {\n    ydoc, provider, peers, serverRunning')

if app_start_idx != -1 and sync_start_idx != -1:
    new_app_start = """export default function App() {
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
    hasChatUnread, setHasChatUnread, toggleRightTab
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

  // 1. App Bootstrap (ProPlan, FreeMode, MCP 로드, Plugin 로드, Browser Zoom 초기화)
  const handleInstallPlugin = async (id: string, scriptUrl: string) => {
    try {
      const existingScript = document.getElementById(script-plugin-)
      if (!existingScript) {
        const res = await fetch(scriptUrl)
        if (!res.ok) throw new Error('플러그인 다운로드 실패')
        const scriptText = await res.text()
        const script = document.createElement('script')
        script.id = script-plugin-
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
  const { pipVideoId, setPipVideoId, pipPosition, isDraggingPip, setIsDraggingPip, handlePipMouseDown } = useYoutubePiP()

  const handleUninstallPlugin = (id: string) => {
    const script = document.getElementById(script-plugin-)
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

"""
    
    content = content[:app_start_idx] + new_app_start + "\n" + content[sync_start_idx:]
    with open('src/renderer/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully replaced App.tsx state block.")
else:
    print(f"Failed to find indices. app_start: {app_start_idx}, sync_start: {sync_start_idx}")
