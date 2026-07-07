import React, { useState, useEffect } from 'react'
import type { PeerState } from '../../../shared/types'

export interface PeerBlockHighlightLayerProps {
  peers: PeerState[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface BlockOverlay {
  peerId: string
  peerName: string
  peerColor: string
  isEditing: boolean
  top: number
  left: number
  width: number
  height: number
}

export function PeerBlockHighlightLayer({ peers, containerRef }: PeerBlockHighlightLayerProps) {
  const [overlays, setOverlays] = useState<BlockOverlay[]>([])

  useEffect(() => {
    const activeList = peers.filter(p => p.blockHighlight?.blockId)
    if (activeList.length === 0) {
      setOverlays(prev => prev.length === 0 ? prev : [])
      return
    }

    const computeOverlays = () => {
      const container = containerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const newOverlays: BlockOverlay[] = []

      for (const peer of activeList) {
        if (!peer.blockHighlight) continue
        const { blockId, isEditing } = peer.blockHighlight

        const blockDom = document.querySelector(`[data-id="${blockId}"], [data-block-id="${blockId}"]`)
        if (!blockDom) continue

        const outerEl = blockDom.closest('.bn-block-outer') || blockDom
        const rect = outerEl.getBoundingClientRect()

        newOverlays.push({
          peerId: peer.id,
          peerName: peer.name,
          peerColor: peer.color,
          isEditing,
          top: rect.top - containerRect.top + scrollTop,
          left: rect.left - containerRect.left,
          width: rect.width,
          height: rect.height,
        })
      }
      setOverlays(prev => {
        const isDifferent = newOverlays.length !== prev.length ||
          newOverlays.some((item, idx) => 
            item.peerId !== prev[idx]?.peerId || 
            item.isEditing !== prev[idx]?.isEditing ||
            item.top !== prev[idx]?.top ||
            item.height !== prev[idx]?.height ||
            item.width !== prev[idx]?.width
          )
        return isDifferent ? newOverlays : prev
      })
    }

    computeOverlays()
    const timer = setInterval(computeOverlays, 300)

    window.addEventListener('resize', computeOverlays)
    const container = containerRef.current
    if (container) container.addEventListener('scroll', computeOverlays)

    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', computeOverlays)
      if (container) container.removeEventListener('scroll', computeOverlays)
    }
  }, [peers, containerRef])

  if (overlays.length === 0) return null

  // 같은 블록에 있는 피어들 라벨 세로 위치 조율용 Map
  const blockLabelCounts = new Map<string, number>()

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
      {overlays.map((ov) => {
        const blockKey = `${ov.top}_${ov.left}`
        const count = blockLabelCounts.get(blockKey) || 0
        blockLabelCounts.set(blockKey, count + 1)
        const labelTop = count * 22

        return (
          <React.Fragment key={ov.peerId}>
            <div
              style={{
                position: 'absolute',
                top: ov.top,
                left: ov.left - 4,
                width: ov.width + 8,
                height: ov.height,
                backgroundColor: ov.peerColor,
                opacity: ov.isEditing ? 0.14 : 0.08,
                pointerEvents: 'none',
                zIndex: 5,
                borderRadius: '4px',
                borderLeft: `3px solid ${ov.peerColor}`,
                transition: 'opacity 0.2s, top 0.12s, height 0.12s',
              }}
            />

            <div
              style={{
                position: 'absolute',
                top: ov.top - 20 + labelTop,
                left: ov.left,
                pointerEvents: 'none',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'top 0.12s',
              }}
            >
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                backgroundColor: ov.peerColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '8px', fontWeight: 800, color: '#fff',
                boxShadow: `0 0 6px ${ov.peerColor}80`,
                flexShrink: 0,
              }}>
                {ov.peerName.charAt(0).toUpperCase()}
              </div>

              <div style={{
                background: ov.peerColor,
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '3px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                opacity: 0.95,
              }}>
                <span>{ov.peerName}</span>
                {ov.isEditing && (
                  <span style={{
                    fontSize: '8px', opacity: 0.9,
                    animation: 'collab-pulse 1.2s infinite alternate',
                  }}>
                    editing...
                  </span>
                )}
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
