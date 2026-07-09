import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from './stores/useUIStore'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { useProcessStore } from './stores/useProcessStore'
import { useAppBootstrap } from './hooks/app/useAppBootstrap'
import { useAppTabs } from './hooks/app/useAppTabs'
import { useAppIpcBridge } from './hooks/app/useAppIpcBridge'
import { useShallow } from 'zustand/react/shallow'
import { useGlobalShortcuts } from './hooks/app/useGlobalShortcuts'
import { useAppFileOperations } from './hooks/app/useAppFileOperations'
import { useAppAISuggestions } from './hooks/app/useAppAISuggestions'
import { useCollaboration } from './hooks/useCollaboration'
import { useHistory } from './hooks/useHistory'

import { useAI } from './hooks/useAI'
import { useChat } from './hooks/useChat'
import { usePanelResize } from './hooks/usePanelResize'
import { useAppExport } from './hooks/app/useAppExport'
import { type EditorMode } from '../shared/types'
import { type AmevaEditor as AppEditor } from './editor/amevaBlockSchema'

import { useAppSettingsManager } from './hooks/app/useAppSettingsManager'
import { useAppEditorInit } from './hooks/app/useAppEditorInit'
import { useAppGlobalApi } from './hooks/app/useAppGlobalApi'
import { useAppEditorSync } from './hooks/app/useAppEditorSync'
import { useAppModeSwitch } from './hooks/app/useAppModeSwitch'
import { AppLayout } from './components/layout/AppLayout'
import { AppProvider } from './contexts/AppContext'

const COLLAB_COLORS = ['#a855f7', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e']
const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)]
const randomUsername = `User_${Math.random().toString(36).substring(2, 7).toUpperCase()}`

export default function App() {
  const [documentId] = useState('default-doc')
  const [username, setUsername] = useState(randomUsername)
  const [userColor, setUserColor] = useState(randomColor)
  const [editor, setEditor] = useState<AppEditor | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('welcome')
  const [serverPort, setServerPort] = useState(1234)
  const [serverHost, setServerHost] = useState('localhost')
  const [useLocalServer, setUseLocalServer] = useState(true)

  const {
    filePath, setFilePath, currentContent, setCurrentContent, appendContent,
    originalContent, setOriginalContent, lastSavedTime, setLastSavedTime,
    fileOpenMode, setFileOpenMode, updateActiveTab,
    activeTabId, setActiveTabId,
    setSelectedText, setActiveBlockId,
    taggedBlocks, setTaggedBlocks
  } = useWorkspaceStore()

  const { updateInsertSuggestionStatus } = useAI()

  const {
    ydoc, provider, peers, serverRunning,
    isConnected, toggleLocalServer, handleMouseMove,
    updateDragSelection, updateBlockHighlight, editorContainerRef,
    isActive, collaborationLink,
  } = useCollaboration(documentId, username, userColor, 1234, 'localhost', true)

  const { snapshots, createSnapshot, deleteSnapshot, getLineDiff } = useHistory(documentId)

  const {
    loadMarkdownIntoEditor, appendMarkdownIntoEditor, openFileInTab,
    handleStartNewDocument, handleOpenFile, handleSaveFile, handleSaveAsFile
  } = useAppFileOperations(editor, setEditorMode, createSnapshot)

  const { handleScrollToBlock } = useAppAISuggestions(editor, updateInsertSuggestionStatus)

  const { handleNewTab } = useAppTabs(
    editor, filePath, setFilePath, currentContent, setCurrentContent,
    originalContent, setOriginalContent, lastSavedTime, setLastSavedTime
  )

  const { handleExport } = useAppExport(editor)

  const {
    showModelHub,
    showAIPanel, setShowAIPanel, toggleAIPanel, activeRightTab, setActiveRightTab,
    showSidebar, setShowSidebar, showStatusBar,
    toastMessage, showFindReplace, setShowFindReplace,
    findReplaceMode, isChatFloating,
    setIsDiffOpen
  } = useUIStore(useShallow((s) => ({
    showModelHub: s.showModelHub,
    showAIPanel: s.showAIPanel,
    setShowAIPanel: s.setShowAIPanel,
    toggleAIPanel: s.toggleAIPanel,
    activeRightTab: s.activeRightTab,
    setActiveRightTab: s.setActiveRightTab,
    showSidebar: s.showSidebar,
    setShowSidebar: s.setShowSidebar,
    showStatusBar: s.showStatusBar,
    toastMessage: s.toastMessage,
    showFindReplace: s.showFindReplace,
    setShowFindReplace: s.setShowFindReplace,
    findReplaceMode: s.findReplaceMode,
    isChatFloating: s.isChatFloating,
    setIsDiffOpen: s.setIsDiffOpen
  })))

  const {
    isProPlan, setIsProPlan, mcpServersState, setMcpServersState,
    editorZoom
  } = useProcessStore()

  const {
    settings, handleUpdateSettings, handleInstallPlugin, handleUninstallPlugin,
    handleOpenGithub, handleCloseApp, handleToggleFullscreen,
    handleZoomIn, handleZoomOut, handleZoomReset,
  } = useAppSettingsManager(activeRightTab, setActiveRightTab)

  const { isSidebarReady, isAIPanelReady } = useAppBootstrap(settings, handleInstallPlugin)

  const { DEFAULT_WELCOME_TEXT } = useAppEditorInit({
    ydoc, provider, isActive, username, userColor, setEditor, setCurrentContent
  })

  useAppGlobalApi({
    editor, currentContent, setCurrentContent, appendContent, setShowAIPanel, setActiveRightTab
  })

  useAppEditorSync({
    editor, setActiveBlockId, setCurrentContent, currentContent,
    autoSnapshot: settings.autoSnapshot, createSnapshot
  })

  const { handleRollback, handleSwitchMode, handleStartWelcomeEdit } = useAppModeSwitch({
    editor, editorMode, setEditorMode, currentContent, setCurrentContent,
    setOriginalContent, loadMarkdownIntoEditor, DEFAULT_WELCOME_TEXT
  })

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



  const handleSelectSnapshotForDiff = (snapshot: any) => {
    setSelectedSnapshot(snapshot)
    setIsDiffOpen(true)
  }

  useGlobalShortcuts({
    settings, editor, filePath, currentContent, editorMode,
    onSave: handleSaveFile, onOpen: handleOpenFile, 
    onNewTab: () => {
      handleNewTab();
      if (editorMode === 'welcome') {
        setEditorMode('edit');
      }
    },
    onToggleAI: toggleAIPanel,
    onToggleMode: () => { setEditorMode(editorMode === 'edit' ? 'preview' : 'edit') },
    onZoomIn: handleZoomIn, onZoomOut: handleZoomOut, onZoomReset: handleZoomReset
  })

  return (
    <AppProvider value={{
      settings, handleUpdateSettings, handleInstallPlugin, handleUninstallPlugin,
      handleOpenGithub, handleCloseApp, handleToggleFullscreen, handleZoomIn, handleZoomOut, handleZoomReset,
      isProPlan,
      editor, editorMode, setEditorMode, handleSwitchMode, handleStartWelcomeEdit, handleStartNewDocument,
      handleOpenFile, handleSaveFile, handleSaveAsFile, handleExport,
      snapshots, createSnapshot, deleteSnapshot, handleSelectSnapshotForDiff, handleRollback, getLineDiff,
      peers, serverRunning, serverPort, setServerPort, serverHost, setServerHost,
      useLocalServer, setUseLocalServer, toggleLocalServer, collaborationLink, isConnected,
      username, setUsername, userColor, setUserColor,
      chatMessages, sendChatMessage, clearChatMessages,
      mcpServers: mcpServersState,
      refreshMcpServers
    }}>
      <AppLayout
        settings={settings}
        showStatusBar={showStatusBar}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        sidebarWidth={sidebarWidth}
        isSidebarReady={isSidebarReady}
        editor={editor}
        editorContainerRef={editorContainerRef}
        showAIPanel={showAIPanel}
        aiPanelWidth={aiPanelWidth}
        isAIPanelDragging={isAIPanelDragging}
        handleAIPanelResizeStart={handleAIPanelResizeStart}
        isAIPanelReady={isAIPanelReady}
        showModelHub={showModelHub}
        handleSidebarResizeStart={handleSidebarResizeStart}
        isSidebarDragging={isSidebarDragging}
        editorZoom={editorZoom}
        handleMouseMove={handleMouseMove}
        updateDragSelection={updateDragSelection}
        updateBlockHighlight={updateBlockHighlight}
        setSelectedText={setSelectedText}
        taggedBlocks={taggedBlocks}
        setTaggedBlocks={setTaggedBlocks}
        isChatFloating={isChatFloating}
        toastMessage={toastMessage}
        showFindReplace={showFindReplace}
        setShowFindReplace={setShowFindReplace}
        handleScrollToBlock={handleScrollToBlock}
        findReplaceMode={findReplaceMode}
      />
    </AppProvider>
  )
}
