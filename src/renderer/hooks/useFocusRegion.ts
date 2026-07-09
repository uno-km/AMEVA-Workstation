/**
 * @file useFocusRegion.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/useFocusRegion.ts
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
 * useFocusRegion.ts
 * ─────────────────────────────────────────────────────────────
 * focusRegion 모듈의 React 바인딩 훅
 *
 * 사용법:
 *   const isActive = useFocusRegion('editor')
 *   // → 해당 region이 활성화되면 true 반환
 *
 * 직접 활성화:
 *   const { isActive, activate } = useFocusRegion('my-panel')
 *   activate()  // 프로그래매틱하게 활성화
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react'
import { subscribe, getActiveId, activate as coreActivate } from '../lib/focusRegion'

export function useFocusRegion(regionId: string) {
  const [isActive, setIsActive] = useState(() => getActiveId() === regionId)

  useEffect(() => {
    // 초기 동기화
    setIsActive(getActiveId() === regionId)
    // 구독
    return subscribe((id) => setIsActive(id === regionId))
  }, [regionId])

  const activate = useCallback(() => {
    coreActivate(regionId)
  }, [regionId])

  return { isActive, activate }
}

/**
 * 현재 활성 region ID 구독 (어떤 region이 활성인지 범용 조회)
 */
export function useActiveRegion(): string | null {
  const [activeId, setActiveId] = useState<string | null>(getActiveId)

  useEffect(() => {
    return subscribe(setActiveId)
  }, [])

  return activeId
}
