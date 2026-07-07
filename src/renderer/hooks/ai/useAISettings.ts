import { useState, useCallback } from 'react'
import type { AISettings } from '../../types/aiTypes'
import { DEFAULT_SETTINGS } from '../../types/aiTypes'

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem('ai-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        // 구버전 시스템 프롬프트 마이그레이션: fake thought 지침이 있거나 CoT 지침 누락 시 교체
        if (parsed.systemPrompt && (
          parsed.systemPrompt.includes('간결하고 명확하게 답하세요') ||
          parsed.systemPrompt.includes('친근하고 유연하게') ||
          parsed.systemPrompt.includes('AMEVA AI입니다.') ||
          !parsed.systemPrompt.includes('한국어 답변') ||
          !parsed.systemPrompt.includes('INSERT_SUGGESTION') ||
          !parsed.systemPrompt.includes('CoT 사고 과정 지침') ||
          parsed.systemPrompt.includes('<thought>')
        )) {
          parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt
          localStorage.setItem('ai-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.error('[useAIAgent] 설정 로드 실패:', e)
    }
    return DEFAULT_SETTINGS
  })

  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        // API Key는 LocalStorage에 저장하지 않음 (보안: 메모리 전용)
        const { apiKey: _apiKey, ...safeSettings } = updated
        localStorage.setItem('ai-settings', JSON.stringify(safeSettings))
      } catch (e) {
        console.error('[useAIAgent] 설정 저장 실패:', e)
      }
      return updated
    })
  }, [])

  return { settings, setSettings, updateSettings }
}
