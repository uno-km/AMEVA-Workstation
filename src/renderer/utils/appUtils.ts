/**
 * @file appUtils.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/appUtils.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

export const matchHotkey = (e: KeyboardEvent, hotkeyStr: string) => {
  if (!hotkeyStr) return false
  
  const parts = hotkeyStr.toLowerCase().split('+')
  const key = parts.pop()
  
  const needCtrl = parts.includes('control') || parts.includes('ctrl')
  const needShift = parts.includes('shift')
  const needAlt = parts.includes('alt')
  const needMeta = parts.includes('meta') || parts.includes('cmd')
  
  const hasCtrl = e.ctrlKey || e.metaKey
  const hasShift = e.shiftKey
  const hasAlt = e.altKey
  const hasMeta = e.metaKey
  
  if (needCtrl && !hasCtrl) return false
  if (needShift && !hasShift) return false
  if (needAlt && !hasAlt) return false
  if (needMeta && !hasMeta) return false
  
  if (!needCtrl && hasCtrl) return false
  if (!needShift && hasShift) return false
  
  return e.key.toLowerCase() === key
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
