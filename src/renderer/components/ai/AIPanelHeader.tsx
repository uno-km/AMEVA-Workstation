
import { Settings2, X, Sparkles, Trash2, Loader2 } from 'lucide-react'

export interface AIPanelHeaderProps {
  title: string
  providerLabel: string
  modelLabel: string
  onOpenSettings: () => void
  onClose?: () => void
  isGenerating?: boolean
  onClearMessages?: () => void
}

export function AIPanelHeader({
  title,
  providerLabel,
  modelLabel,
  onOpenSettings,
  onClose,
  isGenerating,
  onClearMessages
}: AIPanelHeaderProps) {
  return (
    <div style={{
      padding: '14px 16px 10px',
      borderBottom: '1px solid var(--border-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
      flexWrap: 'nowrap',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 12px var(--primary-glow)',
        flexShrink: 0,
      }}>
        {isGenerating ? (
          <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Sparkles size={14} color="#fff" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', flexShrink: 0 }}>
            AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
          <span style={{
            fontSize: '9px',
            padding: '2px 6px',
            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            borderRadius: '4px',
            color: 'var(--text-main)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {providerLabel} {modelLabel ? `(${modelLabel})` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {onClearMessages && (
          <button
            onClick={onClearMessages}
            style={{
              background: 'transparent',
              border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            title="대화 비우기"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="AI 설정"
        >
          <Settings2 size={14} />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
