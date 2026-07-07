
import { useState, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIPanelState(textareaRef: React.RefObject<HTMLTextAreaElement>) {
  const [input, setInput] = useState('')
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [useContext, setUseContext] = useState(true)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [gpuName, setGpuName] = useState('')

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
      ipc.llmCheckHealth().then(res => {
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
    showSettings, setShowSettings,
    gpuName
  }
}
