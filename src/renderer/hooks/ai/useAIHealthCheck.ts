import { useEffect, useRef } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIHealthCheck(
  settings: AISettings,
  setIsAvailable: (val: boolean) => void
) {
  const failCountRef = useRef(0)

  useEffect(() => {
    failCountRef.current = 0

    // [FIX-FLICKER-007] wasm 모드는 브라우저 내부에서 실행되므로
    // 별도의 서버 헬스체크 없이 항상 사용 가능 상태로 간주한다.
    if (settings.apiType === 'wasm') {
      setIsAvailable(true)
      return
    }

    // [FIX-FLICKER-API] API 모드도 항상 사용 가능으로 처리.
    if (settings.apiType === 'api') {
      setIsAvailable(true)
      return
    }

    const checkHealth = async () => {
      const type = settings.apiType || 'local'

      const handleSuccess = () => {
        failCountRef.current = 0
        setIsAvailable(true)
      }

      // [FIX-FLICKER-001] fail threshold를 5로 높여서 일시적인 응답 지연(토큰 생성 중 등)으로
      // UI가 offline으로 전환되는 깜빡임을 방지한다.
      const handleFail = () => {
        failCountRef.current += 1
        if (failCountRef.current >= 5) {
          setIsAvailable(false)
        }
      }

      if (type === 'ollama') {
        try {
          const ep = settings.apiEndpoint || 'http://127.0.0.1:11434'
          const res = await fetch(`${ep}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
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

      // 'local' 모드: llama-server IPC 헬스 체크
      // isStarting 플래그가 true이면 'loading model'을 반환하여 handleSuccess로 처리됨.
      const result = await ipc.llmCheckHealth()
      
      if (result.status === 'ok' || result.status === 'loading model') {
        handleSuccess()
      } else {
        handleFail()
      }
    }

    checkHealth()
    const timer = setInterval(checkHealth, 5000)
    return () => clearInterval(timer)
  }, [settings.apiType, settings.apiEndpoint, setIsAvailable])
}
