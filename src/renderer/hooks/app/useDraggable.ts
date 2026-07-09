/**
 * @file useDraggable.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useDraggable.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState, useRef, useEffect, useCallback } from 'react'

interface Position {
  x: number
  y: number
}

/*
 * useDraggable.ts
 *
 * 모달 플로팅 윈도우의 드래그 이동을 제어하는 커스텀 훅.
 *
 * [성능 및 루프 안정성 예방 대책]
 * ─────────────────────────────────────────────────────────────
 * 1. requestAnimationFrame(rAF) 기반 스케줄링 적용:
 *    마우스 이동 이벤트(mousemove)는 브라우저 하드웨어 수준에서 초당 수백 번씩 발생할 수 있다.
 *    이때 매번 setState(setPos)를 무조건 기동하면, 특정 상황에서 리액트의 업데이트 큐가 폭주하여
 *    "Maximum update depth exceeded" 런타임 크래시를 유발할 수 있다.
 *    rAF를 적용해 브라우저 렌더링 프레임(16ms)에 맞춰 업데이트 빈도를 자동 조절(Throttling)한다.
 *
 * 2. 의존성 세분화:
 *    handleMouseDown의 의존성을 pos 객체 레퍼런스가 아닌 pos.x, pos.y 원시 속성 단위로 격리하여
 *    불필요하게 캡처 영역이 흔들려 재생성되는 렌더링 비용을 축소한다.
 *
 * [다음 에이전트 주의사항]
 *   - dragStart.current는 ref 객체이므로 mousemove 리스너 내에서 항상 최신 좌표 오프셋을 읽을 수 있다.
 *   - 의존성 배열에 pos 객체 전체를 지정해 렌더 락이 자주 풀리지 않도록 관리할 것.
 */
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
  }, [pos.x, pos.y])

  useEffect(() => {
    if (!isDragging) return

    let animationFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      // rAF 스케줄러로 브라우저 프레임 레이트와 연동하여 Throttled setState 수행
      animationFrameId = window.requestAnimationFrame(() => {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y
        })
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
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
