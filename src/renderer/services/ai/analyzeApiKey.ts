/**
 * @file analyzeApiKey.ts
 * @system AMEVA OS Desktop Workstation - AI Integration Services
 * @location src/renderer/services/ai/analyzeApiKey.ts
 * @role Heuristic API Key pattern matcher and provider detector
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/ai/useAISettings.ts): 사용자가 설정 창에서 API 키를 입력하거나 수정할 때, 키의 패턴을 읽어 공급사(Gemini, OpenAI, Anthropic 등)를 Heuristic하게 식별하고 기본 모델 및 안전 엔드포인트를 자동 매핑하는 데 사용.
 * - 소비처 B (src/renderer/services/ai/checkUsageLimit.ts): 입력된 키가 외부 상용 토큰인지, 아니면 무료 로컬 추론 포트 바인딩인지 여부를 필터링 분석할 때 호출.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 입력받은 raw API Key 문자열의 좌우 공백을 제거(`trim`)하고, 정형화된 접두사 리스트(`API_KEY_PATTERNS`)와 매칭 여부를 검출한다.
 * - 접두사 매치 시 해당 공급사에 바인딩된 기본 엔드포인트(`endpoint`), 추천 모델(`defaultModel`), OS 키체인 식별 키(`keychainKey`)를 반환한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 만약 일치하는 패턴이 하나도 발견되지 않았을 경우, 크래시를 내지 말고 반드시 `{ provider: 'unknown' }` 규격 객체를 반환하여 폴백 기동을 유도할 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONSTANTS]
 * - API_KEY_PATTERNS: 각 클라우드 AI 제공사별(sk- 등의) API 키 접두사 패턴 정보 및 기본 모델 매핑 정보 어레이.
 */
import { API_KEY_PATTERNS } from "../../../shared/constants/aiSettings"

/**
 * ApiKeyProvider 타입 별칭 정의.
 * 상수 패턴 리스트 내 provider 리터럴 유니온 타입 추출.
 */
export type ApiKeyProvider = (typeof API_KEY_PATTERNS)[number]['provider']

/**
 * API 키 분석 반환 규격 인터페이스.
 */
export interface ApiKeyAnalysisResult {
  provider: ApiKeyProvider | 'unknown'
  endpoint?: string
  defaultModel?: string
  keychainKey?: string
}

/**
 * @function analyzeApiKey
 * @description 입력된 API Key의 헤더 패턴을 검출하여 적격 AI 벤더 정보를 도출하는 Heuristic 매칭 유틸리티 함수.
 */
export function analyzeApiKey(
  /*
   * [PARAMETER]
   * - apiKey: 사용자가 입력한 API 키 날것의 문자열.
   */
  apiKey: string
): ApiKeyAnalysisResult {
  // 인자 텍스트의 좌우 여백 정제
  const normalizedKey = apiKey.trim()
  
  // 기바인딩된 벤더별 접두사 패턴 순회 매칭
  for (const pattern of API_KEY_PATTERNS) {
    const matched = pattern.prefixes.some((prefix: string) =>
      normalizedKey.startsWith(prefix)
    )
    
    // 매치 성공 시 상세 벤더 정보 조합 반환
    if (matched) {
      return {
        provider: pattern.provider,
        endpoint: pattern.endpoint,
        defaultModel: pattern.defaultModel,
        keychainKey: pattern.keychainKey
      }
    }
  }
  
  // CONTRACT: 매치 실패 시 폴백 규격 반환
  return {
    provider: 'unknown'
  }
}
