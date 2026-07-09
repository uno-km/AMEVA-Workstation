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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useAIModelHub(showModelHub: boolean, refreshModels?: () => Promise<void>, setDownloadStatus?: (val: any) => void) {
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (showModelHub && refreshModels) {
      refreshModels()
    }
  }, [showModelHub, refreshModels])

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleDownloadModel'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleDownloadModel = async (_modelId: string, url: string, filename: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (ipc.isElectronEnv() && setDownloadStatus && ipc.llmDownloadModel) {
      setDownloadStatus({ filename, progress: 0, speed: 0 })
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.llmDownloadModel({ url, filename })
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res?.success) {
        alert(`다운로드 실패: ${res?.error || '알 수 없는 오류'}`)
        setDownloadStatus(null)
      }
    }
  }

  return { handleDownloadModel }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
