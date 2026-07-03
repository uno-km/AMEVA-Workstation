import { Sparkles, List, Calculator } from 'lucide-react'

interface RightTabStripProps {
  activeTab: string
  isOpen: boolean
  onToggleTab: (tab: string) => void
  hasChatUnread?: boolean
  installedPlugins?: string[]
}

export function RightTabStrip({ activeTab, isOpen, onToggleTab, hasChatUnread = false, installedPlugins = [] }: RightTabStripProps) {
  const isOutlineSubscribed = installedPlugins.includes('outline')
  const isCalculatorSubscribed = installedPlugins.includes('calculator')
  
  const tabs = [
    { id: 'ai', icon: Sparkles, label: 'AI 어시스턴트', badge: hasChatUnread },
    ...(isOutlineSubscribed ? [{ id: 'outline', icon: List, label: '문서 구조도 (TOC)', badge: false }] : []),
    ...(isCalculatorSubscribed ? [{ id: 'calculator', icon: Calculator, label: '계산기 도구', badge: false }] : []),
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
        gap: '12px',
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
            title={t.label}
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
