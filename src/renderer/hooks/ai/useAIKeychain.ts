
import { useState, useRef, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { analyzeApiKey } from '../../services/ai/analyzeApiKey'

export function useAIKeychain(apiType: string, apiProvider: string, apiKey: string, onUpdateSettings: (s: any) => void) {
  const isApiKeyLoadedRef = useRef<Record<string, boolean>>({})
  const [isKeySaved, setIsKeySaved] = useState<Record<string, boolean>>({})

  // 1. 마운트 및 프로바이더 변경 시 OS 키체인 연동
  useEffect(() => {
    if (!ipc.isElectronEnv() || apiType !== 'api') return
    if (isApiKeyLoadedRef.current[apiProvider]) return

    const loadSavedApiKey = async () => {
      let keychainKey = 'openai-api-key'
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'custom') return

      const savedKey = await ipc.keychainGet(keychainKey)
      if (savedKey) {
        isApiKeyLoadedRef.current[apiProvider] = true
        setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
        if (savedKey !== apiKey) {
          onUpdateSettings({ apiKey: savedKey })
        }
      }
    }
    loadSavedApiKey()
  }, [apiProvider, apiType, apiKey, onUpdateSettings])

  // 2. 수동 키 저장
  const handleSaveKey = async () => {
    if (!ipc.isElectronEnv() || !apiKey) return
    let keychainKey = 'openai-api-key'
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainSet(keychainKey, apiKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
  }

  // 3. 수동 키 삭제
  const handleDeleteKey = async () => {
    if (!ipc.isElectronEnv()) return
    let keychainKey = 'openai-api-key'
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainDelete(keychainKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: false }))
    onUpdateSettings({ apiKey: '' })
  }

  // 4. 입력 시 프로바이더 자동 변경 로직 (휴리스틱)
  const handleApiKeyChange = (val: string) => {
    const analysis = analyzeApiKey(val)
    if (analysis.provider !== 'unknown') {
      onUpdateSettings({
        apiKey: val,
        apiEndpoint: analysis.endpoint,
        apiModel: analysis.defaultModel
      })
    } else {
      onUpdateSettings({ apiKey: val })
    }
  }

  return { isKeySaved, handleSaveKey, handleDeleteKey, handleApiKeyChange }
}
