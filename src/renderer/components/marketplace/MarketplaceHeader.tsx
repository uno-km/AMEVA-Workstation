import { Layers, RefreshCw, X } from 'lucide-react'

interface MarketplaceHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  onClose: () => void;
}

export function MarketplaceHeader({ onRefresh, loading, onClose }: MarketplaceHeaderProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={18} style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '0.5px' }}>
          Marketplace
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onRefresh}
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
  )
}
