import { useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIHealthCheck(
  settings: AISettings,
  setIsAvailable: (val: boolean) => void
) {
  useEffect(() => {
    if (!ipc.isElectronEnv()) return

    const checkHealth = async () => {
      const type = settings.apiType || 'local'

      if (type === 'api') {
        setIsAvailable(true)
        return
      }

      if (type === 'ollama') {
        try {
          const res = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            signal: AbortSignal.timeout(1500)
          })
          setIsAvailable(res.ok)
        } catch {
          setIsAvailable(false)
        }
        return
      }

      // 'local' 또는 'wasm' 모드: llama-server 헬스 체크
      const result = await ipc.llmCheckHealth()
      setIsAvailable(result.status === 'ok' || result.status === 'loading model')
    }

    checkHealth()
    const timer = setInterval(checkHealth, 4000)
    return () => clearInterval(timer)
  }, [settings.apiType, setIsAvailable])
}
