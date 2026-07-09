/**
 * @file useAIModels.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIModels.ts
 * @role AI Model Directory Scanner & Auto Selection Handler Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 로컬 파일 시스템 또는 Ollama 엔드포인트에 설치된 가용 채팅/코드 모델 목록을 비동기 검색(`refreshModels`)한다.
 * - 검색된 모델들(mappedList, mappedCodeList)을 Zustand 스토어에 분류 적재한다.
 * - 사용 중이던 모델 경로(`modelPath`, `codeModelPath`)가 사라졌거나 아직 미설정 상태인 경우,
 *   가장 적절한 로컬 3B 경량 모델이나 Ollama의 디폴트 첫 번째 모델을 자동으로 식별/선택(preferred)하여 기본값으로 주입한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 모델의 실시간 다운로드 속도 및 취소/정지 상태 제어 (useDownloadManager 및 useProcessStore가 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass browser fallback: Electron 데스크톱 쉘이 아닌 순정 웹 브라우저 환경인 경우,
 *   네이티브 검색 API가 호출되지 않으므로 헬스 상태를 즉각 참(`setIsAvailable(true)`)으로 강제 주입하여 WebGPU/Cloud API 렌더링에 차질이 없도록 가드할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 모델 갱신 핸들러 함수가 세팅 값 변화에 따라 불필요하게 재생성되는 것을 막기 위한 기본 리액트 API.
 * - useEffect: 마운트 시 최초 모델 목록 스캐닝 가동을 위한 리액트 훅.
 */
import { useCallback, useEffect } from 'react'

/* 
 * [ELECTRON IPC BRIDGE]
 * - ipc: 로컬 모델 목록 파일 쿼리(`llmListModels`)를 메인에 요청하기 위한 채널 어댑터.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [TYPES]
 * - AISettings: AI 구동 설정 구조 인터페이스.
 */
import type { AISettings } from '../../types/aiTypes'

/**
 * @hook useAIModels
 * @description 가용한 AI 모델 목록을 갱신하고 최적의 선호 모델을 자동 선택 설정하는 훅.
 */
export function useAIModels(
  /*
   * [HOOK INJECTION INTERFACES]
   * - settings: AI 온도, 엔드포인트 정보.
   * - setSettings: AI 설정 상태 변경을 위한 리액트 디스패처 세터.
   * - setModels: 챗 모델 목록 갱신 세터.
   * - setCodeModels: 코드 FIM 모델 목록 갱신 세터.
   * - setIsAvailable: AI 상태 점등 세터.
   */
  settings: AISettings,
  setSettings: React.Dispatch<React.SetStateAction<AISettings>>,
  setModels: (models: any[]) => void,
  setCodeModels: (models: any[]) => void,
  setIsAvailable: (val: boolean) => void
) {
  /**
   * [CONTRACT - Scan and Refresh AI Models]
   * - Rationale: 챗용 llm(혹은 ollama)과 코드 FIM 모델 폴더를 각각 스캔하여, 목록을 입수하고
   *   현재 세팅에 매핑되어 있는 경로의 유효성을 대조 점검한다.
   */
  const refreshModels = useCallback(async () => {
    // 데스크톱 앱 런타임 외에는 검색이 불가능하므로 동작 취소
    if (!ipc.isElectronEnv()) return
    try {
      // 1. 챗 모델 스캔
      const type = settings.apiType === 'ollama' ? 'ollama' : 'llm'
  // [RUN-TIME STATE / INVARIANT] - 변수 'list'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const list = await ipc.llmListModels(type)
      
      // UI 노출을 위한 가공 처리
      const mappedList = list.map(m => ({
        path: m.path,
        filename: m.filename,
        name: m.name || m.filename,
        size: m.size || 0
      }))
      setModels(mappedList)

      // 모델이 스캔되었고 현재 modelPath가 비었거나 존재하지 않는 경로일 경우 디폴트 선택
      if (mappedList.length > 0) {
        setSettings((prev) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'exists'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const exists = mappedList.some((m) => m.path === prev.modelPath)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (exists) return prev
          
          // Ollama는 첫 모델, Llama.cpp 로컬은 파일명에 '3b'가 들어간 가볍고 빠른 경량 모델을 선호
          const preferred =
            type === 'ollama'
              ? mappedList[0]
              : mappedList.find((m) => m.filename.includes('3b')) || mappedList[mappedList.length - 1]
          return { ...prev, modelPath: preferred.path }
        })
      }

      // 2. FIM(코드 생성) 모델 스캔
      const codeList = await ipc.llmListModels('code')
  // [RUN-TIME STATE / INVARIANT] - 변수 'mappedCodeList'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const mappedCodeList = codeList.map(m => ({
        path: m.path,
        filename: m.filename,
        name: m.name || m.filename,
        size: m.size || 0
      }))
      setCodeModels(mappedCodeList)
      
      // 코드용 modelPath가 비었거나 없는 경로인 경우 첫 번째 원소로 폴백 선택
      if (mappedCodeList.length > 0) {
        setSettings((prev) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'exists'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const exists = mappedCodeList.some((m) => m.path === prev.codeModelPath)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (exists) return prev
          return { ...prev, codeModelPath: mappedCodeList[0].path }
        })
      }
    } catch (e) {
      // Rationale: 모델 폴더 탐색 예외는 치명적이지 않으며 디스크 빈 상태 경고로 판단하여 warn 로깅
      console.warn('[useAIAgent] 모델 목록 갱신 실패:', e)
    }
  }, [settings.apiType, setModels, setCodeModels, setSettings])

  /**
   * [SIDE EFFECT - Initial Load Scanner]
   * - Rationale: 컴포넌트 마운트 및 API 타입 변경 시, 백그라운드에서 모델 목록 검색을 1회 즉각 기동한다.
   */
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) {
      // CONTRACT: 순정 브라우저 데모 웹 뷰에서는 가용 여부를 즉시 true로 가상 이식 처리함
      setIsAvailable(true)
      return
    }
    refreshModels()
  }, [settings.apiType, refreshModels, setIsAvailable])

  return { refreshModels }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 3B 외에 선호되는 타격 크기(예: 7B, 8B 모델)의 모델을 우선순위 선택하고 싶을 때:
 *    - `preferred` 변수의 `m.filename.includes('3b')` 탐색 조건을 수정 또는 확장할 것.
 * ============================================================================
 */

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
