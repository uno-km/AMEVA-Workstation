/**
 * usePanelResize.ts
 * ─────────────────────────────────────────────────────────────
 * 패널 가로 크기 조절을 위한 범용 훅
 *
 * 사용법:
 *   const { width, handleMouseDown } = usePanelResize({
 *     storageKey: 'sidebar-width',
 *     defaultWidth: 280,
 *     minWidth: 160,
 *     maxWidth: 520,
 *     direction: 'right',  // 핸들이 패널의 오른쪽 경계
 *   })
 *
 * direction:
 *   'right' — 핸들을 오른쪽에 놓고 드래그하면 패널이 넓어짐 (사이드바)
 *   'left'  — 핸들을 왼쪽에 놓고 드래그하면 패널이 넓어짐 (AI 패널)
 * ─────────────────────────────────────────────────────────────
 */
import { useState, useCallback, useEffect, useRef } from 'react'

interface Options {
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** 'right': 패널 오른쪽 경계 드래그 (사이드바) | 'left': 패널 왼쪽 경계 드래그 (AI 패널) */
  direction: 'right' | 'left'
}

interface Result {
  width: number
  isDragging: boolean
  handleMouseDown: (e: React.MouseEvent) => void
}

export function usePanelResize({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  direction,
}: Options): Result {
  // localStorage에서 복원, 없으면 defaultWidth
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(`panel-resize-${storageKey}`)
      if (stored) {
        const parsed = Number(stored)
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) return parsed
      }
    } catch {}
    return defaultWidth
  })

  const [isDragging, setIsDragging] = useState(false)

  // 드래그 시작 시점의 마우스 X와 패널 너비를 ref로 보존 (closure 문제 방지)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault()
    const dx = e.clientX - startXRef.current
    const newWidth = direction === 'right'
      ? startWidthRef.current + dx   // 오른쪽으로 드래그 → 패널 확장
      : startWidthRef.current - dx   // 왼쪽으로 드래그 → 패널 확장 (AI패널: 핸들이 왼쪽)
    const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth))
    setWidth(clamped)
  }, [direction, minWidth, maxWidth])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // localStorage 영속화
    setWidth(prev => {
      try {
        localStorage.setItem(`panel-resize-${storageKey}`, String(prev))
      } catch {}
      return prev
    })
  }, [storageKey])

  // 드래그 중에는 document 레벨 이벤트를 캡처 (빠른 마우스 이동도 놓치지 않도록)
  useEffect(() => {
    if (!isDragging) return
    // body class 추가 → 드래그 중 iframe 등이 mouse 이벤트 가로채지 않도록
    document.body.classList.add('is-resizing')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.body.classList.remove('is-resizing')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])


  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = width
    setIsDragging(true)
  }, [width])

  return { width, isDragging, handleMouseDown }
}
