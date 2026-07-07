
import React from 'react'

export function AIModelHubModal({ show, onClose, models, onDownload, downloadStatus }: any) {
  if (!show) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
      zIndex: 200, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '14px' }}>추천 모델 다운로드 허브</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>X</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {models.map((m: any) => (
          <div key={m.id} style={{
            padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px',
            border: '1px solid var(--border-muted)'
          }}>
            <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13px' }}>{m.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>{m.description}</div>
            <button 
              onClick={() => onDownload(m.id)}
              disabled={!!downloadStatus?.status}
              style={{
                marginTop: '12px', width: '100%', padding: '8px',
                background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px',
                cursor: downloadStatus?.status ? 'not-allowed' : 'pointer', opacity: downloadStatus?.status ? 0.5 : 1
              }}
            >
              다운로드
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
