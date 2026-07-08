import { useState, useRef, useEffect, useCallback } from 'react'

interface Position {
  x: number
  y: number
}

export function useDraggable(initialPos: Position = { x: 100, y: 100 }) {
  const [pos, setPos] = useState<Position>(initialPos)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<Position>({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Ignore clicks on buttons, inputs, selects, or resize handles
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('.resize-handle')) {
      return
    }
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    }
  }, [pos])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        })
      }
    }
    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return {
    pos,
    setPos,
    isDragging,
    handleMouseDown
  }
}
