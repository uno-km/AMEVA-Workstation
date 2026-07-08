
import { BaseModal } from './BaseModal'
import type { BaseModalProps } from './BaseModal'
import { useDraggable } from '../../../hooks/app/useDraggable'
import { useModalResize } from '../../../hooks/app/useModalResize'
import { useUIStore } from '../../../stores/useUIStore'
import { useState, useEffect } from 'react'

export interface FreeModalProps extends BaseModalProps {
  initialX?: number
  initialY?: number
  initialWidth?: number
  initialHeight?: number
  hasBackdrop?: boolean
}

export function FreeModal(props: FreeModalProps) {
  const { isOpen, initialX = 100, initialY = 100, initialWidth = 820, initialHeight = 580, hasBackdrop, ...rest } = props
  
  const bringToFront = useUIStore(s => s.bringToFront)
  const [zIndex, setZIndex] = useState(10000)

  // 컴포넌트가 마운트될 때, 또는 열릴 때 한 번 z-index를 최상단으로 올립니다.
  useEffect(() => {
    if (isOpen) setZIndex(bringToFront())
  }, [isOpen, bringToFront])
  
  const { pos, handleMouseDown } = useDraggable({ x: initialX, y: initialY })
  const { modalSize, handleResizeMouseDown } = useModalResize(initialWidth, initialHeight)

  const handleModalFocus = () => {
    setZIndex(bringToFront())
  }

  if (!isOpen) return null

  return (
    <>
      {/* 선택적 백드롭 오버레이 */}
      {hasBackdrop && (
        <div
          onClick={rest.onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex - 1,
            backgroundColor: 'var(--bg-deep)',
            opacity: 0.5,
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto'
          }}
        />
      )}
      
      {/* 플로팅 모달 본체 */}
      <div
        onMouseDownCapture={handleModalFocus}
        style={{
          position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${modalSize.width}px`,
        height: `${modalSize.height}px`,
        zIndex,
        pointerEvents: 'auto',
      }}
    >
      <BaseModal
        {...rest}
        isOpen={true} // Wrapper handles the null return
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
      />
      
      {/* 리사이즈 핸들 */}
      {/* 동쪽 (우측) 핸들 */}
      <div
        onMouseDown={(e) => handleResizeMouseDown('e', e)}
        style={{
          position: 'absolute', right: 0, top: 0, width: '6px', height: '100%',
          cursor: 'ew-resize', zIndex: 100
        }}
      />
      {/* 남쪽 (하단) 핸들 */}
      <div
        onMouseDown={(e) => handleResizeMouseDown('s', e)}
        style={{
          position: 'absolute', left: 0, bottom: 0, width: '100%', height: '6px',
          cursor: 'ns-resize', zIndex: 100
        }}
      />
      {/* 남동쪽 (우하단) 모서리 핸들 */}
      <div
        onMouseDown={(e) => handleResizeMouseDown('se', e)}
        style={{
          position: 'absolute', right: 0, bottom: 0, width: '12px', height: '12px',
          cursor: 'nwse-resize', zIndex: 101,
          background: 'linear-gradient(135deg, transparent 40%, var(--primary) 60%)',
          opacity: 0.7,
          borderRadius: '0 0 12px 0'
        }}
      />
    </div>
    </>
  )
}
