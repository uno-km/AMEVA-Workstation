import React, { useState } from 'react'
import {
  FileText, History, Users, MessageCircle, PanelLeftClose,
} from 'lucide-react'
import type { EditorMode, ExportFormat, DocumentSnapshot, PeerState } from '../../shared/types'
import type { ChatMessage } from '../hooks/useChat'
import type { HotkeyConfig } from './SettingsModal'
import { SidebarTabFiles } from './sidebar/SidebarTabFiles'
import { SidebarTabHistory } from './sidebar/SidebarTabHistory'
import { SidebarTabCollab } from './sidebar/SidebarTabCollab'
import { SidebarTabChat } from './sidebar/SidebarTabChat'

interface SidebarProps {
  filePath: string | null
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  onOpenFile: () => void
  onSaveFile: () => void
  onExport: (format: ExportFormat) => void

  // 히스토리
  snapshots: DocumentSnapshot[]
  onCreateSnapshot: (title: string) => void
  onDeleteSnapshot: (id: string) => void
  onSelectSnapshotForDiff: (snapshot: DocumentSnapshot) => void

  // 협업
  peers: PeerState[]
  serverRunning: boolean
  serverPort: number
  setServerPort: (port: number) => void
  serverHost: string
  setServerHost: (host: string) => void
  useLocalServer: boolean
  setUseLocalServer: (val: boolean) => void
  onToggleServer: () => void
  collaborationLink: string
  isConnected: boolean

  // 파일 오픈 모드 및 다중 파일 관리
  fileOpenMode: 'replace' | 'append' | 'tab'
  setFileOpenMode: (mode: 'replace' | 'append' | 'tab') => void
  appendedFiles: Array<{ id: string; filePath: string; startBlockId: string }>
  onSelectAppendedFile: (startBlockId: string) => void
  tabs: Array<{ id: string; filePath: string | null; content: string; blocks: any[] }>
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void

  // 사이드바 접기/열기 콜백
  onToggleSidebar: () => void

  // 채팅
  chatMessages: ChatMessage[]
  onChatSend: (content: string) => void
  onChatClear: () => void
  username: string
  userColor: string
  isChatFloating: boolean
  onToggleChatFloat: () => void
  hotkeys?: HotkeyConfig
}

type TabId = 'files' | 'history' | 'collab' | 'chat'

const TABS: { id: TabId; icon: React.FC<any>; label: string }[] = [
  { id: 'files',   icon: FileText,      label: '파일' },
  { id: 'history', icon: History,       label: '히스토리' },
  { id: 'collab',  icon: Users,         label: '협업' },
  { id: 'chat',    icon: MessageCircle, label: '채팅' },
]

export function Sidebar({
  filePath, editorMode, setEditorMode, onOpenFile, onSaveFile, onExport,
  snapshots, onCreateSnapshot, onDeleteSnapshot, onSelectSnapshotForDiff,
  peers, serverRunning, serverPort, setServerPort, serverHost, setServerHost,
  useLocalServer, setUseLocalServer,
  onToggleServer, collaborationLink, isConnected,
  fileOpenMode, setFileOpenMode,
  appendedFiles, onSelectAppendedFile,
  tabs, activeTabId, onSelectTab, onCloseTab,
  onToggleSidebar,
  chatMessages, onChatSend, onChatClear, username, userColor,
  isChatFloating, onToggleChatFloat,
  hotkeys,
}: SidebarProps) {
  const formatHotkey = (raw: string | undefined): string => {
    if (!raw) return ''
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' + ')
  }

  const hkeys = hotkeys || {
    save: 'Control+s',
    open: 'Control+o',
    newFile: 'Control+n',
    pdfExport: 'Control+p',
    toggleAI: 'Control+\\',
    toggleMode: 'Control+h',
    zoomIn: 'Control+=',
    zoomOut: 'Control+-',
    zoomReset: 'Control+0'
  }
  const [activeTab, setActiveTab] = useState<TabId>('files')

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
      {text}
    </div>
  )

  return (
    <aside
      className="glass-panel"
      data-focus-region="sidebar"
      style={{
        width: '100%',       /* 부모 wrapper div(usePanelResize 제어)를 채움 */
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-muted)',
        zIndex: 100,
        overflow: 'hidden',
        position: 'relative',   /* focus-region outline 표시 영역 */
        color: 'var(--text-main)',
      }}
    >
      {/* 로고 */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-muted)', flexShrink: 0 }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 900, fontSize: '14px',
          boxShadow: '0 0 12px var(--primary-glow)',
          flexShrink: 0,
        }}>A</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.3px' }}>
            AMEVA <span style={{ color: 'var(--primary)' }}>Workstation</span>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>AI-Powered Workspace</div>
        </div>

        {/* 사이드바 접기 버튼 (Inline Embedding) */}
        <button
          onClick={onToggleSidebar}
          title="사이드바 접기"
          style={{
            marginLeft: 'auto',
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-muted)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.color = 'var(--primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-muted)'
            e.currentTarget.style.color = 'var(--text-main)'
          }}
        >
          <PanelLeftClose size={13} />
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-muted)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '9px 0',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
              fontSize: '10px', fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
            {/* 채팅 뱃지 */}
            {tab.id === 'chat' && chatMessages.filter(m => m.type === 'text').length > 0 && (
              <div style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--secondary)',
                boxShadow: '0 0 6px var(--secondary-glow)',
              }} />
            )}
            {/* 협업 온라인 뱃지 */}
            {tab.id === 'collab' && serverRunning && (
              <div style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 6px rgba(16,185,129,0.6)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflowY: activeTab === 'chat' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── 파일 탭 ── */}
        {activeTab === 'files' && (
          <SidebarTabFiles
            filePath={filePath}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            onOpenFile={onOpenFile}
            onSaveFile={onSaveFile}
            onExport={onExport}
            fileOpenMode={fileOpenMode}
            setFileOpenMode={setFileOpenMode}
            appendedFiles={appendedFiles}
            onSelectAppendedFile={onSelectAppendedFile}
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            formatHotkey={formatHotkey}
            hkeys={hkeys}
            sectionLabel={sectionLabel}
          />
        )}

        {/* ── 히스토리 탭 ── */}
        {activeTab === 'history' && (
          <SidebarTabHistory
            snapshots={snapshots}
            onCreateSnapshot={onCreateSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onSelectSnapshotForDiff={onSelectSnapshotForDiff}
            sectionLabel={sectionLabel}
          />
        )}

        {/* ── 협업 탭 ── */}
        {activeTab === 'collab' && (
          <SidebarTabCollab
            peers={peers}
            serverRunning={serverRunning}
            serverPort={serverPort}
            setServerPort={setServerPort}
            serverHost={serverHost}
            setServerHost={setServerHost}
            useLocalServer={useLocalServer}
            setUseLocalServer={setUseLocalServer}
            onToggleServer={onToggleServer}
            collaborationLink={collaborationLink}
            isConnected={isConnected}
            sectionLabel={sectionLabel}
          />
        )}

        {/* ── 채팅 탭 ── */}
        {activeTab === 'chat' && (
          <SidebarTabChat
            chatMessages={chatMessages}
            onChatSend={onChatSend}
            onChatClear={onChatClear}
            username={username}
            userColor={userColor}
            isChatFloating={isChatFloating}
            onToggleChatFloat={onToggleChatFloat}
            serverRunning={serverRunning}
          />
        )}
      </div>
    </aside>
  )
}

export { SidebarTabFiles } from './sidebar/SidebarTabFiles'
export { SidebarTabHistory } from './sidebar/SidebarTabHistory'
export { SidebarTabCollab } from './sidebar/SidebarTabCollab'
export { SidebarTabChat } from './sidebar/SidebarTabChat'
