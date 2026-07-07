import React, { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { DocumentSnapshot } from '../../../shared/types'

export interface SidebarTabHistoryProps {
  snapshots: DocumentSnapshot[]
  onCreateSnapshot: (title: string) => void
  onDeleteSnapshot: (id: string) => void
  onSelectSnapshotForDiff: (snapshot: DocumentSnapshot) => void
  sectionLabel: (text: string) => React.ReactNode
}

export function SidebarTabHistory({
  snapshots, onCreateSnapshot, onDeleteSnapshot, onSelectSnapshotForDiff, sectionLabel,
}: SidebarTabHistoryProps) {
  const [snapTitle, setSnapTitle] = useState('')

  return (
    <div
      data-focus-region="sidebar-history"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, position: 'relative' }}
    >
      {sectionLabel('스냅샷 저장')}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="버전 제목 입력..."
          value={snapTitle}
          onChange={e => setSnapTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && snapTitle.trim()) {
              onCreateSnapshot(snapTitle)
              setSnapTitle('')
            }
          }}
          style={{
            flex: 1, background: 'var(--bg-glass)',
            border: '1px solid var(--border-muted)', borderRadius: '6px',
            padding: '6px 10px', color: 'var(--text-main)', outline: 'none', fontSize: '12px',
          }}
        />
        <button
          className="btn btn-glass"
          style={{ padding: '6px 10px', flexShrink: 0 }}
          onClick={() => {
            if (snapTitle.trim()) {
              onCreateSnapshot(snapTitle)
              setSnapTitle('')
            }
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      {sectionLabel(`타임라인 (${snapshots.length}개)`)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {snapshots.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', opacity: 0.6 }}>
            저장된 스냅샷이 없습니다.<br />
            <span style={{ fontSize: '10px' }}>3분마다 자동 저장됩니다.</span>
          </div>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.id}
              className="glass-panel"
              style={{ padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  fontWeight: 600, fontSize: '12px', color: 'var(--primary)',
                  maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {snap.title}
                </span>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    onClick={() => onSelectSnapshotForDiff(snap)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', cursor: 'pointer', padding: '2px' }}
                    title="비교 및 롤백"
                  >
                    <RefreshCw size={11} />
                  </button>
                  <button
                    onClick={() => onDeleteSnapshot(snap.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                    title="삭제"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {new Date(snap.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
