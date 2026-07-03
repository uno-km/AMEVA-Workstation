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
