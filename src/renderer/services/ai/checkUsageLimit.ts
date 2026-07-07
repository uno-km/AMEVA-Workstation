/**
 * checkUsageLimit.ts
 *
 * 무료 플랜 사용자 대상 일일 AI 생성 횟수 제한 체크 유틸리티.
 * LocalStorage 기반으로 날짜별 사용 횟수를 추적하며,
 * 로컬/개인 API 키 사용자는 제한 면제(Bypass) 처리된다.
 */

import type { AISettings } from '../../types/aiTypes'

/** 무료 플랜 일일 최대 클라우드 AI 호출 횟수 */
const FREE_PLAN_DAILY_LIMIT = 10

/** LocalStorage 키 상수 */
const STORAGE_KEY_DATE = 'ai-usage-date'
const STORAGE_KEY_COUNT = 'ai-daily-usage-count'

/**
 * UsageLimitCheckResult
 * 사용 한도 체크 결과 타입.
 */
export interface UsageLimitCheckResult {
  /** 한도 초과 여부 */
  isLimitExceeded: boolean
  /** 현재 사용 횟수 */
  currentCount: number
  /** 한도 초과인 경우 사용자에게 표시할 메시지 */
  limitMessage?: string
}

/**
 * checkUsageLimit
 * 무료 플랜 사용자의 일일 AI 생성 횟수 제한을 확인하고, 초과 시 메시지를 반환한다.
 * 로컬 모델 또는 개인 API 키 사용 시에는 제한을 적용하지 않는다.
 *
 * @param isPro - Pro 플랜 여부
 * @param settings - 현재 AI 설정 (apiType, apiKey 판별에 사용)
 * @returns UsageLimitCheckResult
 */
export function checkUsageLimit(
  isPro: boolean,
  settings: Pick<AISettings, 'apiType' | 'apiKey'>
): UsageLimitCheckResult {
  // Pro 플랜이면 무조건 통과
  if (isPro) {
    return { isLimitExceeded: false, currentCount: 0 }
  }

  // 로컬 모델 또는 개인 API 키 사용자는 제한 면제
  const isLocalModel =
    settings.apiType === 'local' ||
    settings.apiType === 'wasm' ||
    settings.apiType === 'ollama'
  const isPersonalApiKey =
    settings.apiType === 'api' &&
    !!settings.apiKey &&
    settings.apiKey.trim() !== ''

  if (isLocalModel || isPersonalApiKey) {
    return { isLimitExceeded: false, currentCount: 0 }
  }

  // 날짜별 사용 횟수 조회 및 초기화
  const todayStr = new Date().toISOString().split('T')[0]
  let usageCount: number

  try {
    const lastDate = localStorage.getItem(STORAGE_KEY_DATE)
    const rawCount = localStorage.getItem(STORAGE_KEY_COUNT)

    if (lastDate !== todayStr) {
      // 날짜가 바뀌었으면 카운터 리셋
      localStorage.setItem(STORAGE_KEY_DATE, todayStr)
      localStorage.setItem(STORAGE_KEY_COUNT, '0')
      usageCount = 0
    } else {
      usageCount = parseInt(rawCount || '0', 10)
    }
  } catch (e) {
    console.error('[checkUsageLimit] LocalStorage 접근 실패:', e)
    // LocalStorage 접근 실패 시 제한 없이 통과 (안전한 폴백)
    return { isLimitExceeded: false, currentCount: 0 }
  }

  if (usageCount >= FREE_PLAN_DAILY_LIMIT) {
    return {
      isLimitExceeded: true,
      currentCount: usageCount,
      limitMessage:
        `❌ **[무료 요금제 한도 도달]** 무료 플랜의 일일 클라우드 프록시 AI 생성 한도(${FREE_PLAN_DAILY_LIMIT}회)를 모두 소진하셨습니다. ` +
        `계속 이용하시려면 개인 API Key를 등록하거나, Ollama/Local GGUF 등의 로컬 모델을 구동하거나, Pro Plan으로 업그레이드해주세요.`
    }
  }

  return { isLimitExceeded: false, currentCount: usageCount }
}

/**
 * incrementUsageCount
 * AI 생성 성공 시 호출하여 일일 사용 횟수를 1 증가시킨다.
 * 날짜 체크 후 당일 카운트만 증가하며, LocalStorage 오류 시 로그를 남기고 무시한다.
 */
export function incrementUsageCount(): void {
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const lastDate = localStorage.getItem(STORAGE_KEY_DATE)
    const rawCount = localStorage.getItem(STORAGE_KEY_COUNT)

    let count = 0
    if (lastDate === todayStr) {
      count = parseInt(rawCount || '0', 10)
    }

    localStorage.setItem(STORAGE_KEY_DATE, todayStr)
    localStorage.setItem(STORAGE_KEY_COUNT, String(count + 1))
  } catch (e) {
    console.error('[incrementUsageCount] LocalStorage 쓰기 실패:', e)
  }
}
