import React from 'react'

interface SaaSPluginCardProps {
  id: string
  name: string
  version: string
  type: string
  description: string
  isEnabled: boolean
  onToggle: (id: string) => void
}

export function SaaSPluginCard({
  id,
  name,
  version,
  type,
  description,
  isEnabled,
  onToggle,
}: SaaSPluginCardProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #130f1e 0%, #0f0f11 100%)',
        border: '1px dashed rgba(139, 92, 246, 0.25)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.boxShadow = '0 0 8px rgba(139,92,246,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.25)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f8fafc' }}>
            👑 {name}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--primary)', background: 'rgba(139,92,246,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
            v{version}
          </span>
          <span style={{
            fontSize: '9px',
            color: '#a855f7',
            background: 'rgba(168,85,247,0.15)',
            border: '1px solid rgba(168,85,247,0.2)',
            padding: '1px 5px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: '0.3px'
          }}>
            {type}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {description}
        </div>
      </div>

      <button
        onClick={() => onToggle(id)}
        style={{
          padding: '5px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          background: isEnabled ? 'rgba(168,85,247,0.2)' : '#1c1c24',
          border: isEnabled ? '1px solid rgba(168,85,247,0.4)' : '1px solid #2e2e38',
          color: isEnabled ? 'var(--primary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s',
          outline: 'none',
          flexShrink: 0
        }}
      >
        {isEnabled ? 'ENABLED' : 'DISABLED'}
      </button>
    </div>
  )
}
