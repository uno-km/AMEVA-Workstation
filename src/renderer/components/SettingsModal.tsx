import React, { useState, useRef, useEffect } from 'react'
import {
  X, Settings, Sliders, ToggleLeft, ToggleRight, Monitor, Move,
  Bot, ToyBrick, User, Shield, Keyboard, Plus, Trash2, ShieldAlert, Key
} from 'lucide-react'
import { MCPClientManager } from '../utils/mcpClient' // [FIX-MCP-UI] MCP 설정 연동

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

  // 🔐 자격 증명(API Keys) 존재 여부 상태
  const [credStatus, setCredStatus] = useState<Record<string, boolean>>({
    gemini: false,
    openai: false,
    claude: false,
    github: false,
  })

  // 신규 키 등록 입력 폼 임시 상태
  const [newKeyInput, setNewKeyInput] = useState<Record<string, string>>({
    gemini: '',
    openai: '',
    claude: '',
    github: '',
  })

  // 자격 증명 로드 함수
  const loadCredentials = async () => {
    if (!window.electronAPI) return
    
    // 비동기로 각 키가 존재하는지 복호화 테스트를 통해 검사
    const geminiVal = await window.electronAPI.keychainGet?.('gemini-api-key')
    const openaiVal = await window.electronAPI.keychainGet?.('openai-api-key')
    const claudeVal = await window.electronAPI.keychainGet?.('claude-api-key')
    const githubVal = await window.electronAPI.keychainGet?.('github-token')

    setCredStatus({
      gemini: !!geminiVal,
      openai: !!openaiVal,
      claude: !!claudeVal,
      github: !!githubVal,
    })
  }

  // 모달이 열릴 때 혹은 Credentials 탭으로 바뀔 때 데이터 로드
  useEffect(() => {
    if (isOpen && activeTab === 'Credentials') {
      loadCredentials()
    }
  }, [isOpen, activeTab])

  // 키 저장 핸들러
  const handleSaveCredential = async (service: string, keychainKey: string) => {
    const value = newKeyInput[service]
    if (!value || !value.trim()) return
    if (!window.electronAPI) return

    const res = await window.electronAPI.keychainSet?.(keychainKey, value.trim())
    if (res && res.success) {
      setNewKeyInput(prev => ({ ...prev, [service]: '' }))
      loadCredentials()
    } else {
      alert(`키 저장 실패: ${res?.error || '알 수 없는 오류'}`)
    }
  }

  // 키 삭제 핸들러
  const handleClearCredential = async (service: string, keychainKey: string) => {
    if (!window.electronAPI || !window.electronAPI.keychainDelete) return
    if (!confirm('해당 자격 증명을 영구히 삭제하시겠습니까?')) return

    await window.electronAPI.keychainDelete(keychainKey)
    loadCredentials()
  }

  // 📐 모달 크기 조절 상태 (기본 820px x 580px)
  const [modalSize, setModalSize] = useState({ width: 820, height: 580 })
  const isResizing = useRef<string | null>(null) // 'e' | 's' | 'se'
  const resizeStart = useRef({ x: 0, y: 0, width: 820, height: 580 })

  const handleResizeMouseDown = (dir: 'e' | 's' | 'se', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const startX = e.clientX
    const startY = e.clientY
    const startW = modalSize.width
    const startH = modalSize.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      let nextW = startW
      let nextH = startH

      if (dir.includes('e')) {
        nextW = Math.max(500, startW + deltaX)
      }
      if (dir.includes('s')) {
        nextH = Math.max(380, startH + deltaY)
      }

      setModalSize({ width: nextW, height: nextH })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 🤖 MCP 설정 관리 로컬 상태
  const [mcpServers, setMcpServers] = useState<any[]>([])
  const [newMcpName, setNewMcpName] = useState('')
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'http'>('http')
  const [newMcpUrl, setNewMcpUrl] = useState('')
  const [newMcpCmd, setNewMcpCmd] = useState('')
  const [newMcpArgs, setNewMcpArgs] = useState('')
  
  const [mcpTools, setMcpTools] = useState<any[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)

  const refreshMcpTools = async () => {
    setIsLoadingTools(true)
    try {
      const tools = await MCPClientManager.fetchAllTools()
      setMcpTools(tools)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingTools(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      const configs = MCPClientManager.loadConfigs()
      setMcpServers(configs)
      refreshMcpTools()
      
      // Pro 플랜 설정 실시간 반영
      try {
        setIsProPlan(localStorage.getItem('is-pro-plan') === 'true')
      } catch {}

      // 시작 시 무료 플래그 상태 체크
      if (window.electronAPI?.isFreeMode) {
        window.electronAPI.isFreeMode().then(isFree => {
          if (isFree) {
            setIsFreeModeLocked(true)
            setIsProPlan(false)
          }
        })
      }
    }
  }, [isOpen])

  const handleAddMcp = () => {
    if (!newMcpName.trim()) return alert('서버 이름을 입력해 주세요.')
    
    const newServer: any = {
      id: `mcp-${Date.now()}`,
      name: newMcpName.trim(),
      type: newMcpType,
      enabled: true
    }

    if (newMcpType === 'http') {
      if (!newMcpUrl.trim()) return alert('URL을 입력해 주세요.')
      newServer.url = newMcpUrl.trim()
    } else {
      if (!newMcpCmd.trim()) return alert('실행 명령어를 입력해 주세요.')
      newServer.command = newMcpCmd.trim()
      newServer.args = newMcpArgs.trim() ? newMcpArgs.split(/\s+/) : []
    }

    const updated = [...mcpServers, newServer]
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    
    setNewMcpName('')
    setNewMcpUrl('')
    setNewMcpCmd('')
    setNewMcpArgs('')

    setTimeout(() => refreshMcpTools(), 200)
  }

  const handleToggleMcp = (id: string) => {
    const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    setTimeout(() => refreshMcpTools(), 200)
  }

  const handleDeleteMcp = async (id: string) => {
    const updated = mcpServers.filter(s => s.id !== id)
    if (window.electronAPI) {
      await window.electronAPI.mcpKill?.(id)
    }
    MCPClientManager.setConfigs(updated)
    setMcpServers(updated)
    setTimeout(() => refreshMcpTools(), 200)
  }

  const handleToggleProPlan = async () => {
    if (isFreeModeLocked) {
      alert('⚠️ 무료 모드 데모 플래그(--free)로 실행되어 요금제 강제 전환이 불가능합니다.')
      return
    }
    const nextVal = !isProPlan
    if (window.electronAPI?.planSetStatus) {
      const result = await window.electronAPI.planSetStatus(nextVal)
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
    if (isOpen && window.electronAPI?.llmListModels) {
      Promise.all([
        window.electronAPI.llmListModels('llm').catch(() => []),
        window.electronAPI.llmListModels('code').catch(() => [])
      ]).then(([llmList, codeList]) => {
        setLocalModels(llmList)
        setLocalCodeModels(codeList)
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && window.electronAPI?.onLLMDownloadProgress) {
      let lastUpdateTime = 0
      const THROTTLE_MS = 100 // 100ms 간격으로 업데이트 쓰로틀링 적용

      const unsub = window.electronAPI.onLLMDownloadProgress((status: any) => {
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
    if (!window.electronAPI?.llmDownloadModel) return
    if (downloadStatus) {
      alert('이미 다운로드가 진행 중입니다.')
      return
    }
    try {
      setDownloadStatus({ filename, progress: 0 })
      const res = await window.electronAPI.llmDownloadModel({ url, filename, type })
      if (res.success) {
        alert(`${filename} 다운로드가 완료되었습니다!`)
        if (window.electronAPI.llmListModels) {
          const list = await window.electronAPI.llmListModels('llm')
          setLocalModels(list)
          const codeList = await window.electronAPI.llmListModels('code')
          setLocalCodeModels(codeList)
        }
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

                <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(168, 85, 247, 0.05)',
                  border: '1px dashed rgba(168, 85, 247, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>👑 AMEVA Pro 플랜 활성화</div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      유료 기능을 활성화합니다. 마켓플레이스 접근 및 외부 MCP 서버(Stdio/HTTP) 매니저 탭이 개방됩니다.
                    </div>
                  </div>
                  <button onClick={handleToggleProPlan} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    {isProPlan ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
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

          {/* Credentials Tab */}
          {activeTab === 'Credentials' && (
            <>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>API Keys & Credentials</h3>
              <p style={{ fontSize: '9.5px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: '1.4' }}>
                외부 AI 서비스 및 플랫폼 연동을 위한 API Key들을 데스크톱 환경의 <strong>OS 자격 증명 관리자(Keychain / safeStorage)</strong>에 안전하게 암호화하여 위임 보관합니다. 등록된 비밀키는 화면에 노출되지 않습니다.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { id: 'gemini', keyName: 'gemini-api-key', label: 'Google Gemini API Key', placeholder: 'AQ.Ab8... 또는 AIzaSy...' },
                  { id: 'openai', keyName: 'openai-api-key', label: 'OpenAI API Key', placeholder: 'sk-...' },
                  { id: 'claude', keyName: 'claude-api-key', label: 'Anthropic Claude API Key', placeholder: 'sk-ant-...' },
                  { id: 'github', keyName: 'github-token', label: 'GitHub Personal Access Token', placeholder: 'ghp_... 또는 github_pat_...' },
                ].map(cred => {
                  const isRegistered = credStatus[cred.id]
                  return (
                    <div key={cred.id} style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{cred.label}</span>
                        {isRegistered ? (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                          }}>
                            ●●●●●●●● 등록됨 (OS 암호화 보관 중)
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                          }}>
                            미등록
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="password"
                          value={newKeyInput[cred.id]}
                          onChange={e => setNewKeyInput(prev => ({ ...prev, [cred.id]: e.target.value }))}
                          placeholder={isRegistered ? "새로운 키로 덮어쓰려면 여기에 입력하세요" : cred.placeholder}
                          style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            border: '1px solid var(--border-muted)',
                            borderRadius: '6px',
                            padding: '5px 8px',
                            color: 'var(--text-main)',
                            fontSize: '11px',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleSaveCredential(cred.id, cred.keyName)}
                          disabled={!newKeyInput[cred.id]?.trim()}
                          style={{
                            padding: '5px 12px',
                            background: newKeyInput[cred.id]?.trim() ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: newKeyInput[cred.id]?.trim() ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: newKeyInput[cred.id]?.trim() ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s',
                          }}
                        >
                          등록
                        </button>
                        {isRegistered && (
                          <button
                            onClick={() => handleClearCredential(cred.id, cred.keyName)}
                            style={{
                              padding: '5px 10px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', overflowY: 'auto', paddingRight: '4px' }}>
              
              {/* 다운로드 진행률 Toast 바 (모달 내부 노출) */}
              {downloadStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                    <span>📥 모델 다운로드 중: {downloadStatus.filename}</span>
                    <span>{downloadStatus.progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${downloadStatus.progress}%`, height: '100%',
                      background: 'linear-gradient(90deg, var(--primary) 0%, #a78bfa 100%)',
                      transition: 'width 0.2s ease-out'
                    }} />
                  </div>
                  {downloadStatus.speed && (
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>속도: {downloadStatus.speed}</span>
                  )}
                </div>
              )}

              {/* 2열 레이아웃 */}
              <div style={{ display: 'flex', gap: '16px' }}>
                
                {/* 1열: 일반 대화형 모델 (LLM) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                  <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px' }}>
                    <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>💬 일반 대화형 LLM 모델</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>C:\ameva\models\llm</span>
                  </div>

                  {/* 활성 모델 선택기 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>기본 대화 모델 활성화</label>
                    <select
                      value={settings.modelPath || ''}
                      onChange={(e) => onUpdateSettings({ modelPath: e.target.value })}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: '6px',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                        color: 'var(--text-main)', fontSize: '11.5px', outline: 'none'
                      }}
                    >
                      <option value="">(활성 모델 없음)</option>
                      {localModels.map(m => (
                        <option key={m.path} value={m.path}>{m.name} ({formatBytes(m.size || 0)})</option>
                      ))}
                    </select>
                  </div>

                  {/* 감지된 로컬 모델 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>감지된 로컬 모델 파일</span>
                    {localModels.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-muted)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        다운로드된 일반 모델이 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '110px', overflowY: 'auto' }}>
                        {localModels.map(m => (
                          <div key={m.path} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }} title={m.filename}>{m.filename}</span>
                            <span style={{ fontSize: '9.5px', color: 'var(--primary)', flexShrink: 0 }}>{formatBytes(m.size || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 추천 및 다운로드 허브 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>추천 대화 모델 빠른 설치</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[
                        {
                          name: 'Gemma 2 2B (구글)',
                          size: '1.6 GB',
                          desc: '빠른 응답 속도와 우수한 한국어 능력',
                          url: 'https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
                          filename: 'gemma-2-2b-it-q4_k_m.gguf'
                        },
                        {
                          name: 'EXAONE 3.0 2.4B (LG)',
                          size: '1.7 GB',
                          desc: 'LG AI 연구원의 고성능 국산 모델',
                          url: 'https://huggingface.co/mradermacher/EXAONE-3.0-2.4B-Instruct-GGUF/resolve/main/EXAONE-3.0-2.4B-Instruct.Q4_K_M.gguf',
                          filename: 'exaone-3.0-2.4b-instruct-q4_k_m.gguf'
                        },
                        {
                          name: 'Qwen 2.5 3B (스탠다드)',
                          size: '2.2 GB',
                          desc: '논리력과 밸런스가 뛰어난 스탠다드 모델',
                          url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
                          filename: 'qwen2.5-3b-instruct-q4_k_m.gguf'
                        }
                      ].map(model => {
                        const isInstalled = localModels.some(m => m.filename.toLowerCase() === model.filename.toLowerCase())
                        return (
                          <div key={model.filename} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700 }}>{model.name} <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>({model.size})</span></span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.desc}</span>
                            </div>
                            <button
                              disabled={isInstalled || !!downloadStatus}
                              onClick={() => startModelDownload(model.url, model.filename, 'llm')}
                              style={{
                                padding: '4px 8px', borderRadius: '4px',
                                background: isInstalled ? 'rgba(52, 211, 153, 0.15)' : 'var(--primary)',
                                color: isInstalled ? '#fff' : '#fff',
                                border: 'none', fontSize: '9.5px', fontWeight: 'bold',
                                cursor: isInstalled ? 'default' : 'pointer',
                                flexShrink: 0
                              }}
                            >
                              {isInstalled ? '설치됨' : '설치'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>

                {/* 2열: 코딩 특화 모델 (Code) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                  <div style={{ borderBottom: '1px solid var(--border-muted)', paddingBottom: '6px' }}>
                    <h4 style={{ fontSize: '12.5px', fontWeight: 700, margin: 0, color: '#34d399' }}>💻 코딩 특화 Coder 모델</h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>C:\ameva\models\code</span>
                  </div>

                  {/* 활성 모델 선택기 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>코딩 특화 모델 활성화</label>
                    <select
                      value={settings.codeModelPath || ''}
                      onChange={(e) => onUpdateSettings({ codeModelPath: e.target.value })}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: '6px',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                        color: 'var(--text-main)', fontSize: '11.5px', outline: 'none'
                      }}
                    >
                      <option value="">(코딩 시 일반 모델로 폴백)</option>
                      {localCodeModels.map(m => (
                        <option key={m.path} value={m.path}>{m.name} ({formatBytes(m.size || 0)})</option>
                      ))}
                    </select>
                  </div>

                  {/* 감지된 로컬 코딩 모델 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>감지된 로컬 코딩 모델 파일</span>
                    {localCodeModels.length === 0 ? (
                      <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-muted)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        다운로드된 코딩 모델이 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '110px', overflowY: 'auto' }}>
                        {localCodeModels.map(m => (
                          <div key={m.path} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }} title={m.filename}>{m.filename}</span>
                            <span style={{ fontSize: '9.5px', color: '#34d399', flexShrink: 0 }}>{formatBytes(m.size || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 추천 및 다운로드 허브 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>추천 코딩 모델 빠른 설치</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[
                        {
                          name: 'Qwen 2.5 Coder 1.5B (경량)',
                          size: '1.1 GB',
                          desc: '경량 코딩 최적화, 노트북에 적극 권장',
                          url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
                          filename: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf'
                        },
                        {
                          name: 'Qwen 2.5 Coder 3B (스탠다드)',
                          size: '2.2 GB',
                          desc: '속도와 코딩 코어 성능의 완벽한 밸런스',
                          url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf',
                          filename: 'qwen2.5-coder-3b-instruct-q4_k_m.gguf'
                        },
                        {
                          name: 'Qwen 2.5 Coder 7B (고성능)',
                          size: '4.7 GB',
                          desc: '복잡한 설계 및 알고리즘 구현 최적화 (Public)',
                          url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
                          filename: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf'
                        }
                      ].map(model => {
                        const isInstalled = localCodeModels.some(m => m.filename.toLowerCase() === model.filename.toLowerCase())
                        return (
                          <div key={model.filename} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700 }}>{model.name} <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>({model.size})</span></span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.desc}</span>
                            </div>
                            <button
                              disabled={isInstalled || !!downloadStatus}
                              onClick={() => startModelDownload(model.url, model.filename, 'code')}
                              style={{
                                padding: '4px 8px', borderRadius: '4px',
                                background: isInstalled ? 'rgba(52, 211, 153, 0.15)' : '#34d399',
                                color: isInstalled ? '#34d399' : '#000',
                                border: 'none', fontSize: '9.5px', fontWeight: 'bold',
                                cursor: isInstalled ? 'default' : 'pointer',
                                flexShrink: 0
                              }}
                            >
                              {isInstalled ? '설치됨' : '설치'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>

              </div>
            </div>
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

          {/* Hotkeys Tab */}
          {activeTab === 'Hotkeys' && (() => {
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
          })()}

          {/* MCP Manager Tab (Pro Plan Only) */}
          {activeTab === 'MCP' && isProPlan && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>MCP Server Manager</h3>
                <button
                  onClick={refreshMcpTools}
                  style={{
                    fontSize: '10px', color: 'var(--primary)', background: 'none',
                    border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0
                  }}
                >
                  새로고침 🔄
                </button>
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                외부 Stdio 자식 프로세스 또는 HTTP API 게이트웨이 기반의 MCP 도구(Tools) 서버를 하드코딩 없이 통합 제어합니다.
              </div>

              {/* 1. MCP 추가 폼 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-muted)',
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <strong style={{ fontSize: '10.5px', color: 'var(--primary)' }}>➕ 새 MCP 서버 추가</strong>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="서버 이름 (예: 파일 매니저)"
                    value={newMcpName}
                    onChange={e => setNewMcpName(e.target.value)}
                    style={{
                      flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-muted)', borderRadius: '4px',
                      color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                    }}
                  />
                  <select
                    value={newMcpType}
                    onChange={e => setNewMcpType(e.target.value as any)}
                    style={{
                      padding: '4px 8px', background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-muted)', borderRadius: '4px',
                      color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                    }}
                  >
                    <option value="http">HTTP Gateway</option>
                    <option value="stdio">Stdio Process</option>
                  </select>
                </div>

                {newMcpType === 'http' ? (
                  <input
                    type="text"
                    placeholder="HTTP 게이트웨이 주소 URL (예: http://127.0.0.1:11553/mcp)"
                    value={newMcpUrl}
                    onChange={e => setNewMcpUrl(e.target.value)}
                    style={{
                      padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-muted)', borderRadius: '4px',
                      color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="실행 명령어 (예: npx, python)"
                      value={newMcpCmd}
                      onChange={e => setNewMcpCmd(e.target.value)}
                      style={{
                        flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-muted)', borderRadius: '4px',
                        color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="파라미터 (예: -y @modelcontextprotocol/server-postgres)"
                      value={newMcpArgs}
                      onChange={e => setNewMcpArgs(e.target.value)}
                      style={{
                        flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-muted)', borderRadius: '4px',
                        color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={handleAddMcp}
                  style={{
                    padding: '6px', background: 'var(--primary)', border: 'none',
                    borderRadius: '4px', color: '#fff', fontSize: '10.5px',
                    fontWeight: 700, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}
                >
                  <Plus size={12} /> 서버 추가 등록
                </button>
              </div>

              {/* 2. 등록된 서버 리스트 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>⚙️ 활성 서버 인스턴스</span>
                {mcpServers.length === 0 ? (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    등록된 MCP 서버가 없습니다.
                  </div>
                ) : (
                  mcpServers.map(server => (
                    <div
                      key={server.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                        borderRadius: '6px', padding: '6px 10px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: server.enabled ? '#10b981' : 'var(--text-muted)'
                          }} />
                          <span style={{ fontSize: '11px', fontWeight: 700 }}>{server.name}</span>
                          <span style={{
                            fontSize: '8.5px', color: 'var(--primary)',
                            background: 'rgba(168,85,247,0.1)', padding: '1px 4px', borderRadius: '3px'
                          }}>
                            {server.type.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>
                          {server.type === 'http' ? server.url : `${server.command} ${(server.args || []).join(' ')}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleMcp(server.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                        >
                          {server.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} style={{ color: 'var(--text-dark)' }} />}
                        </button>
                        <button
                          onClick={() => handleDeleteMcp(server.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 3. 로드된 실제 도구 아코디언 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>🛠️ 실시간 제공 도구 목록 ({mcpTools.length}개)</span>
                {isLoadingTools ? (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    MCP 서버들로부터 도구 명세를 가져오는 중... 🔄
                  </div>
                ) : mcpTools.length === 0 ? (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    활성화된 서버가 없거나 제공하는 도구가 없습니다.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    {mcpTools.map(tool => {
                      const isExpanded = expandedTool === tool.name
                      return (
                        <div
                          key={tool.name}
                          style={{
                            background: 'rgba(255,255,255,0.01)',
                            border: '1px solid var(--border-muted)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                            style={{
                              padding: '6px 10px', cursor: 'pointer', display: 'flex',
                              justifyContent: 'space-between', alignItems: 'center',
                              background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                              fontSize: '10.5px', fontWeight: 600
                            }}
                          >
                            <span style={{ color: 'var(--secondary)' }}>{tool.name}</span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {isExpanded ? '접기 🔼' : '펼치기 🔽'}
                            </span>
                          </div>
                          {isExpanded && (
                            <div style={{
                              padding: '8px 10px', borderTop: '1px solid var(--border-muted)',
                              background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '4px'
                            }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-main)' }}>
                                {tool.description || '설명 없음'}
                              </div>
                              <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <strong>입력 명세:</strong> {JSON.stringify(tool.inputSchema?.properties || {})}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
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
