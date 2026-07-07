import React from 'react'
import { Server, Share2 } from 'lucide-react'
import type { PeerState } from '../../../shared/types'

export interface SidebarTabCollabProps {
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
  sectionLabel: (text: string) => React.ReactNode
}

export function SidebarTabCollab({
  peers, serverRunning, serverPort, setServerPort, serverHost, setServerHost,
  useLocalServer, setUseLocalServer, onToggleServer, collaborationLink, isConnected,
  sectionLabel,
}: SidebarTabCollabProps) {
  return (
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
  )
}
