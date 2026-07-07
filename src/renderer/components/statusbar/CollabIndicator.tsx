import React from 'react'
import type { PeerState } from '../../../shared/types'

interface CollabIndicatorProps {
  peers: PeerState[]
}

export function CollabIndicator({ peers }: CollabIndicatorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'var(--success)',
          animation: 'pulse 1.5s infinite',
        }}
      />
      <span style={{ color: 'var(--success)' }}>
        협업 ({peers.length + 1}명)
      </span>
      {/* 아바타 목록 시각화 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '2px' }}>
        {peers.map((peer) => (
          <div
            key={peer.id}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: peer.color,
              color: '#ffffff',
              fontSize: '8px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              cursor: 'help',
            }}
            title={`${peer.name} (접속 중)`}
          >
            {peer.name.charAt(0)}
          </div>
        ))}
      </div>
    </div>
  )
}
