import { API_KEY_PATTERNS } from "../../../shared/constants/aiSettings"

export type ApiKeyProvider = (typeof API_KEY_PATTERNS)[number]['provider']

export interface ApiKeyAnalysisResult {
  provider: ApiKeyProvider | 'unknown'
  endpoint?: string
  defaultModel?: string
  keychainKey?: string
}

export function analyzeApiKey(apiKey: string): ApiKeyAnalysisResult {
  const normalizedKey = apiKey.trim()
  for (const pattern of API_KEY_PATTERNS) {
    const matched = pattern.prefixes.some((prefix: string) =>
      normalizedKey.startsWith(prefix)
    )
    if (matched) {
      return {
        provider: pattern.provider,
        endpoint: pattern.endpoint,
        defaultModel: pattern.defaultModel,
        keychainKey: pattern.keychainKey
      }
    }
  }
  return {
    provider: 'unknown'
  }
}
