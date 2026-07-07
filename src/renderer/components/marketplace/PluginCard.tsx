import React from 'react'
import { Check } from 'lucide-react'
import { PluginMetadata } from './types'

interface PluginCardProps {
  plugin: PluginMetadata
  isInstalled: boolean
  isActionLoading: boolean
  onToggleInstall: (plugin: PluginMetadata) => void
}

export function PluginCard({
  plugin: p,
  isInstalled,
  isActionLoading,
  onToggleInstall,
}: PluginCardProps) {
  return (
    <div
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
        onClick={() => onToggleInstall(p)}
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
}
