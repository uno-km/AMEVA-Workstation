
import React from 'react'
import { formatBytes } from '../../../utils/aiFormatters'

export function AIDownloadProgress({ downloadStatus, onCancel, onShowDetails }: any) {
  if (!downloadStatus || !downloadStatus.status) return null

  return (
    <>
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px',
        width: '240px', background: 'var(--bg-glass)',
        border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px',
        padding: '10px', zIndex: 110,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>
            모델 다운로드 중...
          </span>
          <span style={{ fontSize: '10px', color: 'var(--primary)' }}>
            {Math.round(downloadStatus.progress || 0)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${downloadStatus.progress || 0}%`, height: '100%', 
            background: 'var(--primary)', transition: 'width 0.3s' 
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>{formatBytes(downloadStatus.downloaded)} / {formatBytes(downloadStatus.total)}</span>
          <span>{formatBytes(downloadStatus.speed)}/s</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <button 
            onClick={onCancel}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'transparent', border: '1px solid var(--border-muted)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            취소
          </button>
          <button 
            onClick={onShowDetails}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'var(--primary)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            상세보기
          </button>
        </div>
      </div>
    </>
  )
}
