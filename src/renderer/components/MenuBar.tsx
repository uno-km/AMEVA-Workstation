import React, { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { EditorMode } from '../../shared/types'
import type { HotkeyConfig } from './SettingsModal'
import { useMenuBarShortcuts } from '../hooks/app/useMenuBarShortcuts'

import { useAppContext } from '../contexts/AppContext'
import { useUIStore } from '../stores/useUIStore'
import * as ipc from '../services/ipc/electronApiAdapter'

export interface MenuBarProps {}

export function MenuBar({}: MenuBarProps = {}) {
  const {
    handleOpenFile: onOpenFile,
    handleSaveFile: onSaveFile,
    handleSaveAsFile: onSaveAs,
    handleExport,
    handleCloseApp: onCloseApp,
    editorMode,
    handleSwitchMode: setEditorMode,
    handleZoomIn: onZoomIn,
    handleZoomOut: onZoomOut,
    handleZoomReset: onZoomReset,
    handleToggleFullscreen: onToggleFullscreen,
    handleOpenGithub: onOpenGithub,
    settings,
    handleUpdateSettings,
    isProPlan,
  } = useAppContext()
  
  const {
    showStatusBar, setShowStatusBar,
    showSidebar, setShowSidebar,
    setIsSettingsOpen, setIsAboutOpen, setIsGuideOpen,
    setShowMarketplaceModal, setShowPricingModal
  } = useUIStore()

  const hotkeys = settings?.hotkeys
  const showConsole = settings?.showCodeConsole || false
  const setShowConsole = (val: boolean) => handleUpdateSettings({ showCodeConsole: val })
  
  const onPrint = () => handleExport('pdf')
  const onNewWindow = ipc.newWindow
  const onOpenSettings = () => setIsSettingsOpen(true)
  const onOpenAbout = () => setIsAboutOpen(true)
  const onOpenGuide = () => setIsGuideOpen(true)
  const onOpenMarketplace = () => setShowMarketplaceModal(true)
  const onOpenPricing = () => setShowPricingModal(true)
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
  const [isAltMode, setIsAltMode] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // 외부 클릭 시 드롭다운 메뉴 및 Alt 모드 해제
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
        setIsAltMode(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const triggerAction = (action?: () => void) => {
    if (action) action()
    setActiveMenu(null)
    setIsAltMode(false)
  }

  // Alt 메뉴 핫키 라우팅 커스텀 훅으로 위임 (관심사 분리)
  useMenuBarShortcuts({
    isAltMode, activeMenu, editorMode, showStatusBar, showSidebar, showConsole, isProPlan,
    setIsAltMode, setActiveMenu, triggerAction,
    onNewWindow, onOpenFile, onSaveFile, onSaveAs, onPrint, onCloseApp,
    setEditorMode, setShowStatusBar, setShowSidebar, setShowConsole,
    onZoomIn, onZoomOut, onZoomReset, onToggleFullscreen,
    onOpenSettings, onOpenMarketplace, onOpenAbout, onOpenGuide, onOpenPricing, onOpenGithub
  })

  const handleMenuClick = (menu: string) => {
    if (activeMenu === menu) {
      setActiveMenu(null)
      setIsAltMode(false)
    } else {
      setActiveMenu(menu)
      setIsAltMode(true)
    }
  }

  const renderLabel = (text: string, shortcut: string) => {
    if (!isAltMode) return <span>{text}</span>
    
    const index = text.toLowerCase().indexOf(shortcut.toLowerCase())
    if (index === -1) return <span>{text}</span>
    
    return (
      <span>
        {text.slice(0, index)}
        <u style={{ textUnderlineOffset: '3px' }}>{text[index]}</u>
        {text.slice(index + 1)}
      </span>
    )
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
    minWidth: '200px',
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
          {renderLabel('File', 'f')}
        </button>
        {activeMenu === 'file' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onNewWindow)}>
              {renderLabel('새 창 열기', 'n')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.newFile)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onOpenFile)}>
              {renderLabel('열기...', 'o')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.open)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveFile)}>
              {renderLabel('저장', 's')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.save)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onSaveAs)}>
              {renderLabel('다른 이름으로 저장...', 'a')}
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onPrint)}>
              {renderLabel('인쇄 (PDF 변환)', 'p')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.pdfExport)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={{ ...itemStyle, color: 'var(--danger)' }} onClick={() => triggerAction(onCloseApp)}>
              {renderLabel('종료', 'x')}
              <span style={shortcutStyle}>Alt+F4</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. View 메뉴 */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            ...menuStyle,
            backgroundColor: activeMenu === 'view' ? 'var(--bg-glass-active)' : 'transparent',
          }}
          onClick={() => handleMenuClick('view')}
        >
          {renderLabel('View', 'v')}
        </button>
        {activeMenu === 'view' && (
          <div style={dropdownStyle}>
            <button
              style={itemStyle}
              onClick={() => triggerAction(() => setEditorMode(editorMode === 'preview' ? 'edit' : 'preview'))}
            >
              {renderLabel(editorMode === 'preview' ? '편집 모드로 전환' : '뷰어 모드로 전환', 'e')}
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(() => setShowStatusBar(!showStatusBar))}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showStatusBar ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                {renderLabel('상태바 표시', 't')}
              </span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(() => setShowSidebar(!showSidebar))}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showSidebar ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                {renderLabel('사이드바 표시', 'b')}
              </span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(() => setShowConsole(!showConsole))}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showConsole ? <Check size={12} style={{ color: 'var(--primary)' }} /> : <span style={{ width: '12px' }} />}
                {renderLabel('코드 콘솔 표시', 'c')}
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
          {renderLabel('Window', 'w')}
        </button>
        {activeMenu === 'window' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onZoomIn)}>
              {renderLabel('확대', 'i')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomIn)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomOut)}>
              {renderLabel('축소', 'o')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomOut)}</span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onZoomReset)}>
              {renderLabel('원래 크기로', 'r')}
              <span style={shortcutStyle}>{formatHotkey(hkeys.zoomReset)}</span>
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onToggleFullscreen)}>
              {renderLabel('전체 화면 토글', 'f')}
              <span style={shortcutStyle}>F11</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Settings 메뉴 */}
      <div style={{ position: 'relative' }}>
        <button
          style={menuStyle}
          onClick={() => triggerAction(onOpenSettings)}
        >
          {renderLabel('Settings', 's')}
        </button>
      </div>

      {/* 4.5 Marketplace 메뉴 */}
      {isProPlan && (
        <div style={{ position: 'relative' }}>
          <button
            style={menuStyle}
            onClick={() => triggerAction(onOpenMarketplace)}
          >
            {renderLabel('Marketplace', 'm')}
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
          {renderLabel('Help', 'h')}
        </button>
        {activeMenu === 'help' && (
          <div style={dropdownStyle}>
            <button style={itemStyle} onClick={() => triggerAction(onOpenAbout)}>
              {renderLabel('아메바 생태계 소개...', 'a')}
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onOpenGuide)}>
              {renderLabel('마크다운 작성 가이드', 'g')}
            </button>
            <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />
            <button style={itemStyle} onClick={() => triggerAction(onOpenPricing)}>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                {renderLabel('💰 Pricing Plans...', 'p')}
              </span>
            </button>
            <button style={itemStyle} onClick={() => triggerAction(onOpenGithub)}>
              {renderLabel('문의하기 (Contact Us)...', 'c')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
