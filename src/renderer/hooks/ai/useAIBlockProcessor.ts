import { useCallback } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIBlockProcessor(settings: AISettings) {
  const processBlock = useCallback(async (
    action: 'summarize' | 'translate' | 'improve' | 'expand' | 'explain',
    content: string,
    targetLang?: string
  ): Promise<string> => {
    if (!ipc.isElectronEnv()) return ''

    const prompts: Record<string, string> = {
      summarize: `다음 텍스트를 3줄 이내로 핵심만 요약하세요:\n\n${content}`,
      translate: `다음 텍스트를 ${targetLang || '영어'}로 번역하세요. 번역문만 출력하세요:\n\n${content}`,
      improve: `다음 텍스트의 문체와 표현을 개선하세요. 개선된 텍스트만 출력하세요:\n\n${content}`,
      expand: `다음 텍스트를 더 자세하고 풍부하게 확장하세요:\n\n${content}`,
      explain: `다음 내용을 쉽게 설명하세요:\n\n${content}`
    }

    return new Promise<string>((resolve) => {
      let result = ''
      let settled = false
      const sessId = `quick-${Date.now()}`

      const cleanup = (unsubToken: () => void, unsubDone: () => void) => {
        if (!settled) {
          settled = true
          unsubToken()
          unsubDone()
        }
      }

      // 리스너를 먼저 등록 후 요청 (레이스 컨디션 방지)
      const unsubToken = ipc.onLLMToken(sessId, (token) => {
        if (!settled) result += token
      })
      const unsubDone = ipc.onLLMDone(sessId, (data) => {
        if (settled) return
        cleanup(unsubToken, unsubDone)
        resolve(data.success ? result.trim() : (data.error || ''))
      })

      // 60초 타임아웃 안전망
      const timeoutId = setTimeout(() => {
        if (!settled) {
          cleanup(unsubToken, unsubDone)
          resolve(result.trim() || '')
        }
      }, 60_000)

      ipc.llmGenerate({
        sessionId: sessId,
        modelPath: settings.modelPath,
        prompt: prompts[action] || content,
        systemPrompt: 'You are a document editing assistant. Output only the requested content without any explanation or preamble.',
        maxTokens: 512,
        temperature: 0.5,
        apiType: settings.apiType === 'wasm' ? 'local' : settings.apiType,
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        apiModel: settings.apiModel,
        gpuOnly: settings.gpuOnly
      }).catch(() => {
        clearTimeout(timeoutId)
        cleanup(unsubToken, unsubDone)
        resolve('')
      })
    })
  }, [settings.modelPath, settings.apiType, settings.apiKey, settings.apiEndpoint, settings.apiModel, settings.gpuOnly])

  return { processBlock }
}
