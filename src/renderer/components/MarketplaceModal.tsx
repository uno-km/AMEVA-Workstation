import { useState, useEffect } from 'react'
import type { PluginMetadata, MarketplaceModalProps } from './marketplace/types'
import { MarketplaceHeader } from './marketplace/MarketplaceHeader'
import { MarketplaceToolbar } from './marketplace/MarketplaceToolbar'
import { SaaSPluginCard } from './marketplace/SaaSPluginCard'
import { PluginCard } from './marketplace/PluginCard'

export type { PluginMetadata, MarketplaceModalProps }

export function MarketplaceModal({
  isOpen,
  onClose,
  installedPlugins,
  onInstallPlugin,
  onUninstallPlugin,
  isProPlan = false,
}: MarketplaceModalProps) {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // 🦾 SaaS 유료 기능 토글 상태 관리
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({
    webSearch: false,
    pythonConsole: false,
    requestQueue: false,
  })

  // 검색 및 카테고리 탭 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tool' | 'feature' | 'collab'>('all')

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('enabled-plugins')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (!isProPlan) {
            setEnabledPlugins({ webSearch: false, pythonConsole: false, requestQueue: false })
          } else {
            setEnabledPlugins(parsed)
          }
        } else {
          if (isProPlan) {
            setEnabledPlugins({ webSearch: true, pythonConsole: true, requestQueue: false })
          } else {
            setEnabledPlugins({ webSearch: false, pythonConsole: false, requestQueue: false })
          }
        }
      } catch (e) {}
    }
  }, [isOpen, isProPlan])

  const handleToggleSaaSPlugin = (id: string) => {
    if (!isProPlan) {
      alert('⚠️ 해당 기능은 Pro 플랜 이상에서만 활성화할 수 있는 프리미엄 도구입니다. 가격 플랜 탭에서 업그레이드를 진행하세요.')
      return
    }
    const updated = {
      ...enabledPlugins,
      [id]: !enabledPlugins[id]
    }
    setEnabledPlugins(updated)
    localStorage.setItem('enabled-plugins', JSON.stringify(updated))
  }

  // 마켓플레이스 서버 플러그인 로드
  const fetchPlugins = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3010/api/plugins')
      if (!res.ok) throw new Error('서버 통신 실패')
      const data = await res.json()
      setPlugins(data)
    } catch (err: any) {
      setError('Marketplace 서버를 찾을 수 없거나 오프라인 상태입니다. (Port: 3010)')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchPlugins()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleToggleInstall = async (plugin: PluginMetadata) => {
    const isInstalled = installedPlugins.includes(plugin.id)
    setActionLoading(prev => ({ ...prev, [plugin.id]: true }))
    
    try {
      if (isInstalled) {
        onUninstallPlugin(plugin.id)
      } else {
        await onInstallPlugin(plugin.id, plugin.scriptUrl)
      }
    } catch (err) {
      alert('플러그인 처리 중 실패했습니다.')
    } finally {
      setActionLoading(prev => ({ ...prev, [plugin.id]: false }))
    }
  }

  // 필터링 연산
  const filteredPlugins = plugins.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories: { id: 'all' | 'tool' | 'feature' | 'collab'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tool', label: 'Tools' },
    { id: 'feature', label: 'Features' },
    { id: 'collab', label: 'Collab' },
  ]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--bg-glass-active)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          height: '580px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-muted)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <MarketplaceHeader onRefresh={fetchPlugins} loading={loading} onClose={onClose} />

        <MarketplaceToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
        />

        {/* 본문 영역 (스크롤바 완비) */}
        <div
          className="marketplace-scroll"
          style={{
            padding: '8px 20px 20px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
              익스텐션 목록을 가져오는 중입니다...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '16px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '11px',
                lineHeight: '1.5',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && filteredPlugins.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
              조건에 맞는 플러그인이 없습니다.
            </div>
          )}

          {/* 👑 SaaS Premium Toggles (DuckDuckGo, Python Sandbox, Request Queue) */}
          {!loading && categories.length > 0 && (() => {
            const saasItems = [
              {
                id: 'webSearch',
                name: 'DuckDuckGo Web Search API (Pro)',
                description: 'ReAct 에이전트가 외부 웹 검색(실시간 인터넷 정보 및 뉴스)을 통해 추론하고 결과를 조합할 수 있게 권한을 위임합니다.',
                type: 'tool' as const,
                version: '1.2.0'
              },
              {
                id: 'pythonConsole',
                name: 'Python Sandbox Executor (Pro)',
                description: '로컬 파이썬 샌드박스를 연동하여 복잡한 수식 연산 및 데이터 처리 알고리즘 코드를 실제 런타임에서 실행해 줍니다.',
                type: 'tool' as const,
                version: '2.0.4'
              },
              {
                id: 'requestQueue',
                name: 'Sequential Request Queue (Pro)',
                description: '질문을 연달아 우다다닥 보낼 때 취소되지 않고 안전하게 백그라운드 큐 버퍼에 쌓여 차례로 실행해 주는 순차 처리기입니다.',
                type: 'feature' as const,
                version: '1.0.1'
              }
            ]

            const filteredSaas = saasItems.filter(p => {
              const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory
              const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
              return matchesCategory && matchesSearch
            })

            return filteredSaas.map(p => (
              <SaaSPluginCard
                key={p.id}
                id={p.id}
                name={p.name}
                version={p.version}
                type={p.type}
                description={p.description}
                isEnabled={enabledPlugins[p.id] ?? false}
                onToggle={handleToggleSaaSPlugin}
              />
            ))
          })()}

          {!loading && !error && filteredPlugins.map((p) => (
            <PluginCard
              key={p.id}
              plugin={p}
              isInstalled={installedPlugins.includes(p.id)}
              isActionLoading={!!actionLoading[p.id]}
              onToggleInstall={handleToggleInstall}
            />
          ))}
        </div>
      </div>
      
      {/* 슬림 다크 스크롤바 커스텀 주입 */}
      <style>{`
        .marketplace-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .marketplace-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb {
          background: var(--border-muted);
          border-radius: 3px;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>
    </div>
  )
}
