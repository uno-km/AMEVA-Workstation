/**
 * useYoutubePiP.ts
 *
 * YouTube Picture-in-Picture (PiP) 플로팅 창 제어 전담 훅.
 * App.tsx에 산재해 있던 YouTube PiP 드래그/위치 상태와 이벤트 핸들러를 격리한다.
 *
 * [포함 로직]
 * - PiP 비디오 ID 상태
 * - 플로팅 위치 상태 및 드래그 핸들러
 * - 전역 AMEVA_TRIGGER_YOUTUBE_PIP API 바인딩
 */

import { useState, useEffect } from 'react'

/** PiP 드래그 핸들러 파라미터 */
export interface PiPMouseDownParams {
  e: React.MouseEvent
  pipPosition: { x: number; y: number }
  setIsDraggingPip: (val: boolean) => void
  setDragOffset: (val: { x: number; y: number }) => void
}

/**
 * useYoutubePiP
 * YouTube PiP 상태 및 드래그 이벤트를 관리한다.
 *
 * @returns PiP 상태 및 핸들러 집합
 */
export function useYoutubePiP() {
  const [pipVideoId, setPipVideoId] = useState<string | null>(null)
  const [pipPosition, setPipPosition] = useState({
    x: Math.max(0, window.innerWidth - 380),
    y: Math.max(0, window.innerHeight - 260)
  })
  const [isDraggingPip, setIsDraggingPip] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // 전역 PiP 트리거 API 바인딩
  useEffect(() => {
    (window as any).AMEVA_TRIGGER_YOUTUBE_PIP = (videoId: string) => {
      setPipVideoId(videoId)
    }
    return () => {
      delete (window as any).AMEVA_TRIGGER_YOUTUBE_PIP
    }
  }, [])

  // 드래그 mousemove / mouseup 이벤트 처리
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPip) return
      setPipPosition({
        x: Math.max(10, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x)),
        y: Math.max(10, Math.min(window.innerHeight - 240, e.clientY - dragOffset.y))
      })
    }

    const handleMouseUp = () => {
      if (isDraggingPip) setIsDraggingPip(false)
    }

    if (isDraggingPip) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPip, dragOffset])

  /**
   * handlePiPMouseDown
   * PiP 드래그 시작 이벤트 핸들러.
   */
  const handlePiPMouseDown = (e: React.MouseEvent) => {
    setIsDraggingPip(true)
    setDragOffset({
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y
    })
  }

  return {
    pipVideoId,
    setPipVideoId,
    pipPosition,
    isDraggingPip,
    handlePiPMouseDown
  }
}
