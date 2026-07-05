import React, { useState, useRef, useEffect } from 'react'
import {
  X, Settings, Sliders, ToggleLeft, ToggleRight, Monitor, Move,
  Bot, ToyBrick, User, Shield
} from 'lucide-react'

export interface AppSettings {
  showPeersPointer: boolean
  showPeersDrag: boolean
  showCodeConsole: boolean
  autoSnapshot: boolean
  theme: 'dark' | 'gray' | 'white' | 'hacker'
  wordWrap: boolean
  showMinimap: boolean
  installedPlugins?: string[]
  securityPreset?: 'paranoiac' | 'turbo' | 'restricted'
  artifactReviewPolicy?: 'always' | 'never' | 'ask'
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
  username?: string
  userColor?: string
  onUpdateUser?: (name: string, color: string) => void
  onOpenModelHub?: () => void
}

type TabType = 'General' | 'Account' | 'Permissions' | 'Appearance' | 'Models' | 'Customizations'

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  username = 'User',
  userColor = '#a855f7',
  onUpdateUser,
  onOpenModelHub,
}: SettingsModalProps) {
  if (!isOpen) return null

  // 1. 드래그 가능한 포지션 상태
  const [pos, setPos] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // 2. 활성 탭 상태 (기본 General)
  const [activeTab, setActiveTab] = useState<TabType>('General')

  // 3. 사용자 정보 폼 로컬 상태
  const [tempName, setTempName] = useState(username)
  const [tempColor, setTempColor] = useState(userColor)

  // 4. 모델 탭 스캔 상태
  const [localModels, setLocalModels] = useState<{ name: string; filename: string; path: string; size: number }[]>([])

  useEffect(() => {
    if (isOpen && window.electronAPI?.llmListModels) {
      window.electronAPI.llmListModels().then(list => {
        setLocalModels(list)
      }).catch(() => {})
    }
  }, [isOpen])

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('select')) return
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

  const handleSaveUser = () => {
    if (onUpdateUser) {
      onUpdateUser(tempName.trim(), tempColor)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return 'N/A'
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '640px',
        height: '420px',
        borderRadius: '12px',
        border: '1px solid var(--border-muted)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.65)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-main)',
        backdropFilter: 'blur(20px)',
        color: 'var(--text-main)',
        userSelect: 'none',
      }}
    >
      {/* 1. 최상단 헤더 */}
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
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
          <Settings size={15} />
          <h3 style={{ fontSize: '12.5px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            AMEVA Nexus Preferences
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* 2. 바디 영역 (좌측 탭 리스트 + 우측 디테일 창 분할) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* 좌측 사이드바 탭 */}
        <div style={{
          width: '150px',
          borderRight: '1px solid var(--border-muted)',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px',
          gap: '4px',
          flexShrink: 0,
        }}>
          {[
            { id: 'General', label: 'General', icon: Sliders },
            { id: 'Account', label: 'Account', icon: User },
            { id: 'Permissions', label: 'Permissions', icon: Shield },
            { id: 'Appearance', label: 'Appearance', icon: Monitor },
            { id: 'Models', label: 'Models', icon: Bot },
            { id: 'Customizations', label: 'Customizations', icon: ToyBrick },
          ].map(t => {
            const Icon = t.icon
            const isSelected = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '6px', border: 'none',
                  background: isSelected ? 'var(--bg-glass-active)' : 'transparent',
                  color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={13} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 우측 설정 뷰 영역 */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          
          {/* General Tab */}
          {activeTab === 'General' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>General Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700 }}>실시간 타인 포인터 표시</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>동료의 실시간 마우스 움직임을 화면에 투사합니다.</div>
                  </div>
                  <button onClick={() => onUpdateSettings({ showPeersPointer: !settings.showPeersPointer })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {settings.showPeersPointer ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700 }}>타인 텍스트 드래그 동기화</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>동료의 선택 영역 렉트 하이라이트를 실시간 표시합니다.</div>
                  </div>
                  <button onClick={() => onUpdateSettings({ showPeersDrag: !settings.showPeersDrag })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {settings.showPeersDrag ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700 }}>코드 샌드박스 콘솔 도크</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>에디터 아래에 코드 퀵 런타임 위젯을 상시 노출합니다.</div>
                  </div>
                  <button onClick={() => onUpdateSettings({ showCodeConsole: !settings.showCodeConsole })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {settings.showCodeConsole ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700 }}>줄바꿈 비활성화 (가로 스크롤)</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>텍스트 자동 줄바꿈을 풀고 가로 스크롤로 문장을 표출합니다.</div>
                  </div>
                  <button onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {!settings.wordWrap ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700 }}>에디터 우측 미니맵 표시</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>오른쪽에 전체 레이아웃 시각화 Minimap 바를 표시합니다.</div>
                  </div>
                  <button onClick={() => onUpdateSettings({ showMinimap: !settings.showMinimap })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {settings.showMinimap ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Account Tab */}
          {activeTab === 'Account' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Account Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>사용자 닉네임</label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    style={{
                      padding: '6px 10px', background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)', borderRadius: '6px',
                      color: 'var(--text-main)', fontSize: '11px', outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>나의 식별 배지 테마 컬러</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={tempColor}
                      onChange={e => setTempColor(e.target.value)}
                      style={{
                        width: '32px', height: '24px', border: 'none',
                        background: 'transparent', cursor: 'pointer',
                      }}
                    />
                    <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{tempColor}</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveUser}
                  style={{
                    alignSelf: 'flex-start', padding: '6px 14px', borderRadius: '6px',
                    background: 'var(--primary)', border: 'none', color: '#fff',
                    fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '8px',
                  }}
                >
                  프로필 저장 적용
                </button>
              </div>
            </>
          )}

          {/* Permissions Tab */}
          {activeTab === 'Permissions' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Security & Permissions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>보안 설정 모드 (Security Preset)</label>
                  <select
                    value={settings.securityPreset || 'turbo'}
                    onChange={e => onUpdateSettings({ securityPreset: e.target.value as any })}
                    style={{
                      width: '100%', background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)', borderRadius: '6px',
                      padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
                    }}
                  >
                    <option value="paranoiac">Paranoid Maximum (가장 안전 / 자동실행 금지)</option>
                    <option value="turbo">Turbo Mode (기본 성능 중심)</option>
                    <option value="restricted">Restricted Sandbox (격리 샌드박스 강제)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>아티팩트 자동 실행 허용 여부</label>
                  <select
                    value={settings.artifactReviewPolicy || 'ask'}
                    onChange={e => onUpdateSettings({ artifactReviewPolicy: e.target.value as any })}
                    style={{
                      width: '100%', background: 'var(--bg-glass)',
                      border: '1px solid var(--border-muted)', borderRadius: '6px',
                      padding: '5px 8px', color: 'var(--text-main)', fontSize: '11px',
                    }}
                  >
                    <option value="always">항상 검토 없이 바로 실행 (Always Allow)</option>
                    <option value="never">자동 실행 비활성화 (Always Block)</option>
                    <option value="ask">실행 시 확인 창 띄우기 (Always Ask)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Appearance Tab */}
          {activeTab === 'Appearance' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Appearance</h3>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  시스템 테마 스위처
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 12px', borderRadius: '6px',
                        border: settings.theme === t.id ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
                        background: settings.theme === t.id ? 'var(--bg-glass-active)' : 'rgba(255,255,255,0.01)',
                        color: settings.theme === t.id ? 'var(--primary)' : 'var(--text-main)',
                        fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        backgroundColor: t.previewColor, border: '1px solid var(--text-dark)',
                      }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Models Tab */}
          {activeTab === 'Models' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 6px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>로컬 온디바이스 모델 스캔</h3>
                <button
                  onClick={onOpenModelHub}
                  style={{
                    fontSize: '10px', color: 'var(--primary)', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0,
                  }}
                >
                  모델 허브 열기 📥
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  기본 디렉토리 <code>C:\ameva\models\llm\</code> 에서 감지된 사용 가능한 바이너리입니다.
                </span>

                {localModels.length === 0 ? (
                  <div style={{
                    padding: '24px 12px', borderRadius: '8px', textAlign: 'center',
                    background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-muted)',
                    display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
                  }}>
                    <Bot size={24} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>감지된 로컬 모델 파일이 없습니다.</span>
                    <button
                      onClick={onOpenModelHub}
                      style={{
                        padding: '4px 12px', borderRadius: '4px', background: 'var(--primary)',
                        color: '#fff', border: 'none', fontSize: '10px', fontWeight: 700,
                        cursor: 'pointer', marginTop: '4px',
                      }}
                    >
                      추천 모델 다운로드 받기
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {localModels.map(m => (
                      <div key={m.path} style={{
                        padding: '8px 12px', borderRadius: '6px',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700 }}>{m.name}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{m.filename}</span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)' }}>
                          {formatBytes(m.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Customizations Tab */}
          {activeTab === 'Customizations' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>Customizations & Extensions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  에디터의 런타임 기능 확장을 로드하거나 마켓플레이스에서 추가한 외부 플러그인을 온/오프 토글합니다.
                </span>
                
                {[
                  { id: 'outline', name: 'Outline Document Navigator', desc: 'H1~H3 문맥 개요 네비게이션 활성화' },
                  { id: 'minimap', name: 'Minimap Visual Bar', desc: '에디터 우측 전체 문서 그래픽 미니맵 로딩' },
                  { id: 'canvas', name: 'Free Drawing Canvas', desc: '자유 드로잉 및 다이어그램 스케치 삽입 플러그인' }
                ].map(p => {
                  const isInstalled = (settings.installedPlugins || []).includes(p.id)
                  return (
                    <div key={p.id} style={{
                      padding: '8px 12px', borderRadius: '6px',
                      background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700 }}>{p.name}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{p.desc}</div>
                      </div>
                      <span style={{
                        fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                        background: isInstalled ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                        color: isInstalled ? '#10b981' : 'var(--text-muted)',
                        border: isInstalled ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-muted)',
                      }}>
                        {isInstalled ? 'Loaded' : 'Inactive'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

        </div>
      </div>

      {/* 3. 최하단 푸터 */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-muted)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-primary"
          style={{ padding: '5px 16px', fontSize: '11px', borderRadius: '6px', fontWeight: 700 }}
          onClick={onClose}
        >
          적용 및 저장
        </button>
      </div>
    </div>
  )
}
