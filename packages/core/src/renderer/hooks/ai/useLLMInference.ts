import { useState, useCallback } from 'react'
import { useAppContext } from '../../contexts/AppContext'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { WebLLMEngine } from '../../services/ai/WebLLMEngine'
import { useAIIpc } from './useAIIpc'

export function useLLMInference() {
  const { settings } = useAppContext()
  const { subscribeSession, unsubscribeSession } = useAIIpc()
  const [isGenerating, setIsGenerating] = useState(false)
  
  const generate = useCallback(async (
    prompt: string, 
    onToken: (token: string) => void,
    systemPrompt: string = 'You are a helpful AI assistant.'
  ): Promise<string> => {
    setIsGenerating(true)
    const sessId = crypto.randomUUID()
    
    try {
      if (settings?.apiType === 'wasm') {
        const webLLM = WebLLMEngine.getInstance()
        const history = [{ role: 'user' as const, content: prompt }]
        const finalAnswer = await webLLM.generateStream(
          history,
          {
            systemPrompt,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            gpuOnly: settings.gpuOnly
          },
          (tokenText: string) => {
            onToken(tokenText)
          }
        )
        setIsGenerating(false)
        return finalAnswer
      } else {
        // For ollama, local, api
        return new Promise<string>(async (resolve, reject) => {
          let accumulated = ''
          subscribeSession(
            sessId,
            (token) => {
              accumulated += token
              onToken(token)
            },
            (data) => {
              setIsGenerating(false)
              unsubscribeSession(sessId)
              if (data.success) {
                resolve(data.text || accumulated)
              } else {
                reject(new Error(data.error || 'Generation failed'))
              }
            }
          )
          
          const result = await ipc.llmGenerate({
            sessionId: sessId,
            modelPath: settings?.modelPath || '',
            prompt,
            systemPrompt,
            maxTokens: settings?.maxTokens,
            temperature: settings?.temperature,
            apiType: settings?.apiType || 'ollama',
            apiKey: settings?.apiKey,
            apiEndpoint: settings?.apiEndpoint,
            apiModel: settings?.apiModel,
            gpuOnly: settings?.gpuOnly,
            history: []
          })
          
          if (!result.success && result.error) {
            setIsGenerating(false)
            unsubscribeSession(sessId)
            reject(new Error(result.error))
          }
        })
      }
    } catch (e) {
      setIsGenerating(false)
      throw e
    }
  }, [settings, subscribeSession, unsubscribeSession])
  
  return { generate, isGenerating }
}
