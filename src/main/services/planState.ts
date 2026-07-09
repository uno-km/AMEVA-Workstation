/**
 * @file planState.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/services/planState.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
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
 * AMEVA OS 플랜 상태 및 무료/프로 모드 관리 서비스
 */

// [BM-FREE-MODE] 시작 아규먼트 또는 npm config를 통한 --free 존재 여부 확인
export const isFreeModeRequested: boolean = 
  process.argv.includes('--free') || 
  process.argv.some(arg => arg.includes('free')) ||
  process.env.FREE_MODE === 'true' ||
  process.env.npm_config_free === 'true' // npm run dev --free 감지

// 메인 프로세스 측의 실제 플랜 상태 (데모 모드 시 항상 false 강제)
let isProPlanMemory: boolean = !isFreeModeRequested

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `getProPlanMemory`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `getProPlanMemory(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function getProPlanMemory(): boolean {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isFreeModeRequested`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isFreeModeRequested)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isFreeModeRequested) return false
  return isProPlanMemory
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `setProPlanMemory`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `setProPlanMemory(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function setProPlanMemory(isPro: boolean): boolean {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isFreeModeRequested`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isFreeModeRequested)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (isFreeModeRequested) {
    isProPlanMemory = false
  } else {
    isProPlanMemory = isPro
  }
  return isProPlanMemory
}

