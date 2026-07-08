import { Sparkles, List, Calculator, TrendingUp, Play, Globe, Search, Calendar, HardDrive } from 'lucide-react'
import type { HotkeyConfig } from './SettingsModal'

import { useUIStore } from '../stores/useUIStore'
import { useAppContext } from '../contexts/AppContext'

export interface RightTabStripProps {}

export function RightTabStrip({}: RightTabStripProps = {}) {
  const { activeRightTab: activeTab, showAIPanel: isOpen, setShowAIPanel, setActiveRightTab, hasChatUnread } = useUIStore()
  const { settings, isProPlan } = useAppContext()
  const installedPlugins = settings?.installedPlugins || []
  const hotkeys = settings?.hotkeys
  
  const onToggleTab = (tab: string) => {
    if (isOpen && activeTab === tab) {
      setShowAIPanel(false)
    } else {
      setActiveRightTab(tab)
      setShowAIPanel(true)
    }
  }
  const formatHotkey = (raw: string | undefined): string => {
    if (!raw) return ''
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' + ')
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
  const isOutlineSubscribed = installedPlugins.includes('outline')
  const isCalculatorSubscribed = installedPlugins.includes('calculator')
  const isFinanceSubscribed = installedPlugins.includes('finance-dashboard')
  const isYoutubeSubscribed = installedPlugins.includes('youtube')
  const isNaverSubscribed = installedPlugins.includes('naver')
  const isGoogleSubscribed = installedPlugins.includes('google')
  const isCalendarSubscribed = installedPlugins.includes('calendar')
  const isGoogleDriveSubscribed = installedPlugins.includes('google-drive')
  
  const tabs = isProPlan ? [
    { id: 'ai', icon: Sparkles, label: 'AI 어시스턴트', badge: hasChatUnread },
    ...(isOutlineSubscribed ? [{ id: 'outline', icon: List, label: '문서 구조도 (TOC)', badge: false }] : []),
    ...(isCalculatorSubscribed ? [{ id: 'calculator', icon: Calculator, label: '계산기 도구', badge: false }] : []),
    ...(isFinanceSubscribed ? [{ id: 'finance', icon: TrendingUp, label: '주식/환율 정보센터', badge: false }] : []),
    ...(isYoutubeSubscribed ? [{ id: 'youtube', icon: Play, label: 'YouTube 동영상', badge: false }] : []),
    ...(isNaverSubscribed ? [{ id: 'naver', icon: Globe, label: '네이버 포털', badge: false }] : []),
    ...(isGoogleSubscribed ? [{ id: 'google', icon: Search, label: '구글 검색', badge: false }] : []),
    ...(isCalendarSubscribed ? [{ id: 'calendar', icon: Calendar, label: '스케줄 캘린더', badge: false }] : []),
    ...(isGoogleDriveSubscribed ? [{ id: 'google-drive', icon: HardDrive, label: '구글 드라이브', badge: false }] : []),
  ] : [
    { id: 'ai', icon: Sparkles, label: 'AI 어시스턴트', badge: hasChatUnread },
  ]

  return (
    <div
      style={{
        width: '40px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--bg-deep)',
        borderLeft: '1px solid var(--border-muted)',
        paddingTop: '16px',
        gap: '6px',
        flexShrink: 0,
        zIndex: 100,
        userSelect: 'none',
      }}
    >
      {tabs.map((t) => {
        const isActive = isOpen && activeTab === t.id
        const Icon = t.icon

        return (
          <button
            key={t.id}
            onClick={() => onToggleTab(t.id)}
            title={t.id === 'ai' ? `${t.label} (${formatHotkey(hkeys.toggleAI)})` : t.label}
            style={{
              width: '28px',
              height: '32px',
              borderRadius: '6px 0 0 6px', // 책갈피 느낌으로 왼쪽만 둥글게 깎음
              background: isActive ? 'var(--bg-main)' : 'transparent',
              border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
              borderRight: isActive ? 'none' : '1px solid transparent', // 패널과의 경계선 개방
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'var(--transition-fast)',
              outline: 'none',
              marginLeft: isActive ? '12px' : '0', // 활성화 시 오른쪽 선에 밀착되도록 조정
              boxShadow: isActive ? '0 0 10px var(--primary-glow)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-main)'
                e.currentTarget.style.background = 'var(--bg-glass-active)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <Icon size={16} />

            {/* 알림 배지 (주황점) */}
            {t.badge && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#f97316',
                  boxShadow: '0 0 4px #f97316',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
