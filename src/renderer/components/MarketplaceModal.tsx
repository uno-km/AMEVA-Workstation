import React, { useState, useEffect } from 'react'
import { X, RefreshCw, Layers, Check } from 'lucide-react'

interface PluginMetadata {
  id: string
  name: string
  description: string
  scriptUrl: string
  version: string
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
          width: '540px',
          maxHeight: '80vh',
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

        {/* 본문 영역 */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
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
                fontSize: '12px',
                lineHeight: '1.5',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && plugins.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              등록된 플러그인이 없습니다.
            </div>
          )}

          {!loading && !error && plugins.map((p) => {
            const isInstalled = installedPlugins.includes(p.id)
            const isActionLoading = actionLoading[p.id]

            return (
              <div
                key={p.id}
                style={{
                  padding: '16px',
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
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: '#1c1c24', padding: '2px 6px', borderRadius: '4px' }}>
                      v{p.version}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {p.description}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleInstall(p)}
                  disabled={isActionLoading}
                  style={{
                    padding: '6px 14px',
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
    </div>
  )
}
