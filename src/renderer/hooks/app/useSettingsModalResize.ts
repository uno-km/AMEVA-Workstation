import React, { useState } from 'react'

export function useSettingsModalResize(initialWidth = 820, initialHeight = 580) {
  const [modalSize, setModalSize] = useState({ width: initialWidth, height: initialHeight })

  const handleResizeMouseDown = (dir: 'e' | 's' | 'se', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const startX = e.clientX
    const startY = e.clientY
    const startW = modalSize.width
    const startH = modalSize.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      let nextW = startW
      let nextH = startH

      if (dir.includes('e')) {
        nextW = Math.max(500, startW + deltaX)
      }
      if (dir.includes('s')) {
        nextH = Math.max(380, startH + deltaY)
      }

      setModalSize({ width: nextW, height: nextH })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return {
    modalSize,
    handleResizeMouseDown
  }
}
