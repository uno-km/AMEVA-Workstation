import React, { useState } from 'react'
import {
  FileText, Save, Download, History, Users, Share2,
  Plus, Trash2, RefreshCw, Eye, Terminal,
  MessageCircle, Sparkles, ChevronDown, ChevronRight,
  Wifi, WifiOff, Server,
} from 'lucide-react'
import type { EditorMode, ExportFormat, DocumentSnapshot, PeerState } from '../../shared/types'
import type { ChatMessage } from '../hooks/useChat'
import { ChatPanel } from './ChatPanel'

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

  // AI 패널 토글
  showAIPanel: boolean
  onToggleAI: () => void

  // 채팅
  chatMessages: ChatMessage[]
  onChatSend: (content: string) => void
  onChatClear: () => void
  username: string
  userColor: string
}

type TabId = 'files' | 'history' | 'collab' | 'chat'

const TABS: { id: TabId; icon: React.FC<any>; label: string }[] = [
  { id: 'files',   icon: FileText,      label: '파일' },
  { id: 'history', icon: History,       label: '히스토리' },
  { id: 'collab',  icon: Users,         label: '협업' },
  { id: 'chat',    icon: MessageCircle, label: '채팅' },
]

const EXPORT_FORMATS: { format: ExportFormat; label: string; color?: string }[] = [
  { format: 'md',   label: 'Markdown (.md)' },
  { format: 'html', label: 'HTML' },
  { format: 'pdf',  label: 'PDF' },
  { format: 'docx', label: 'Word (DOCX)' },
  { format: 'xlsx', label: 'Excel (XLSX)' },
  { format: 'pptx', label: 'PPT (PPTX)' },
  { format: 'hwpx', label: '한글 (HWPX)', color: 'rgba(167,139,250,0.5)' },
  { format: 'xml',  label: 'XML' },
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
  showAIPanel, onToggleAI,
  chatMessages, onChatSend, onChatClear, username, userColor,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('files')
  const [snapTitle, setSnapTitle] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  const handleExportClick = (format: ExportFormat) => {
    onExport(format)
    // confetti는 App.tsx에서 실제 저장 성공 후에만 실행됨
  }

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

        {/* AI 토글 버튼 */}
        <button
          onClick={onToggleAI}
          title="AI 패널 토글"
          style={{
            marginLeft: 'auto',
            width: '28px', height: '28px', borderRadius: '7px',
            background: showAIPanel ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--bg-glass)',
            border: `1px solid ${showAIPanel ? 'var(--primary)' : 'var(--border-muted)'}`,
            color: showAIPanel ? '#fff' : 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: showAIPanel ? '0 0 10px var(--primary-glow)' : 'none',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          <Sparkles size={13} />
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
          <div
            data-focus-region="sidebar-files"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, position: 'relative' }}
          >
            {/* 편집/뷰어 모드 */}
            <div>
              {sectionLabel('에디터 모드')}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn btn-glass ${editorMode === 'edit' ? 'active' : ''}`}
                  style={{ flex: 1, fontSize: '12px', padding: '7px 10px' }}
                  onClick={() => setEditorMode('edit')}
                >
                  <Terminal size={13} /> 편집
                </button>
                <button
                  className={`btn btn-glass ${editorMode === 'preview' ? 'active' : ''}`}
                  style={{ flex: 1, fontSize: '12px', padding: '7px 10px' }}
                  onClick={() => setEditorMode('preview')}
                >
                  <Eye size={13} /> 미리보기
                </button>
              </div>
            </div>

            {/* 파일 관리 */}
            <div>
              {sectionLabel('파일 관리')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button className="btn btn-glass" style={{ justifyContent: 'flex-start', fontSize: '13px' }} onClick={onOpenFile}>
                  <FileText size={14} /> 파일 열기...
                </button>
                <button className="btn btn-primary" style={{ justifyContent: 'flex-start', fontSize: '13px' }} onClick={onSaveFile}>
                  <Save size={14} /> 저장 (Ctrl+S)
                </button>
                {filePath && (
                  <div style={{
                    padding: '6px 8px', borderRadius: '6px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    fontSize: '10px', color: 'var(--text-muted)', wordBreak: 'break-all',
                  }}>
                    📄 {filePath.split(/[\\/]/).pop()}
                  </div>
                )}
              </div>
            </div>

            {/* 파일 열기 모드 */}
            <div>
              {sectionLabel('파일 열기 모드')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  <input
                    type="radio"
                    name="fileOpenMode"
                    checked={fileOpenMode === 'replace'}
                    onChange={() => setFileOpenMode('replace')}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ color: fileOpenMode === 'replace' ? 'var(--text-main)' : 'var(--text-muted)' }}>덮어쓰기 (기본)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  <input
                    type="radio"
                    name="fileOpenMode"
                    checked={fileOpenMode === 'append'}
                    onChange={() => setFileOpenMode('append')}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ color: fileOpenMode === 'append' ? 'var(--text-main)' : 'var(--text-muted)' }}>이어서 열기 (본문 추가)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  <input
                    type="radio"
                    name="fileOpenMode"
                    checked={fileOpenMode === 'tab'}
                    onChange={() => setFileOpenMode('tab')}
                    style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ color: fileOpenMode === 'tab' ? 'var(--text-main)' : 'var(--text-muted)' }}>탭별 열기 (다중 탭)</span>
                </label>
              </div>
            </div>

            {/* 열린 파일 목록 */}
            {((fileOpenMode === 'append' && appendedFiles.length > 0) || (fileOpenMode === 'tab' && tabs.length > 0)) && (
              <div>
                {sectionLabel('열린 파일 목록')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {fileOpenMode === 'append' && appendedFiles.map((file, idx) => (
                    <button
                      key={file.id}
                      onClick={() => onSelectAppendedFile(file.startBlockId)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        width: '100%', padding: '6px 8px', borderRadius: '6px',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                        color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer',
                        textAlign: 'left', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)'
                        e.currentTarget.style.backgroundColor = 'var(--bg-glass-active)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-muted)'
                        e.currentTarget.style.backgroundColor = 'var(--bg-glass)'
                      }}
                    >
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>#{idx + 1}</span>
                      <span>{file.filePath}</span>
                    </button>
                  ))}

                  {fileOpenMode === 'tab' && tabs.map((tab, idx) => {
                    const isActive = activeTabId === tab.id
                    return (
                      <div
                        key={tab.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                          width: '100%', padding: '5px 8px', borderRadius: '6px',
                          background: isActive ? 'var(--bg-glass-active)' : 'var(--bg-glass)',
                          border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-muted)'}`,
                          transition: 'all 0.15s'
                        }}
                      >
                        <button
                          onClick={() => onSelectTab(tab.id)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'transparent', border: 'none',
                            color: isActive ? 'var(--primary)' : 'var(--text-main)',
                            fontSize: '11px', cursor: 'pointer', textAlign: 'left',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', padding: 0
                          }}
                        >
                          <span style={{ fontWeight: 'bold' }}>T{idx + 1}</span>
                          <span>{tab.filePath ? tab.filePath.split(/[\\/]/).pop() : '무제 문서'}</span>
                        </button>
                        <button
                          onClick={() => onCloseTab(tab.id)}
                          style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '2px', borderRadius: '4px', transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--danger)'
                            e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)'
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 내보내기 */}
            <div>
              {sectionLabel('내보내기')}
              <button
                onClick={() => setExportOpen(!exportOpen)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                  marginBottom: exportOpen ? '6px' : '0',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={13} /> 포맷 변환...
                </span>
                {exportOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {exportOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {EXPORT_FORMATS.map(({ format, label, color }) => (
                    <button
                      key={format}
                      className="btn btn-glass"
                      style={{
                        justifyContent: 'flex-start', fontSize: '12px', padding: '7px 12px',
                        borderColor: color || undefined,
                      }}
                      onClick={() => handleExportClick(format)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 히스토리 탭 ── */}
        {activeTab === 'history' && (
          <div
            data-focus-region="sidebar-history"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, position: 'relative' }}
          >
            {sectionLabel('스냅샷 저장')}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="버전 제목 입력..."
                value={snapTitle}
                onChange={e => setSnapTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && snapTitle.trim()) {
                    onCreateSnapshot(snapTitle)
                    setSnapTitle('')
                  }
                }}
                style={{
                  flex: 1, background: 'var(--bg-glass)',
                  border: '1px solid var(--border-muted)', borderRadius: '6px',
                  padding: '6px 10px', color: 'var(--text-main)', outline: 'none', fontSize: '12px',
                }}
              />
              <button
                className="btn btn-glass"
                style={{ padding: '6px 10px', flexShrink: 0 }}
                onClick={() => {
                  if (snapTitle.trim()) {
                    onCreateSnapshot(snapTitle)
                    setSnapTitle('')
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            {sectionLabel(`타임라인 (${snapshots.length}개)`)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {snapshots.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>
                  저장된 스냅샷이 없습니다.<br />
                  <span style={{ fontSize: '10px' }}>3분마다 자동 저장됩니다.</span>
                </div>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="glass-panel"
                    style={{ padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{
                        fontWeight: 600, fontSize: '12px', color: 'var(--primary)',
                        maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {snap.title}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => onSelectSnapshotForDiff(snap)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '2px' }}
                          title="비교 및 롤백"
                        >
                          <RefreshCw size={11} />
                        </button>
                        <button
                          onClick={() => onDeleteSnapshot(snap.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                          title="삭제"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(snap.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 협업 탭 ── */}
        {activeTab === 'collab' && (
          <div
            data-focus-region="sidebar-collab"
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, position: 'relative' }}
          >
            {sectionLabel('로컬 협업 서버')}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* 포트 설정 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '38px' }}>포트</span>
                <input
                  type="number"
                  value={serverPort}
                  disabled={serverRunning}
                  onChange={e => setServerPort(Number(e.target.value))}
                  style={{
                    width: '80px', background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)', borderRadius: '6px',
                    padding: '4px 8px', color: 'var(--text-main)', fontSize: '12px',
                  }}
                />
              </div>

              {/* 호스트 설정 (접속 호스트 주소 입력 — 언제나 노출) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '38px' }}>호스트</span>
                <input
                  type="text"
                  value={serverHost}
                  disabled={serverRunning}
                  onChange={e => {
                    // 한글 오타 및 불필요 문자 차단 (영문, 숫자, 마침표, 콜론, 슬래시 등만 허용)
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9.:/_-]/g, '')
                    setServerHost(cleaned)
                  }}
                  style={{
                    width: '120px', background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)', borderRadius: '6px',
                    padding: '4px 8px', color: 'var(--text-main)', fontSize: '12px',
                  }}
                />
              </div>

              {/* 로컬 서버 옵션 */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={useLocalServer}
                  onChange={e => setUseLocalServer(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <span style={{ color: 'var(--text-main)' }}>내 PC를 서버로 만들기</span>
              </label>

              {/* 서버 제어 버튼 */}
              <button
                className={`btn ${serverRunning ? 'btn-secondary' : 'btn-primary'}`}
                onClick={onToggleServer}
                style={{ fontSize: '13px' }}
              >
                <Share2 size={14} /> {serverRunning ? '협업 서버 중지' : '협업 서버 시작'}
              </button>

              {/* 상태 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: serverRunning ? 'var(--success)' : 'var(--danger)',
                  boxShadow: serverRunning ? '0 0 8px rgba(16,185,129,0.6)' : 'none',
                }} />
                <span>
                  서버: {serverRunning ? '실행 중' : '중지됨'}
                  {serverRunning && isConnected && <span style={{ color: 'var(--success)', marginLeft: '4px' }}>· 연결됨</span>}
                </span>
              </div>

              {serverRunning && collaborationLink && (
                <div style={{
                  padding: '8px 10px', borderRadius: '6px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-muted)',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--secondary)', fontWeight: 600, marginBottom: '4px' }}>연결 주소</div>
                  <code style={{ fontSize: '11px', color: 'var(--text-main)', wordBreak: 'break-all' }}>{collaborationLink}</code>
                </div>
              )}
            </div>

            {/* 접속 중인 피어 목록 */}
            {sectionLabel(`접속 중인 피어 (${peers.length}명)`)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {peers.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0', opacity: 0.6 }}>
                  현재 연결된 피어가 없습니다.
                </div>
              ) : (
                peers.map((peer) => (
                  <div
                    key={peer.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '6px',
                      background: 'var(--bg-glass)',
                      borderLeft: `3px solid ${peer.color}`,
                    }}
                  >
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      backgroundColor: peer.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 800, color: '#fff', flexShrink: 0,
                    }}>
                      {peer.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{peer.name}</span>
                    <div style={{
                      marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: 'var(--success)', boxShadow: '0 0 6px rgba(16,185,129,0.6)',
                    }} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 채팅 탭 ── */}
        {activeTab === 'chat' && (
          <div
            data-focus-region="sidebar-chat"
            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            <ChatPanel
              messages={chatMessages}
              onSend={onChatSend}
              onClear={onChatClear}
              username={username}
              userColor={userColor}
              serverRunning={serverRunning}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
