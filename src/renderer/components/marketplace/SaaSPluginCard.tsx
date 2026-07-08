
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
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 5%, var(--bg-main)) 0%, var(--bg-main) 100%)',
        border: '1px dashed color-mix(in srgb, var(--primary) 25%, transparent)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.boxShadow = '0 0 8px color-mix(in srgb, var(--primary) 20%, transparent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 25%, transparent)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--text-main)' }}>
            👑 {name}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '1px 5px', borderRadius: '4px' }}>
            v{version}
          </span>
          <span style={{
            fontSize: '9px',
            color: 'var(--primary)',
            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
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
          background: isEnabled ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--bg-panel)',
          border: isEnabled ? '1px solid color-mix(in srgb, var(--primary) 40%, transparent)' : '1px solid var(--border-muted)',
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
