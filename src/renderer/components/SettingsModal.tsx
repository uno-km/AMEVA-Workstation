import React, { useState, useRef, useEffect } from 'react'
import { X, Settings, Sliders, ToggleLeft, ToggleRight, Monitor, Move } from 'lucide-react'

export interface AppSettings {
  showPeersPointer: boolean
  showPeersDrag: boolean
  showCodeConsole: boolean
  autoSnapshot: boolean
  theme: 'dark' | 'gray' | 'white' | 'hacker'
  wordWrap: boolean
  showMinimap: boolean
  installedPlugins?: string[]
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
}

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings }: SettingsModalProps) {
  if (!isOpen) return null

  // 팝업 절대 위치 상태 (Draggable 구현용)
  const [pos, setPos] = useState({ x: 100, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    // 인풋이나 버튼 드래그 시 이동 차단
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input')) return

    setIsDragging(true)
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const themes: { id: AppSettings['theme']; label: string; previewColor: string }[] = [
    { id: 'dark', label: 'Dark (Antigravity)', previewColor: '#0a0a0f' },
    { id: 'gray', label: 'Carbon Gray', previewColor: '#1e1e2e' },
    { id: 'white', label: 'Light White', previewColor: '#f3f4f6' },
    { id: 'hacker', label: 'Hacker Green', previewColor: '#000000' },
  ]

  const handleThemeChange = (theme: AppSettings['theme']) => {
    onUpdateSettings({ theme })
    document.body.setAttribute('data-theme', theme)
  }

  return (
    <div
      className="glass-panel glow-primary"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '460px',
        maxHeight: '80vh',
        borderRadius: '12px',
        border: '1px solid var(--border-glow)',
        boxShadow: '0 20px 50px rgba(139, 92, 246, 0.35)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-main)',
        backdropFilter: 'blur(15px)',
        userSelect: 'none',
      }}
    >
      {/* 헤더 (드래그 제어 탑재) */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-glass-active)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
          <Settings size={16} />
          <h3 style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-sans)' }}>
            AMEVA Nexus Preferences
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Move size={12} style={{ color: 'var(--text-dark)' }} />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 내부 스크롤 설정 목록 */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          maxHeight: '380px',
        }}
      >
        {/* 1. 테마 */}
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px',
            }}
          >
            <Monitor size={12} /> 시스템 테마 스위처
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: settings.theme === t.id ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                  background: settings.theme === t.id ? 'var(--bg-glass-active)' : 'rgba(255,255,255,0.01)',
                  color: settings.theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: t.previewColor,
                    border: '1px solid var(--text-dark)',
                  }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-muted)' }} />

        {/* 2. 기능 */}
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            <Sliders size={12} /> 기능 세부 켜기 / 끄기
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 포인터 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700 }}>실시간 타인 포인터 표시</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  동료의 실시간 마우스 움직임을 동기화 투사합니다.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ showPeersPointer: !settings.showPeersPointer })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                {settings.showPeersPointer ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>

            {/* 드래그 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700 }}>타인 텍스트 드래그 동기화</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  동료의 텍스트 선택 드래그 렉트 하이라이트를 그려줍니다.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ showPeersDrag: !settings.showPeersDrag })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                {settings.showPeersDrag ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>

            {/* 코드 러너 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700 }}>하단 코드 샌드박스 콘솔 도크</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  에디터 아래에 JS/Python 코드 퀵 런타임 위젯을 제공합니다.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ showCodeConsole: !settings.showCodeConsole })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                {settings.showCodeConsole ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>

            {/* 줄바꿈 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700 }}>줄바꿈 비활성화 (가로 스크롤 고정)</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  텍스트 줄바꿈을 해제하고 강제 가로 스크롤을 활성화합니다.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                {!settings.wordWrap ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>

            {/* 미니맵 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700 }}>에디터 우측 미니맵(Minimap) 표시</h4>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  에디터 우측 상단에 문서의 시각화 맵과 현재 스크롤 영역을 노출합니다.
                </p>
              </div>
              <button
                onClick={() => onUpdateSettings({ showMinimap: !settings.showMinimap })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
              >
                {settings.showMinimap ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-muted)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <button className="btn btn-primary" style={{ padding: '4px 14px', fontSize: '11px', borderRadius: '6px' }} onClick={onClose}>
          적용
        </button>
      </div>
    </div>
  )
}
