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

export function getProPlanMemory(): boolean {
  if (isFreeModeRequested) return false
  return isProPlanMemory
}

export function setProPlanMemory(isPro: boolean): boolean {
  if (isFreeModeRequested) {
    isProPlanMemory = false
  } else {
    isProPlanMemory = isPro
  }
  return isProPlanMemory
}
