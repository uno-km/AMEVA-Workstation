import React from 'react'

import { useYoutubePiP } from '../../hooks/app/useYoutubePiP'

export interface FloatingPiPVideoProps {}

export function FloatingPiPVideo({}: FloatingPiPVideoProps = {}) {
  const { pipVideoId, pipPosition, handlePiPMouseDown, setPipVideoId } = useYoutubePiP()
  if (!pipVideoId) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: pipPosition.x,
        top: pipPosition.y,
        width: '340px',
        height: '220px',
        background: '#18181c',
        border: '1.5px solid var(--primary)',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          height: '28px',
          background: '#0f0f11',
          borderBottom: '1px solid #2e2e38',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          cursor: 'move',
        }}
        onMouseDown={handlePiPMouseDown}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', `https://youtube.com/watch?v=${pipVideoId}`)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          // Right click context menu (optional if user mentioned it)
          const evt = new CustomEvent('app:insert-youtube', { detail: { videoId: pipVideoId } })
          window.dispatchEvent(evt)
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>📺 Floating YouTube PiP Player</span>
        <button
          onClick={() => setPipVideoId(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f87171',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ flex: 1, background: '#000' }}>
        <iframe
          src={`https://www.youtube.com/embed/${pipVideoId}?autoplay=1`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  )
}
