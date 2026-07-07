import React, { useState, useEffect, useRef } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { EditorMode } from '../../shared/types'
import type { HotkeyConfig } from './SettingsModal'

interface MenuBarProps {
  onOpenFile: () => void
  onSaveFile: () => void
  onSaveAs: () => void
  onPrint: () => void
  onCloseApp: () => void
  onNewWindow: () => void

  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  showStatusBar: boolean
  setShowStatusBar: (val: boolean) => void
  showConsole: boolean
  setShowConsole: (val: boolean) => void
  showSidebar: boolean
  setShowSidebar: (val: boolean) => void

  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onToggleFullscreen: () => void

  onOpenSettings: () => void
  onOpenAbout: () => void
  onOpenGuide: () => void
  onOpenGithub: () => void
  onOpenMarketplace: () => void
  onOpenPricing?: () => void
  hotkeys?: HotkeyConfig
  isProPlan?: boolean // [BM-FREE-MODE] 유료 전용 여부
}

export function MenuBar({
  onOpenFile,
  onSaveFile,
  onSaveAs,
  onPrint,
  onCloseApp,
  onNewWindow,
  editorMode,
  setEditorMode,
  showStatusBar,
  setShowStatusBar,
  showConsole,
  setShowConsole,
  showSidebar,
  setShowSidebar,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onToggleFullscreen,
  onOpenSettings,
  onOpenAbout,
  onOpenGuide,
  onOpenGithub,
  onOpenMarketplace,
  onOpenPricing,
  hotkeys,
  isProPlan = false,
}: MenuBarProps) {
  const formatHotkey = (raw: string | undefined): string => {
    if (!raw) return ''
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join('+')
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
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // 외부 클릭 시 드롭다운 메뉴 닫기 (디테일 퀄리티)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = (menu: string) => {
    if (activeMenu === menu) {
      setActiveMenu(null)
    } else {
      setActiveMenu(menu)
    }
  }

  const triggerAction = (action?: () => void) => {
    if (action) action()
    setActiveMenu(null)
  }

  const menuStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    outline: 'none',
    transition: 'var(--transition-fast)',
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '26px',
    left: '0',
    backgroundColor: 'var(--bg-main)',
    backdropFilter: 'blur(15px)',
    border: '1px solid var(--border-glow)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    borderRadius: '6px',
    padding: '4px 0',
    minWidth: '180px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
  }

  const itemStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    fontSize: '12px',
    padding: '6px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  }

  const shortcutStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--text-dark)',
    marginLeft: '12px',
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: '28px',
        backgroundColor: 'var(--bg-deep)',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '6px',
        userSelect: 'none',
        zIndex: 998,
      }}
    >
      {/* 1. File 메뉴 */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...menuStyle,
            backgroundColor: activeMenu === 'file' ? 'var(--bg-glass-active)' : 'transparent',
          }}
          onClick={() => handleMenuClick('file')}
        >
          File
        </button>
        {activeMenu === 'file' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onNewWindow)}>
              <span>새 창 열기</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.newFile)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onOpenFile)}>
              <span>열기...</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.open)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveFile)}>
              <span>저장</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.save)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveAs)}>
              <span>다른 이름으로 저장...</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onPrint)}>
              <span>인쇄 (PDF 변환)</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.pdfExport)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={{ ...itemStyle, color: 'var(--danger)' }} onClick={() => triggerAction(onCloseApp)}>
              <span>종료</span>
              <span style={shortcutStyle}>Alt+F4</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. View 메뉴 (토글 및 모드 제어) */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...menuStyle,
            backgroundColor: activeMenu === 'view' ? 'var(--bg-glass-active)' : 'transparent',
          }}
          onClick={() => handleMenuClick('view')}
        >
          View
        </button>
        {activeMenu === 'view' && (
          <div style={dropdownStyle}>
            <button
              style={itemStyle}
              onClick={() => triggerAction(() => setEditorMode(editorMode === 'preview' ? 'edit' : 'preview'))}
            >
              <span>{editorMode === 'preview' ? '편집 모드로 전환' : '뷰어 모드로 전환'}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            {/* 상태바 체크박스 */}
            <button style={itemStyle} onClick={() => setShowStatusBar(!showStatusBar)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showStatusBar ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                상태바 표시
              </span>
            </button>
            {/* 사이드바 체크박스 */}
            <button style={itemStyle} onClick={() => setShowSidebar(!showSidebar)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showSidebar ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                사이드바 표시
              </span>
            </button>
            {/* 코드 콘솔 체크박스 */}
            <button style={itemStyle} onClick={() => setShowConsole(!showConsole)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showConsole ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                코드 콘솔 표시
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Window 메뉴 */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...menuStyle,
            backgroundColor: activeMenu === 'window' ? 'var(--bg-glass-active)' : 'transparent',
          }}
          onClick={() => handleMenuClick('window')}
        >
          Window
        </button>
        {activeMenu === 'window' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onZoomIn)}>
              <span>확대</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomIn)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomOut)}>
              <span>축소</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomOut)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomReset)}>
              <span>원래 크기로</span>
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomReset)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onToggleFullscreen)}>
              <span>전체 화면 토글</span>
              <span style={shortcutStyle}>F11</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Settings 메뉴 (단일 버튼으로 클릭 즉시 환경 설정 팝업 노출) */}
      <div style={{ position: 'relative' }}>
        <button
          style={menuStyle}
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>

      {/* 4.5 Marketplace 메뉴 (단독 버튼으로 즉시 마켓플레이스 팝업 노출 - 유료 플랜 전용) */}
      {isProPlan && (
        <div style={{ position: 'relative' }}>
          <button
            style={menuStyle}
            onClick={onOpenMarketplace}
          >
            Marketplace
          </button>
        </div>
      )}

      {/* 5. Help 메뉴 */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...menuStyle,
            backgroundColor: activeMenu === 'help' ? 'var(--bg-glass-active)' : 'transparent',
          }}
          onClick={() => handleMenuClick('help')}
        >
          Help
        </button>
        {activeMenu === 'help' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onOpenAbout)}>
              <span>아메바 생태계 소개...</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onOpenGuide)}>
              <span>마크다운 작성 가이드</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onOpenPricing)}>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>💰 Pricing Plans...</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onOpenGithub)}>
              <span>문의하기 (Contact Us)...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
