import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from './stores/useUIStore'
import { useWorkspaceStore } from './stores/useWorkspaceStore'
import { useProcessStore } from './stores/useProcessStore'
import { useAppBootstrap } from './hooks/app/useAppBootstrap'
import { useAppTabs } from './hooks/app/useAppTabs'
import { useAppIpcBridge } from './hooks/app/useAppIpcBridge'
import { useGlobalShortcuts } from './hooks/app/useGlobalShortcuts'
import { useAppFileOperations } from './hooks/app/useAppFileOperations'
import { useAppAISuggestions } from './hooks/app/useAppAISuggestions'
import { useYoutubePiP } from './hooks/app/useYoutubePiP'
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
    fileOpenMode, setFileOpenMode, tabs, setTabs, updateActiveTab,
    activeTabId, setActiveTabId, appendedFiles, setAppendedFiles,
    selectedText, setSelectedText, activeBlockId, setActiveBlockId,
    taggedBlocks, setTaggedBlocks, selectedSnapshot, setSelectedSnapshot
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

  const {
    loadMarkdownIntoEditor, appendMarkdownIntoEditor, openFileInTab,
    handleStartNewDocument, handleOpenFile, handleSaveFile, handleSaveAsFile
  } = useAppFileOperations(editor, setEditorMode, createSnapshot)

  const {
    customSetTaggedBlocks, handleScrollToBlock,
    handleApplySuggestion, handleApplyInsertSuggestion
  } = useAppAISuggestions(editor, updateInsertSuggestionStatus)

  const { handleNewTab, handleSelectTab, handleCloseTab } = useAppTabs(
    editor, filePath, setFilePath, currentContent, setCurrentContent,
    originalContent, setOriginalContent, lastSavedTime, setLastSavedTime
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
    downloadStatus, setDownloadStatus, exportProgress, setExportProgress,
    exportMinimized, setExportMinimized, toggleExportMinimized,
    isProPlan, setIsProPlan, mcpServersState, setMcpServersState,
    editorZoom, browserZoom
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

  const { pipVideoId, setPipVideoId, pipPosition, handlePiPMouseDown } = useYoutubePiP()

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

  const handleSwitchOpenMode = (mode: 'replace' | 'append' | 'tab') => {
    setFileOpenMode(mode)
    if (mode === 'replace') {
      setAppendedFiles([])
      setTabs([{ id: 'default', filePath: filePath, content: currentContent, blocks: [] }])
      setActiveTabId('default')
    } else if (mode === 'append') {
      setAppendedFiles([{
        id: 'base-file',
        filePath: filePath ? filePath.split(/[\\/]/).pop() || '무제 문서.md' : '무제 문서.md',
        startBlockId: editor?.document[0]?.id || ''
      }])
    } else if (mode === 'tab') {
      setTabs([{ id: 'default', filePath: filePath, content: currentContent, blocks: [] }])
      setActiveTabId('default')
    }
  }

  const handleSelectAppendedFile = useCallback((startBlockId: string) => {
    const el = document.querySelector(`[data-id="${startBlockId}"], [data-block-id="${startBlockId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const outer = el.closest('.bn-block-outer') || el
      outer.setAttribute('data-highlighted-temp', 'true')
      setTimeout(() => { outer.removeAttribute('data-highlighted-temp') }, 1800)
    }
  }, [])

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
    <AppLayout
      settings={settings} handleUpdateSettings={handleUpdateSettings}
      handleInstallPlugin={handleInstallPlugin} handleUninstallPlugin={handleUninstallPlugin}
      handleOpenGithub={handleOpenGithub} handleCloseApp={handleCloseApp}
      handleToggleFullscreen={handleToggleFullscreen} handleZoomIn={handleZoomIn}
      handleZoomOut={handleZoomOut} handleZoomReset={handleZoomReset}
      handleOpenFile={handleOpenFile} handleSaveFile={handleSaveFile}
      handleSaveAsFile={handleSaveAsFile} handleExport={handleExport}
      editorMode={editorMode} handleSwitchMode={handleSwitchMode}
      showStatusBar={showStatusBar} setShowStatusBar={setShowStatusBar}
      showSidebar={showSidebar} setShowSidebar={setShowSidebar}
      setIsSettingsOpen={setIsSettingsOpen} setIsAboutOpen={setIsAboutOpen}
      setIsGuideOpen={setIsGuideOpen} setShowMarketplaceModal={setShowMarketplaceModal}
      setShowPricingModal={setShowPricingModal} isProPlan={isProPlan}
      sidebarWidth={sidebarWidth} isSidebarReady={isSidebarReady}
      filePath={filePath} currentContent={currentContent} setCurrentContent={setCurrentContent}
      originalContent={originalContent} lastSavedTime={lastSavedTime}
      fileOpenMode={fileOpenMode} handleSwitchOpenMode={handleSwitchOpenMode}
      appendedFiles={appendedFiles} handleSelectAppendedFile={handleSelectAppendedFile}
      tabs={tabs} activeTabId={activeTabId} handleSelectTab={handleSelectTab}
      handleCloseTab={handleCloseTab} chatMessages={chatMessages}
      sendChatMessage={sendChatMessage} clearChatMessages={clearChatMessages}
      username={username} userColor={userColor} setUserColor={setUserColor}
      setUsername={setUsername} isChatFloating={isChatFloating}
      setIsChatFloating={setIsChatFloating} setHasChatUnread={setHasChatUnread}
      hasChatUnread={hasChatUnread} handleSidebarResizeStart={handleSidebarResizeStart}
      isSidebarDragging={isSidebarDragging} editorZoom={editorZoom} browserZoom={browserZoom}
      editor={editor} peers={peers} handleMouseMove={handleMouseMove}
      updateDragSelection={updateDragSelection} updateBlockHighlight={updateBlockHighlight}
      editorContainerRef={editorContainerRef} handleStartWelcomeEdit={handleStartWelcomeEdit}
      handleStartNewDocument={handleStartNewDocument} taggedBlocks={taggedBlocks}
      customSetTaggedBlocks={customSetTaggedBlocks} setTaggedBlocks={setTaggedBlocks}
      showAIPanel={showAIPanel} setShowAIPanel={setShowAIPanel}
      aiPanelWidth={aiPanelWidth} isAIPanelDragging={isAIPanelDragging}
      handleAIPanelResizeStart={handleAIPanelResizeStart} isAIPanelReady={isAIPanelReady}
      aiMessages={aiMessages} isGenerating={isGenerating} isAvailable={isAvailable}
      models={models} aiSettings={aiSettings} generateResponse={generateResponse}
      abortGeneration={abortGeneration} clearAIHistory={clearAIHistory}
      updateAISettings={updateAISettings} selectedText={selectedText}
      setSelectedText={setSelectedText} handleApplySuggestion={handleApplySuggestion}
      updateMessageDiffState={updateMessageDiffState} handleApplyInsertSuggestion={handleApplyInsertSuggestion}
      updateInsertSuggestionStatus={updateInsertSuggestionStatus} activeBlockId={activeBlockId}
      activeRightTab={activeRightTab} setActiveRightTab={setActiveRightTab}
      engineLogs={engineLogs} setEngineLogs={setEngineLogs} showModelHub={showModelHub}
      setShowModelHub={setShowModelHub} refreshModels={refreshModels} importModel={importModel}
      downloadStatus={downloadStatus} setDownloadStatus={setDownloadStatus}
      handleScrollToBlock={handleScrollToBlock} pendingQueue={pendingQueue}
      removeFromQueue={removeFromQueue} handleToggleRightTab={handleToggleRightTab}
      pipVideoId={pipVideoId} setPipVideoId={setPipVideoId} pipPosition={pipPosition}
      handlePiPMouseDown={handlePiPMouseDown} isDiffOpen={isDiffOpen}
      setIsDiffOpen={setIsDiffOpen} selectedSnapshot={selectedSnapshot}
      getLineDiff={getLineDiff} handleRollback={handleRollback}
      isSettingsOpen={isSettingsOpen} refreshMcpServers={refreshMcpServers}
      isAboutOpen={isAboutOpen} isGuideOpen={isGuideOpen}
      showMarketplaceModal={showMarketplaceModal} showPricingModal={showPricingModal}
      exportProgress={exportProgress} setExportProgress={setExportProgress}
      exportMinimized={exportMinimized} setExportMinimized={setExportMinimized}
      toggleExportMinimized={toggleExportMinimized} serverRunning={serverRunning}
      serverPort={serverPort} setServerPort={setServerPort} serverHost={serverHost}
      setServerHost={setServerHost} useLocalServer={useLocalServer}
      setUseLocalServer={setUseLocalServer} toggleLocalServer={toggleLocalServer}
      collaborationLink={collaborationLink} isConnected={isConnected}
      snapshots={snapshots} createSnapshot={createSnapshot} deleteSnapshot={deleteSnapshot}
      handleSelectSnapshotForDiff={handleSelectSnapshotForDiff} toastMessage={toastMessage}
      showFindReplace={showFindReplace} setShowFindReplace={setShowFindReplace}
      findReplaceMode={findReplaceMode} mcpServersState={mcpServersState}
      toggleAIPanel={toggleAIPanel}
    />
  )
}
