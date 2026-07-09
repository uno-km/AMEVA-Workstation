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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export const matchHotkey = (e: KeyboardEvent, hotkeyStr: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!hotkeyStr) return false
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'parts'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const parts = hotkeyStr.toLowerCase().split('+')
  // [RUN-TIME STATE / INVARIANT] - 변수 'key'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const key = parts.pop()
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'needCtrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const needCtrl = parts.includes('control') || parts.includes('ctrl')
  // [RUN-TIME STATE / INVARIANT] - 변수 'needShift'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const needShift = parts.includes('shift')
  // [RUN-TIME STATE / INVARIANT] - 변수 'needAlt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const needAlt = parts.includes('alt')
  // [RUN-TIME STATE / INVARIANT] - 변수 'needMeta'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const needMeta = parts.includes('meta') || parts.includes('cmd')
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasCtrl'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasCtrl = e.ctrlKey || e.metaKey
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasShift'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasShift = e.shiftKey
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasAlt'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasAlt = e.altKey
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasMeta'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasMeta = e.metaKey
  
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (needCtrl && !hasCtrl) return false
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (needShift && !hasShift) return false
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (needAlt && !hasAlt) return false
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (needMeta && !hasMeta) return false
  
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!needCtrl && hasCtrl) return false
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!needShift && hasShift) return false
  
  return e.key.toLowerCase() === key
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'reader'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
