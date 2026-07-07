import React from 'react'
import type { AppSettings, HotkeyConfig } from '../SettingsModal'

interface SettingsTabHotkeysProps {
  activeTab: string
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
}

export function SettingsTabHotkeys({ activeTab, settings, onUpdateSettings }: SettingsTabHotkeysProps) {
  if (activeTab !== 'Hotkeys') return null

  const formatHotkeyForUI = (raw: string): string => {
    if (!raw) return '지정 안 됨'
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' + ')
  }

  const handleRecordHotkey = (key: keyof HotkeyConfig, e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const activeKeys: string[] = []
    if (e.ctrlKey || e.metaKey) activeKeys.push('Control')
    if (e.shiftKey) activeKeys.push('Shift')
    if (e.altKey) activeKeys.push('Alt')
    
    const isModifier = ['control', 'shift', 'alt', 'meta'].includes(e.key.toLowerCase())
    if (!isModifier) {
      // 키패드나 특수 키 보정
      let normalizedKey = e.key
      if (e.key === ' ') normalizedKey = 'Space'
      
      activeKeys.push(normalizedKey)
      const hotkeyStr = activeKeys.join('+')
      
      const currentHotkeys = settings.hotkeys || {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }
      
      onUpdateSettings({
        hotkeys: {
          ...currentHotkeys,
          [key]: hotkeyStr
        }
      })
    }
  }

  const handleResetHotkeys = () => {
    onUpdateSettings({
      hotkeys: {
        save: 'Control+s',
        open: 'Control+o',
        newFile: 'Control+n',
        pdfExport: 'Control+p',
        toggleAI: 'Control+\\',
        toggleMode: 'Control+e',
        zoomIn: 'Control+=',
        zoomOut: 'Control+-',
        zoomReset: 'Control+0'
      }
    })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 4px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>사용자 정의 단축키 설정</h3>
        <button
          onClick={handleResetHotkeys}
          style={{
            fontSize: '10px', color: 'var(--primary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0,
          }}
        >
          기본값 복원 🔄
        </button>
      </div>
      <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        입력 필드를 클릭하고 원하는 단축키 조합을 키보드로 누르면 자동으로 녹화됩니다.
      </div>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '260px',
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {[
          { key: 'save', label: '문서 저장' },
          { key: 'open', label: '문서 열기' },
          { key: 'newFile', label: '새 창 / 새 탭 생성' },
          { key: 'pdfExport', label: 'PDF 내보내기' },
          { key: 'toggleAI', label: 'AI 어시스턴트 토글' },
          { key: 'toggleMode', label: '편집 / 미리보기 모드 전환' },
          { key: 'zoomIn', label: '화면 확대 (Zoom In)' },
          { key: 'zoomOut', label: '화면 축소 (Zoom Out)' },
          { key: 'zoomReset', label: '화면 확대/축소 초기화' },
        ].map(item => {
          const currentHotkeys = settings.hotkeys || {
            save: 'Control+s',
            open: 'Control+o',
            newFile: 'Control+n',
            pdfExport: 'Control+p',
            toggleAI: 'Control+\\',
            toggleMode: 'Control+e',
            zoomIn: 'Control+=',
            zoomOut: 'Control+-',
            zoomReset: 'Control+0'
          }
          const rawVal = currentHotkeys[item.key as keyof HotkeyConfig] || ''
          return (
            <div key={item.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 10px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-muted)',
              borderRadius: '6px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.label}</span>
              <input
                type="text"
                readOnly
                value={formatHotkeyForUI(rawVal)}
                placeholder="보조키 + 일반키"
                onKeyDown={(e) => handleRecordHotkey(item.key as keyof HotkeyConfig, e)}
                style={{
                  width: '160px',
                  padding: '4px 8px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '4px',
                  color: 'var(--primary)',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
