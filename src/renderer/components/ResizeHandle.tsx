/**
 * ResizeHandle.tsx
 * ─────────────────────────────────────────────────────────────
 * 패널 경계에 배치하는 드래그 가능한 리사이즈 핸들 컴포넌트
 *
 * Props:
 *   onMouseDown   — usePanelResize에서 반환한 handleMouseDown
 *   isDragging    — 드래그 중 여부 (강조 표시)
 *   placement     — 'right' | 'left' (핸들 위치)
 *
 * UX:
 *   - 평소: 2px 투명 영역 + col-resize 커서
 *   - hover: 보라/청록 그라디언트 라인 노출 (0.3s fade)
 *   - drag 중: 항상 활성 상태 유지
 * ─────────────────────────────────────────────────────────────
 */
import React, { useState } from 'react'

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void
  isDragging: boolean
  placement?: 'right' | 'left'
  /** 높이 기본값은 100% */
  height?: string
}

export function ResizeHandle({
  onMouseDown,
  isDragging,
  placement = 'right',
  height = '100%',
}: ResizeHandleProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isActive = isDragging || isHovered

  return (
    <div
      onMouseDown={(e) => {
        e.stopPropagation()
        onMouseDown(e)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        // 패널 경계에 절대 위치로 붙임
        position: 'absolute',
        top: 0,
        [placement === 'right' ? 'right' : 'left']: 0,
        width: '8px',       // 클릭 가능 영역 8px
        height,
        zIndex: 200,
        cursor: 'col-resize',
        // 드래그 핸들 본체 — 투명 배경 + hover/drag 시 라인 노출
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 드래그 중에는 위치가 고정이어야 하므로 pointer-events: all
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* 시각적 인디케이터 라인 (3px) */}
      <div
        style={{
          width: '3px',
          height: isActive ? '100%' : '40%',
          borderRadius: '2px',
          background: isActive
            ? 'linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%)'
            : 'transparent',
          boxShadow: isActive ? `0 0 8px var(--primary-glow)` : 'none',
          transition: 'height 0.25s ease, background 0.2s ease, box-shadow 0.2s ease',
          pointerEvents: 'none',
        }}
      />
      {/* hover 시 dot 인디케이터 */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '6px',
            height: '24px',
            borderRadius: '3px',
            background: 'var(--primary)',
            opacity: 0.9,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
          }}
        >
          {/* grip dots */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: '2px',
                height: '2px',
                borderRadius: '50%',
                background: '#fff',
                opacity: 0.8,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
