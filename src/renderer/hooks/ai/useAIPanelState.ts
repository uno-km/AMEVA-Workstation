/**
 * @file useAIPanelState.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIPanelState.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */


import { useState, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIPanelState(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const [input, setInput] = useState('')
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [useContext, setUseContext] = useState(true)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [gpuName] = useState('')

  // 커스텀 이벤트 (우클릭 등)로 텍스트 주입
  useEffect(() => {
    const handleFillInput = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) {
        setInput(customEvent.detail)
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 50)
      }
    }
    window.addEventListener('ameva:fill-ai-input', handleFillInput)
    return () => {
      window.removeEventListener('ameva:fill-ai-input', handleFillInput)
    }
  }, [textareaRef])

  // GPU 정보 스캔
  useEffect(() => {
    if (ipc.isElectronEnv()) {
      ipc.llmCheckHealth().then(() => {
        // Fallback for GPU info if needed, or if an endpoint exists.
        // We will just leave it empty if there's no direct GPU getter.
      })
    }
  }, [])

  return {
    input, setInput,
    manualMode, setManualMode,
    useContext, setUseContext,
    isLogsExpanded, setIsLogsExpanded,
    gpuName
  }
}
