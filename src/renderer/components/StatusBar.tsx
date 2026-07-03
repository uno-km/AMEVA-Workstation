import React from 'react'
import { Settings, ZoomIn, Info, Check, WrapText } from 'lucide-react'
import type { PeerState } from '../../shared/types'

interface StatusBarProps {
  filePath: string | null
  currentContent: string
  zoomLevel: number
  browserZoom?: number   // webFrame 사이드바 줌 (1.0 = 100%)
  peers: PeerState[]
  serverRunning: boolean
  wordWrap: boolean
  onToggleWordWrap: () => void
  onOpenSettings: () => void
}

export function StatusBar({
  filePath,
  currentContent,
  zoomLevel,
  browserZoom = 1.0,
  peers,
  serverRunning,
  wordWrap,
  onToggleWordWrap,
  onOpenSettings,
}: StatusBarProps) {
  // 글자 수, 단어 수, 줄 수 계산
  const charCount = currentContent.length
  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0
  const lineCount = currentContent ? currentContent.split('\n').length : 0
  
  // zoomLevel은 이제 CSS zoom 배율 (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
  const zoomPercent = Math.round(zoomLevel * 100)

  return (
    <div
      className="glass-panel"
      style={{
        height: '28px',
        width: '100%',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        backgroundColor: 'rgba(5, 5, 10, 0.5)',
        zIndex: 101,
        userSelect: 'none',
      }}
    >
      {/* 1. 파일 상태 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Info size={12} style={{ color: 'var(--primary)' }} />
          <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '260px' }}>
            {filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}
          </span>
        </div>
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Check size={10} style={{ color: 'var(--success)' }} /> 저장됨
        </span>
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
        <span>
          줄 수: <strong>{lineCount}</strong>줄 | 공백 포함: <strong>{charCount}</strong>자 | 단어: <strong>{wordCount}</strong>개
        </span>
      </div>

      {/* 2. 우측 제어 및 단축키 안내 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* 협업 상태 및 피어 아바타 목록 */}
        {serverRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--success)',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span style={{ color: 'var(--success)' }}>
              협업 ({peers.length + 1}명)
            </span>
            {/* 아바타 목록 시각화 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: peer.color,
                    color: '#ffffff',
                    fontSize: '8px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'help',
                  }}
                  title={`${peer.name} (접속 중)`}
                >
                  {peer.name.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        )}

        {serverRunning && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* 상하좌우 고정 기능 (줄바꿈 방지 토글) */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            color: !wordWrap ? 'var(--secondary)' : 'var(--text-muted)',
            fontWeight: !wordWrap ? 600 : 400,
            transition: 'var(--transition-fast)',
          }}
          title="줄바꿈을 끄고 본문을 한 줄로 길게 보이며 가로 스크롤을 활성화합니다."
        >
          <input
            type="checkbox"
            checked={!wordWrap}
            onChange={onToggleWordWrap}
            style={{ cursor: 'pointer', accentColor: 'var(--secondary)' }}
          />
          <WrapText size={12} />
          <span>줄바꿈 비활성화 (가로 스크롤)</span>
        </label>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 줌 배율 — 문서(CSS zoom) + UI(브라우저 zoom) 분리 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ZoomIn size={12} />
          <span>
            문서: <strong>{zoomPercent}%</strong>
            {browserZoom !== 1.0 && (
              <span style={{ color: 'var(--secondary)', marginLeft: '6px' }}>
                UI: <strong>{Math.round(browserZoom * 100)}%</strong>
              </span>
            )}
          </span>
        </div>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 환경 설정 버튼 */}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'var(--transition-fast)',
          }}
          title="환경 설정"
        >
          <Settings size={12} style={{ color: 'var(--primary)' }} />
          <span>설정</span>
        </button>
      </div>
    </div>
  )
}
