import React from 'react'
import { PanelLeft, Sparkles } from 'lucide-react'
import { Sidebar } from '../Sidebar'
import { MarkdownEditor } from '../MarkdownEditor'

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
  settings: any
  showStatusBar: boolean
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void
  sidebarWidth: number
  isSidebarReady: boolean
  editor: AppEditor | null
  editorContainerRef: React.RefObject<HTMLDivElement>
  showAIPanel: boolean
  aiPanelWidth: number
  isAIPanelDragging: boolean
  handleAIPanelResizeStart: (e: React.MouseEvent) => void
  isAIPanelReady: boolean
  showModelHub: boolean
  handleSidebarResizeStart: (e: React.MouseEvent) => void
  isSidebarDragging: boolean
  editorZoom: number
  handleMouseMove: (e: React.MouseEvent) => void
  updateDragSelection: any
  updateBlockHighlight: any
  setSelectedText: (text: string) => void
  taggedBlocks: any[]
  setTaggedBlocks: (blocks: any[]) => void
  isChatFloating: boolean
  toastMessage: string | null
  showFindReplace: boolean
  setShowFindReplace: (show: boolean) => void
  handleScrollToBlock: (id: string) => void
  findReplaceMode: 'find' | 'replace'
}

export const AppLayout: React.FC<AppLayoutProps> = (props) => {
  const [isLogsExpanded, setIsLogsExpanded] = React.useState(false)

  const {
    settings, showStatusBar, showSidebar, setShowSidebar, sidebarWidth, isSidebarReady,
    editor, editorContainerRef, showAIPanel, aiPanelWidth, isAIPanelDragging,
    handleAIPanelResizeStart, isAIPanelReady, showModelHub,
    handleSidebarResizeStart, isSidebarDragging, editorZoom,
    handleMouseMove, updateDragSelection, updateBlockHighlight, setSelectedText,
    taggedBlocks, setTaggedBlocks, isChatFloating, toastMessage, showFindReplace,
    setShowFindReplace, handleScrollToBlock, findReplaceMode
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

      <MenuBar />

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
              <Sidebar />
            ) : (
              <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-deep)', height: '100%', borderRight: '1px solid var(--border-muted)', userSelect: 'none' }}>
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
            onMouseMove={handleMouseMove}
            onSelectionChange={updateDragSelection}
            onBlockHighlight={updateBlockHighlight}
            editorContainerRef={editorContainerRef}
            onSelectedTextChange={setSelectedText}
            taggedBlocks={taggedBlocks}
            setTaggedBlocks={setTaggedBlocks}
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

        {/* [FIX-TAB-002] ai-panel-wrapper를 flex row로 변경하여 RightTabStrip이 항상 패널 바로 오른쪽에 붙어있도록 함.
             패널이 닫혀도 탭 스트립은 항상 화면 우측 끝에 표시된다. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            height: '100%',
            flexShrink: 0,
          }}
        >
          <div
            className="ai-panel-wrapper"
            data-focus-region="ai-panel"
            style={{
              position: 'relative',
              width: showAIPanel ? aiPanelWidth : 0,
              overflow: 'hidden',
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
              <AIPanel />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', padding: '20px', borderLeft: '1px solid var(--border-muted)', userSelect: 'none' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '12px' }}>AI 엔진 및 도구 준비 중...</span>
              </div>
            )}
          </div>

          <RightTabStrip />
        </div>
      </div>

      {showStatusBar && (
        <StatusBar />
      )}

      <FloatingPiPVideo />

      <ModalManager />

      {isChatFloating && (
        <FloatingChat />
      )}

      {showModelHub && (!showAIPanel || !isAIPanelReady) && (
        <AIPanel />
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
