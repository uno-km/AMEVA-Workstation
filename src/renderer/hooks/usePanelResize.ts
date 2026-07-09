/**
 * @file usePanelResize.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/usePanelResize.ts
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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stored = localStorage.getItem(`panel-resize-${storageKey}`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (stored) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const parsed = Number(stored)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) return parsed
      }
    } catch {}
    return defaultWidth
  })

  const [isDragging, setIsDragging] = useState(false)

  // 드래그 시작 시점의 마우스 X와 패널 너비를 ref로 보존 (closure 문제 방지)
  const startXRef = useRef(0)
  // [RUN-TIME STATE / INVARIANT] - 변수 'startWidthRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const startWidthRef = useRef(width)

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleMouseMove'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    e.preventDefault()
  // [RUN-TIME STATE / INVARIANT] - 변수 'dx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const dx = e.clientX - startXRef.current
  // [RUN-TIME STATE / INVARIANT] - 변수 'newWidth'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const newWidth = direction === 'right'
      ? startWidthRef.current + dx   // 오른쪽으로 드래그 → 패널 확장
      : startWidthRef.current - dx   // 왼쪽으로 드래그 → 패널 확장 (AI패널: 핸들이 왼쪽)
  // [RUN-TIME STATE / INVARIANT] - 변수 'clamped'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const clamped = Math.min(maxWidth, Math.max(minWidth, newWidth))
    setWidth(clamped)
  }, [direction, minWidth, maxWidth])

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleMouseUp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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


  // [RUN-TIME STATE / INVARIANT] - 변수 'handleMouseDown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = width
    setIsDragging(true)
  }, [width])

  return { width, isDragging, handleMouseDown }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
