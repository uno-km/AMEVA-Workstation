
import React from 'react'

export function AIWelcomeScreen({ QUICK_ACTIONS, isAvailable, onAction }: any) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center'
    }}>
      <div style={{ marginBottom: '24px', opacity: 0.8 }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(124,58,237,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <img src="https://avatars.githubusercontent.com/u/150068467?v=4" alt="AMEVA" style={{ width: '40px', height: '40px', borderRadius: '50%', opacity: 0.9 }} />
        </div>
        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>
          AMEVA AI Assistant
        </h3>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
          무엇을 도와드릴까요?
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', maxWidth: '280px' }}>
        {QUICK_ACTIONS.map((action: any) => (
          <button
            key={action.id}
            onClick={() => onAction(action.prompt)}
            disabled={!isAvailable}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', borderRadius: '10px',
              background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', cursor: isAvailable ? 'pointer' : 'not-allowed',
              opacity: isAvailable ? 1 : 0.5,
              fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            }}
          >
            <action.icon size={14} style={{ color: 'var(--primary)' }} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
