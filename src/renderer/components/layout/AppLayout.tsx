import React from 'react'
import { PanelLeft, Sparkles } from 'lucide-react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { Sidebar } from '../Sidebar'
import { MarkdownEditor } from '../MarkdownEditor'
import type { AppSettings } from '../SettingsModal'
import { StatusBar } from '../StatusBar'
import { MenuBar } from '../MenuBar'
import { AIPanel } from '../AIPanel'
import { Minimap } from '../Minimap'
import { RightTabStrip } from '../RightTabStrip'
import { ResizeHandle } from '../ResizeHandle'
import { FloatingChat } from '../FloatingChat'
import { AILogDrawer } from '../ai/AILogDrawer'
import { FindReplaceBar } from '../FindReplaceBar'
import { FloatingPiPVideo } from './FloatingPiPVideo'
import { ModalManager } from './ModalManager'
import { type EditorMode, type DocumentSnapshot } from '../../../shared/types'
import { type AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'
import { useNatureThemeColors } from '../../hooks/app/useNatureThemeColors'
import { GlobalDownloadProgress } from '../download/GlobalDownloadProgress'
import { useDownloadManager } from '../../hooks/app/useDownloadManager'

export interface AppLayoutProps {
  settings: AppSettings
  handleUpdateSettings: (newSettings: Partial<AppSettings>) => void
  handleInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
  handleUninstallPlugin: (id: string) => void
  handleOpenGithub: () => void
  handleCloseApp: () => void
  handleToggleFullscreen: () => void
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleZoomReset: () => void
  handleOpenFile: () => void
  handleSaveFile: () => void
  handleSaveAsFile: () => void
  handleExport: (type: any) => void
  editorMode: EditorMode
  handleSwitchMode: (mode: EditorMode) => void
  showStatusBar: boolean
  setShowStatusBar: (show: boolean) => void
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void
  setIsSettingsOpen: (open: boolean, tab?: string) => void
  settingsInitialTab?: string
  setIsAboutOpen: (open: boolean) => void
  setIsGuideOpen: (open: boolean) => void
  setShowMarketplaceModal: (show: boolean) => void
  setShowPricingModal: (show: boolean) => void
  isProPlan: boolean
  sidebarWidth: number
  isSidebarReady: boolean
  filePath: string | null
  currentContent: string
  setCurrentContent: (content: string) => void
  originalContent: string
  lastSavedTime: any
  fileOpenMode: 'replace' | 'append' | 'tab'
  handleSwitchOpenMode: (mode: 'replace' | 'append' | 'tab') => void
  appendedFiles: any[]
  handleSelectAppendedFile: (id: string) => void
  tabs: any[]
  activeTabId: string | null
  handleSelectTab: (id: string) => void
  handleCloseTab: (id: string) => void
  chatMessages: any[]
  sendChatMessage: (msg: string) => void
  clearChatMessages: () => void
  username: string
  userColor: string
  setUserColor: (color: string) => void
  setUsername: (name: string) => void
  isChatFloating: boolean
  setIsChatFloating: (floating: boolean) => void
  setHasChatUnread: (unread: boolean) => void
  hasChatUnread: boolean
  handleSidebarResizeStart: (e: React.MouseEvent) => void
  isSidebarDragging: boolean
  editorZoom: number
  browserZoom: number
  editor: AppEditor | null
  peers: any[]
  handleMouseMove: (e: React.MouseEvent) => void
  updateDragSelection: any
  updateBlockHighlight: any
  editorContainerRef: React.RefObject<HTMLDivElement>
  handleStartWelcomeEdit: () => void
  handleStartNewDocument: () => void
  taggedBlocks: any[]
  customSetTaggedBlocks: (blocks: any[]) => void
  setTaggedBlocks: (blocks: any[]) => void
  showAIPanel: boolean
  setShowAIPanel: (show: boolean) => void
  aiPanelWidth: number
  isAIPanelDragging: boolean
  handleAIPanelResizeStart: (e: React.MouseEvent) => void
  isAIPanelReady: boolean
  aiMessages: any[]
  isGenerating: boolean
  isAvailable: boolean
  models: any[]
  aiSettings: any
  generateResponse: any
  abortGeneration: () => void
  clearAIHistory: () => void
  updateAISettings: (settings: any) => void
  selectedText: string
  setSelectedText: (text: string) => void
  handleApplySuggestion: any
  updateMessageDiffState: any
  handleApplyInsertSuggestion: any
  updateInsertSuggestionStatus: any
  activeBlockId: string | null
  activeRightTab: string
  setActiveRightTab: (tab: any) => void
  engineLogs: string[]
  setEngineLogs: any
  showModelHub: boolean
  setShowModelHub: (show: boolean) => void
  refreshModels: () => void
  importModel: () => void
  downloadStatus: any
  setDownloadStatus: (status: any) => void
  handleScrollToBlock: (id: string) => void
  pendingQueue: any[]
  removeFromQueue: (id: string) => void
  handleToggleRightTab: (tab: string) => void
  pipVideoId: string | null
  setPipVideoId: (id: string | null) => void
  pipPosition: { x: number; y: number }
  handlePiPMouseDown: (e: React.MouseEvent) => void
  isDiffOpen: boolean
  setIsDiffOpen: (open: boolean) => void
  selectedSnapshot: DocumentSnapshot | null
  getLineDiff: any
  handleRollback: (content: string) => void
  isSettingsOpen: boolean
  refreshMcpServers: () => void
  isAboutOpen: boolean
  isGuideOpen: boolean
  showMarketplaceModal: boolean
  showPricingModal: boolean
  exportProgress: any
  setExportProgress: any
  exportMinimized: boolean
  setExportMinimized: (min: boolean) => void
  toggleExportMinimized: () => void
  serverRunning: boolean
  serverPort: number
  setServerPort: (port: number) => void
  serverHost: string
  setServerHost: (host: string) => void
  useLocalServer: boolean
  setUseLocalServer: (use: boolean) => void
  toggleLocalServer: (port: number) => void
  collaborationLink: string
  isConnected: boolean
  snapshots: DocumentSnapshot[]
  createSnapshot: (title: string, content?: string) => void
  deleteSnapshot: (id: string) => void
  handleSelectSnapshotForDiff: (snap: DocumentSnapshot) => void
  toastMessage: string | null
  showFindReplace: boolean
  setShowFindReplace: (show: boolean) => void
  findReplaceMode: 'find' | 'replace'
  mcpServersState: any
  toggleAIPanel: () => void
}

export const AppLayout: React.FC<AppLayoutProps> = (props) => {
  const [isLogsExpanded, setIsLogsExpanded] = React.useState(false)

  const {
    settings, handleUpdateSettings, handleInstallPlugin, handleUninstallPlugin,
    handleOpenGithub, handleCloseApp, handleToggleFullscreen, handleZoomIn, handleZoomOut, handleZoomReset,
    handleOpenFile, handleSaveFile, handleSaveAsFile, handleExport, editorMode, handleSwitchMode,
    showStatusBar, setShowStatusBar, showSidebar, setShowSidebar, setIsSettingsOpen, setIsAboutOpen,
    setIsGuideOpen, setShowMarketplaceModal, setShowPricingModal, isProPlan, sidebarWidth, isSidebarReady,
    filePath, currentContent, setCurrentContent, originalContent, lastSavedTime, fileOpenMode,
    handleSwitchOpenMode, appendedFiles, handleSelectAppendedFile, tabs, activeTabId, handleSelectTab,
    handleCloseTab, chatMessages, sendChatMessage, clearChatMessages, username, userColor,
    setUserColor, setUsername, isChatFloating, setIsChatFloating, setHasChatUnread, hasChatUnread,
    handleSidebarResizeStart, isSidebarDragging, editorZoom, browserZoom, editor, peers,
    handleMouseMove, updateDragSelection, updateBlockHighlight, editorContainerRef,
    handleStartWelcomeEdit, handleStartNewDocument, taggedBlocks, customSetTaggedBlocks, setTaggedBlocks,
    showAIPanel, setShowAIPanel, aiPanelWidth, isAIPanelDragging, handleAIPanelResizeStart, isAIPanelReady,
    aiMessages, isGenerating, isAvailable, models, aiSettings, generateResponse, abortGeneration,
    clearAIHistory, updateAISettings, selectedText, setSelectedText, handleApplySuggestion,
    updateMessageDiffState, handleApplyInsertSuggestion, updateInsertSuggestionStatus, activeBlockId,
    activeRightTab, engineLogs, setEngineLogs, showModelHub, setShowModelHub, refreshModels, importModel,
    downloadStatus, setDownloadStatus, handleScrollToBlock, pendingQueue, removeFromQueue,
    handleToggleRightTab, pipVideoId, setPipVideoId, pipPosition, handlePiPMouseDown, isDiffOpen,
    setIsDiffOpen, selectedSnapshot, getLineDiff, handleRollback, isSettingsOpen, settingsInitialTab, refreshMcpServers,
    isAboutOpen, isGuideOpen, showMarketplaceModal, showPricingModal, exportProgress, setExportProgress,
    exportMinimized, setExportMinimized, toggleExportMinimized, serverRunning, serverPort, setServerPort,
    serverHost, setServerHost, useLocalServer, setUseLocalServer, toggleLocalServer, collaborationLink,
    isConnected, snapshots, createSnapshot, deleteSnapshot, handleSelectSnapshotForDiff, toastMessage,
    showFindReplace, setShowFindReplace, findReplaceMode, mcpServersState,
  } = props

  // 🌿 자연산 테마 반응형 컬러 훅 연결
  useNatureThemeColors(settings.theme)

  // 📥 글로벌 다운로드 큐 매니저 구동
  useDownloadManager()

  return (
    <div
      data-theme={settings.theme}
      style={{
        display: 'flex', flexDirection: 'column',
        width: '100vw', height: '100vh',
        backgroundColor: 'var(--bg-deep)', overflow: 'hidden',
      }}
    >
      <div className="titlebar-spacer" />

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
        isProPlan={isProPlan}
      />

      <div className="main-layout-row">
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

        <div
          style={{
            width: showSidebar ? sidebarWidth : 0,
            opacity: showSidebar ? 1 : 0,
            flexShrink: 0,
            flexGrow: 0,
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
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
                serverRunning={serverRunning}
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
            <ResizeHandle
              onMouseDown={handleSidebarResizeStart}
              isDragging={isSidebarDragging}
              placement="right"
            />
          </div>
        <div
          className="editor-zoom-wrapper"
          data-focus-region="editor"
          style={{
            zoom: editorZoom,
            height: `${100 / editorZoom}%`,
            position: 'relative',
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
          <AILogDrawer 
            isExpanded={isLogsExpanded} 
            onToggle={() => setIsLogsExpanded(!isLogsExpanded)} 
          />
        </div>

        <div
          className="ai-panel-wrapper"
          data-focus-region="ai-panel"
          style={{
            position: 'relative',
            width: showAIPanel ? aiPanelWidth : 0,
            transition: isAIPanelDragging ? 'none' : 'width 0.2s ease',
          }}
        >
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
              onSend={(msg: string, ctx?: string, orig?: string, bId?: string, runtimeSettings?: any) => {
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
              onOpenGlobalSettings={(tab) => setIsSettingsOpen(true, tab)}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)', userSelect: 'none' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>AI 엔진 및 도구 준비 중...</span>
            </div>
          )}
        </div>

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
          mcpServers={mcpServersState}
          isProPlan={isProPlan}
        />
      )}

      <FloatingPiPVideo
        pipVideoId={pipVideoId}
        pipPosition={pipPosition}
        handlePiPMouseDown={handlePiPMouseDown}
        setPipVideoId={setPipVideoId}
      />

      <ModalManager
        isDiffOpen={isDiffOpen}
        setIsDiffOpen={setIsDiffOpen}
        selectedSnapshot={selectedSnapshot}
        currentContent={currentContent}
        getLineDiff={getLineDiff}
        handleRollback={handleRollback}
        isSettingsOpen={isSettingsOpen}
        settingsInitialTab={settingsInitialTab as any}
        setIsSettingsOpen={setIsSettingsOpen as any}
        refreshMcpServers={refreshMcpServers}
        settings={settings}
        handleUpdateSettings={handleUpdateSettings}
        aiSettings={aiSettings}
        updateAISettings={updateAISettings}
        username={username}
        userColor={userColor}
        setUsername={setUsername}
        setUserColor={setUserColor}
        setShowModelHub={setShowModelHub}
        isAboutOpen={isAboutOpen}
        setIsAboutOpen={setIsAboutOpen}
        handleOpenGithub={handleOpenGithub}
        isGuideOpen={isGuideOpen}
        setIsGuideOpen={setIsGuideOpen}
        showMarketplaceModal={showMarketplaceModal}
        setShowMarketplaceModal={setShowMarketplaceModal}
        handleInstallPlugin={handleInstallPlugin}
        handleUninstallPlugin={handleUninstallPlugin}
        isProPlan={isProPlan}
        showPricingModal={showPricingModal}
        setShowPricingModal={setShowPricingModal}
        exportProgress={exportProgress}
        setExportProgress={setExportProgress}
        exportMinimized={exportMinimized}
        setExportMinimized={setExportMinimized}
        toggleExportMinimized={toggleExportMinimized}
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

      {/* 하단 글로벌 모델 다운로드 상태창 */}
      <GlobalDownloadProgress />

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
