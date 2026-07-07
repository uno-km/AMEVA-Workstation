
import { useEffect } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'

export function useAIModelHub(showModelHub: boolean, refreshModels?: () => Promise<void>, setDownloadStatus?: (val: any) => void) {
  useEffect(() => {
    if (showModelHub && refreshModels) {
      refreshModels()
    }
  }, [showModelHub, refreshModels])

  const handleDownloadModel = async (_modelId: string, url: string, filename: string) => {
    if (ipc.isElectronEnv() && setDownloadStatus && ipc.llmDownloadModel) {
      setDownloadStatus({ filename, progress: 0, speed: 0 })
      const res = await ipc.llmDownloadModel({ url, filename })
      if (!res?.success) {
        alert(`다운로드 실패: ${res?.error || '알 수 없는 오류'}`)
        setDownloadStatus(null)
      }
    }
  }

  return { handleDownloadModel }
}
