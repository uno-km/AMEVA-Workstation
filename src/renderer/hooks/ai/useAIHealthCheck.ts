import { useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIHealthCheck(
  settings: AISettings,
  setIsAvailable: (val: boolean) => void
) {
  const failCountRef = React.useRef(0)

  useEffect(() => {
    failCountRef.current = 0

    const checkHealth = async () => {
      const type = settings.apiType || 'local'

      const handleSuccess = () => {
        failCountRef.current = 0
        setIsAvailable(true)
      }

      const handleFail = () => {
        failCountRef.current += 1
        if (failCountRef.current >= 2) {
          setIsAvailable(false)
        }
      }

      if (type === 'api') {
        handleSuccess()
        return
      }

      if (type === 'ollama') {
        try {
          const ep = settings.apiEndpoint || 'http://127.0.0.1:11434'
          const res = await fetch(`${ep}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
          })
          if (res.ok) handleSuccess()
          else handleFail()
        } catch {
          // 커넥션 에러 등 명백한 실패 시 더 빠른 피드백을 위해 바로 반영할 수도 있지만
          // 깜빡임 방지를 위해 failCount 정책을 따릅니다.
          handleFail()
        }
        return
      }

      // 'local' 또는 'wasm' 모드: llama-server 헬스 체크
      const result = await ipc.llmCheckHealth()
      
      if (result.status === 'ok' || result.status === 'loading model') {
        handleSuccess()
      } else {
        handleFail()
      }
    }

    checkHealth()
    const timer = setInterval(checkHealth, 4000)
    return () => clearInterval(timer)
  }, [settings.apiType, setIsAvailable])
}
