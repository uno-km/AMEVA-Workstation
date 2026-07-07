import { useCallback, useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import type { AISettings } from '../../types/aiTypes'

export function useAIModels(
  settings: AISettings,
  setSettings: React.Dispatch<React.SetStateAction<AISettings>>,
  setModels: (models: any[]) => void,
  setCodeModels: (models: any[]) => void,
  setIsAvailable: (val: boolean) => void
) {
  const refreshModels = useCallback(async () => {
    if (!ipc.isElectronEnv()) return
    try {
      const type = settings.apiType === 'ollama' ? 'ollama' : 'llm'
      const list = await ipc.llmListModels(type)
      const mappedList = list.map(m => ({
        path: m.path,
        filename: m.filename,
        name: m.name || m.filename,
        size: m.size || 0
      }))
      setModels(mappedList)

      if (mappedList.length > 0) {
        setSettings((prev) => {
          const exists = mappedList.some((m) => m.path === prev.modelPath)
          if (exists) return prev
          const preferred =
            type === 'ollama'
              ? mappedList[0]
              : mappedList.find((m) => m.filename.includes('3b')) || mappedList[mappedList.length - 1]
          return { ...prev, modelPath: preferred.path }
        })
      }

      const codeList = await ipc.llmListModels('code')
      const mappedCodeList = codeList.map(m => ({
        path: m.path,
        filename: m.filename,
        name: m.name || m.filename,
        size: m.size || 0
      }))
      setCodeModels(mappedCodeList)
      if (mappedCodeList.length > 0) {
        setSettings((prev) => {
          const exists = mappedCodeList.some((m) => m.path === prev.codeModelPath)
          if (exists) return prev
          return { ...prev, codeModelPath: mappedCodeList[0].path }
        })
      }
    } catch (e) {
      console.warn('[useAIAgent] 모델 목록 갱신 실패:', e)
    }
  }, [settings.apiType, setModels, setCodeModels, setSettings])

  // 초기 모델 목록 로드
  useEffect(() => {
    if (!ipc.isElectronEnv()) {
      // 브라우저 환경: WebGPU/클라우드 API/Ollama 모드 가동을 위해 available 처리
      setIsAvailable(true)
      return
    }
    refreshModels()
  }, [settings.apiType, refreshModels, setIsAvailable])

  return { refreshModels }
}
