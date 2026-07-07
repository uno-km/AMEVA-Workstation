import { useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIHealthCheck(
  settings: AISettings,
  setIsAvailable: (val: boolean) => void
) {
  useEffect(() => {

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
      
      if (result.status === 'ok' || result.status === 'loading model') {
        setIsAvailable(true)
      } else {
        setIsAvailable(false)
        
        // Lazy On: 백그라운드 자동 기동
        const win = window as any
        if (!win.__ameva_hasAttemptedAutoStart && settings.modelPath) {
          win.__ameva_hasAttemptedAutoStart = true
          console.log('[System] 백그라운드 자동 기동(Lazy On)을 시도합니다.')
          if (ipc.llmAddLog) {
            ipc.llmAddLog({ text: '[System] 백그라운드 자동 기동(Lazy On)을 시작합니다.', prefix: 'System' })
          }
          ipc.llmStart(settings.modelPath).catch(err => console.error('자동 기동 실패:', err))
        }
      }
    }

    checkHealth()
    const timer = setInterval(checkHealth, 4000)
    return () => clearInterval(timer)
  }, [settings.apiType, setIsAvailable])
}
