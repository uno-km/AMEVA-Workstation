/**
 * @file useAIModelHub.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIModelHub.ts
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
