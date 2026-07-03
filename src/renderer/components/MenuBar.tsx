import React, { useState, useEffect, useRef } from 'react'
import { Check, ChevronRight } from 'lucide-react'

interface MenuBarProps {
  onOpenFile: () => void
  onSaveFile: () => void
  onSaveAs: () => void
  onPrint: () => void
  onCloseApp: () => void
  onNewWindow: () => void

  editorMode: 'edit' | 'preview'
  setEditorMode: (mode: 'edit' | 'preview') => void
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
}: MenuBarProps) {
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

  const triggerAction = (action: () => void) => {
    action()
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
              <span style={shortcutStyle}>Ctrl+N</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onOpenFile)}>
              <span>열기...</span>
              <span style={shortcutStyle}>Ctrl+O</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveFile)}>
              <span>저장</span>
              <span style={shortcutStyle}>Ctrl+S</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveAs)}>
              <span>다른 이름으로 저장...</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onPrint)}>
              <span>인쇄 (PDF 변환)</span>
              <span style={shortcutStyle}>Ctrl+P</span>
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
              onClick={() => triggerAction(() => setEditorMode(editorMode === 'edit' ? 'preview' : 'edit'))}
            >
              <span>{editorMode === 'edit' ? '뷰어 모드로 전환' : '편집 모드로 전환'}</span>
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
              <span style={shortcutStyle}>Ctrl++</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomOut)}>
              <span>축소</span>
              <span style={shortcutStyle}>Ctrl+-</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomReset)}>
              <span>원래 크기로</span>
              <span style={shortcutStyle}>Ctrl+0</span>
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
            <button style={itemStyle} onClick={() => triggerAction(onOpenGithub)}>
              <span>문의하기 (Contact Us)...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
