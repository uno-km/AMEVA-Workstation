import React, { useState, useRef, useEffect } from 'react'
import {
  X, Settings, Sliders, ToggleLeft, ToggleRight, Monitor, Move,
  Bot, ToyBrick, User, Shield, Keyboard, ShieldAlert, Key
} from 'lucide-react'
import * as ipc from '../services/ipc/electronApiAdapter'
import { useSettingsModalResize } from '../hooks/app/useSettingsModalResize'
import { SettingsTabCredentials } from './settings/SettingsTabCredentials'
import { SettingsTabMCP } from './settings/SettingsTabMCP'
import { SettingsTabHotkeys } from './settings/SettingsTabHotkeys'
import { SettingsTabGeneral } from './settings/SettingsTabGeneral'
import { SettingsTabAccount } from './settings/SettingsTabAccount'
import { SettingsTabPermissions } from './settings/SettingsTabPermissions'
import { SettingsTabAppearance } from './settings/SettingsTabAppearance'
import { SettingsTabModels } from './settings/SettingsTabModels'
import { SettingsTabCustomizations } from './settings/SettingsTabCustomizations'

export interface HotkeyConfig {
  save: string
  open: string
  newFile: string
  pdfExport: string
  toggleAI: string
  toggleMode: string
  zoomIn: string
  zoomOut: string
  zoomReset: string
}

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
  hotkeys?: HotkeyConfig
  modelPath?: string
  codeModelPath?: string
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

type TabType = 'General' | 'Account' | 'Permissions' | 'Appearance' | 'Models' | 'Customizations' | 'Hotkeys' | 'MCP' | 'Credentials'

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
  void { Move, ShieldAlert, onOpenModelHub };

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
  const [localModels, setLocalModels] = useState<import('../services/ipc/ipcTypes').ModelInfo[]>([])
  const [localCodeModels, setLocalCodeModels] = useState<import('../services/ipc/ipcTypes').ModelInfo[]>([])
  const [downloadStatus, setDownloadStatus] = useState<{ filename: string; progress: number; speed?: string } | null>(null)

  // 🦾 Pro Plan 상태 (마켓플레이스 및 MCP 노출을 제어)
  const [isProPlan, setIsProPlan] = useState<boolean>(() => {
    try {
      return localStorage.getItem('is-pro-plan') === 'true'
    } catch {
      return false
    }
  })
  const [isFreeModeLocked, setIsFreeModeLocked] = useState(false)

  const { modalSize, handleResizeMouseDown } = useSettingsModalResize()

  useEffect(() => {
    if (isOpen) {
      // Pro 플랜 설정 실시간 반영
      try {
        setIsProPlan(localStorage.getItem('is-pro-plan') === 'true')
      } catch {}

      // 시작 시 무료 플래그 상태 체크
      if (ipc.isElectronEnv()) {
        ipc.isFreeMode().then(isFree => {
          if (isFree) {
            setIsFreeModeLocked(true)
            setIsProPlan(false)
          }
        })
      }
    }
  }, [isOpen])

  const handleToggleProPlan = async () => {
    if (isFreeModeLocked) {
      alert('⚠️ 무료 모드 데모 플래그(--free)로 실행되어 요금제 강제 전환이 불가능합니다.')
      return
    }
    const nextVal = !isProPlan
    if (ipc.isElectronEnv()) {
      const result = await ipc.planSetStatus(nextVal)
      if (result && !result.success) {
        alert(`요금제 변경 실패: ${result.error}`)
        return
      }
    }
    setIsProPlan(nextVal)
    localStorage.setItem('is-pro-plan', String(nextVal))
    // 탭 선택 보정: 유료에서 무료로 전환 시 현재 MCP 탭에 있었다면 General 탭으로 대피시킴
    if (!nextVal && activeTab === 'MCP') {
      setActiveTab('General')
    }
  }

  useEffect(() => {
    if (isOpen && ipc.isElectronEnv()) {
      Promise.all([
        ipc.llmListModels('llm').catch(() => []),
        ipc.llmListModels('code').catch(() => [])
      ]).then(([llmList, codeList]) => {
        setLocalModels(llmList)
        setLocalCodeModels(codeList)
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && ipc.isElectronEnv()) {
      let lastUpdateTime = 0
      const THROTTLE_MS = 100 // 100ms 간격으로 업데이트 쓰로틀링 적용

      const unsub = ipc.onLLMDownloadProgress((status: any) => {
        const now = Date.now()
        if (status.progress === 100 || now - lastUpdateTime >= THROTTLE_MS) {
          lastUpdateTime = now
          setDownloadStatus(status)
        }
      })
      return () => {
        if (unsub) unsub()
      }
    }
  }, [isOpen])

  const startModelDownload = async (url: string, filename: string, type: 'llm' | 'code') => {
    if (!ipc.isElectronEnv()) return
    if (downloadStatus) {
      alert('이미 다운로드가 진행 중입니다.')
      return
    }
    try {
      setDownloadStatus({ filename, progress: 0 })
      const res = await ipc.llmDownloadModel({ url, filename, type })
      if (res.success) {
        alert(`${filename} 다운로드가 완료되었습니다!`)
        const list = await ipc.llmListModels('llm')
        setLocalModels(list)
        const codeList = await ipc.llmListModels('code')
        setLocalCodeModels(codeList)
      } else {
        alert(`다운로드 실패: ${res.error}`)
      }
    } catch (err: any) {
      alert(`다운로드 중 오류가 발생했습니다: ${err.message}`)
    } finally {
      setDownloadStatus(null)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('.resize-handle')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        })
      }
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
        width: `${modalSize.width}px`,
        height: `${modalSize.height}px`,
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
            AMEVA Workstation Preferences
          </h3>
          <span style={{
            fontSize: '8px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '4px',
            background: isProPlan ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: isProPlan ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: isProPlan ? '#a855f7' : 'var(--text-muted)',
            letterSpacing: '0.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            {isProPlan ? '👑 PRO PLAN' : 'FREE PLAN'}
          </span>
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
            { id: 'Credentials', label: 'Credentials', icon: Key },
            { id: 'Appearance', label: 'Appearance', icon: Monitor },
            { id: 'Models', label: 'Models', icon: Bot },
            { id: 'Customizations', label: 'Customizations', icon: ToyBrick },
            { id: 'Hotkeys', label: 'Hotkeys', icon: Keyboard },
            ...(isProPlan ? [{ id: 'MCP', label: 'MCP Manager', icon: ToyBrick }] : [])
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
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 우측 설정 내용 컨테이너 */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* General Tab */}
          <SettingsTabGeneral
            activeTab={activeTab}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            isProPlan={isProPlan}
            handleToggleProPlan={handleToggleProPlan}
          />

          {/* Account Tab */}
          <SettingsTabAccount
            activeTab={activeTab}
            tempName={tempName}
            setTempName={setTempName}
            tempColor={tempColor}
            setTempColor={setTempColor}
            handleSaveUser={handleSaveUser}
          />

          {/* Permissions Tab */}
          <SettingsTabPermissions
            activeTab={activeTab}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />

          {/* Credentials Tab */}
          <SettingsTabCredentials isOpen={isOpen} activeTab={activeTab} />

          {/* Appearance Tab */}
          <SettingsTabAppearance
            activeTab={activeTab}
            settings={settings}
            handleThemeChange={handleThemeChange}
            themes={themes}
          />

          {/* Models Tab */}
          <SettingsTabModels
            activeTab={activeTab}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            downloadStatus={downloadStatus}
            localModels={localModels}
            localCodeModels={localCodeModels}
            formatBytes={formatBytes}
            startModelDownload={startModelDownload}
          />

          {/* Customizations Tab */}
          <SettingsTabCustomizations
            activeTab={activeTab}
            settings={settings}
          />

          {/* Hotkeys Tab */}
          <SettingsTabHotkeys activeTab={activeTab} settings={settings} onUpdateSettings={onUpdateSettings} />

          {/* MCP Manager Tab (Pro Plan Only) */}
          {activeTab === 'MCP' && (
            <SettingsTabMCP isProPlan={isProPlan} isOpen={isOpen} />
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

      {/* 📐 리사이즈 핸들 레이어 */}
      {/* 우측 핸들 */}
      <div
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown('e', e)}
        style={{
          position: 'absolute', right: 0, top: 0, width: '6px', height: '100%',
          cursor: 'ew-resize', zIndex: 100
        }}
      />
      {/* 하단 핸들 */}
      <div
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown('s', e)}
        style={{
          position: 'absolute', left: 0, bottom: 0, width: '100%', height: '6px',
          cursor: 'ns-resize', zIndex: 100
        }}
      />
      {/* 우하단 모서리 (대각선) 핸들 */}
      <div
        className="resize-handle"
        onMouseDown={(e) => handleResizeMouseDown('se', e)}
        style={{
          position: 'absolute', right: 0, bottom: 0, width: '12px', height: '12px',
          cursor: 'nwse-resize', zIndex: 101,
          background: 'linear-gradient(135deg, transparent 40%, var(--primary) 60%)',
          opacity: 0.7,
          borderRadius: '0 0 12px 0'
        }}
      />
    </div>
  )
}

export { SettingsTabGeneral } from './settings/SettingsTabGeneral'
export { SettingsTabAccount } from './settings/SettingsTabAccount'
export { SettingsTabPermissions } from './settings/SettingsTabPermissions'
export { SettingsTabAppearance } from './settings/SettingsTabAppearance'
export { SettingsTabModels } from './settings/SettingsTabModels'
export { SettingsTabCustomizations } from './settings/SettingsTabCustomizations'
