import React, { useState, useEffect } from 'react'
import { X, RefreshCw, Layers, Check, Search, Filter } from 'lucide-react'

interface PluginMetadata {
  id: string
  name: string
  description: string
  scriptUrl: string
  version: string
  type: 'tool' | 'feature' | 'collab'
}

interface MarketplaceModalProps {
  isOpen: boolean
  onClose: () => void
  installedPlugins: string[]
  onInstallPlugin: (id: string, scriptUrl: string) => Promise<void>
  onUninstallPlugin: (id: string) => void
}

export function MarketplaceModal({
  isOpen,
  onClose,
  installedPlugins,
  onInstallPlugin,
  onUninstallPlugin,
}: MarketplaceModalProps) {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // 검색 및 카테고리 탭 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tool' | 'feature' | 'collab'>('all')

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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 12, 0.75)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '560px',
          height: '580px',
          background: '#18181c',
          border: '1px solid #2e2e38',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #2e2e38',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc', letterSpacing: '0.5px' }}>
              Marketplace
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchPlugins}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="새로고침"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 🔍 검색창 및 탭 헤더 세션 */}
        <div style={{ padding: '16px 20px 8px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 검색 바 */}
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search extensions by keyword or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#0c0c0e',
                border: '1px solid #2e2e38',
                borderRadius: '6px',
                padding: '8px 12px 8px 32px',
                color: '#fff',
                fontSize: '11.5px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#2e2e38'}
            />
          </div>

          {/* 카테고리 탭 리스트 */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #2e2e38', paddingBottom: '8px' }}>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

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

          {!loading && !error && filteredPlugins.map((p) => {
            const isInstalled = installedPlugins.includes(p.id)
            const isActionLoading = actionLoading[p.id]

            return (
              <div
                key={p.id}
                style={{
                  padding: '14px 16px',
                  background: '#0f0f11',
                  border: '1px solid #2e2e38',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(139,92,246,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2e2e38'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f8fafc' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: '#1c1c24', padding: '1px 5px', borderRadius: '4px' }}>
                      v{p.version}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      color: p.type === 'tool' ? '#f59e0b' : p.type === 'feature' ? '#06b6d4' : '#ec4899',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.3px'
                    }}>
                      {p.type}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {p.description}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleInstall(p)}
                  disabled={isActionLoading}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: isActionLoading ? 'not-allowed' : 'pointer',
                    background: isInstalled ? 'rgba(16,185,129,0.12)' : 'var(--primary)',
                    border: isInstalled ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                    color: isInstalled ? '#34d399' : '#000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s',
                    outline: 'none',
                    flexShrink: 0
                  }}
                >
                  {isInstalled ? (
                    <>
                      <Check size={11} />
                      Installed
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 슬림 다크 스크롤바 커스텀 주입 */}
      <style>{`
        .marketplace-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .marketplace-scroll::-webkit-scrollbar-track {
          background: #18181c;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb {
          background: #2e2e38;
          border-radius: 3px;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>
    </div>
  )
}
