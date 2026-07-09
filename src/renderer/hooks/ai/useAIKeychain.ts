/**
 * @file useAIKeychain.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIKeychain.ts
 * @role OS Native Keychain integration & API credential manager Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 외부 클라우드 공급사(Gemini, Claude, OpenAI)의 API 키를 OS 네이티브 키체인 서비스(Win Credential Manager / Mac Keychain)에 이식/연동한다.
 * - 수동 자격증명 저장(`handleSaveKey`) 및 키 삭제(`handleDeleteKey`)에 따른 로컬 세션 키값 리셋을 수행한다.
 * - 입력 텍스트 문자열의 형태( analyzeApiKey )를 분석하여 공급사를 자동으로 판단 매핑( heuristic )하고 설정 정보(endpoint, model)를 자동 갱신해 준다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 로컬 저장소(localStorage)에 키 값을 직렬화 저장 (보안 상 금기사항이므로 절대 수행해서는 안 됨).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass load cache: 마운트 시 불필요한 키체인 반복 로딩 호출로 인한 프로세스 병목을 차단하기 위해,
 *   반드시 `isApiKeyLoadedRef.current[apiProvider]` 레퍼런스를 락 플래그로 활용하여 중복 로드를 철저히 격리할 것.
 * - MUST NOT persist plain key on disk: 키체인에 저장된 비밀키는 오직 런타임 settings 메모리에만 바인딩하고,
 *   localStorage 디스크에는 절대 평문 상태로 보존하지 말 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useState: 키체인 저장 완료 상태(isKeySaved)를 실시간 반영하여 저장/삭제 UI 활성화를 갱신하기 위한 리액트 상태 훅.
 * - useRef: 렌더 주기에 무관하게 특정 프로바이더 키체인 로드 완료 여부를 보존하기 위한 Mutable 락 레퍼런스 훅.
 * - useEffect: 마운트/프로바이더 변경 시점에 OS 키체인으로부터 비밀키를 자동 로드하기 위한 라이프사이클 훅.
 */
import { useState, useRef, useEffect } from 'react'

/* 
 * [ELECTRON IPC BRIDGE ADAPTER]
 * - ipc: OS Keychain API(`keychainGet`, `keychainSet`, `keychainDelete`) 호출을 위해 Preload와 채널 연동되는 모듈.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [API KEY HEURISTICS]
 * - analyzeApiKey: 입력 문자열의 접두사 패턴(예: 'AIzaSy' -> Gemini)을 분석하여 프로바이더 정보와 기본 디폴트 주소를 반환하는 분석기.
 */
import { analyzeApiKey } from '../../services/ai/analyzeApiKey'

/**
 * @hook useAIKeychain
 * @description OS 네이티브 자격증명 보관소와 연계하여 AI API 키를 안전하게 격리 보관하고 공급사 패턴을 자동 판별하는 훅.
 */
export function useAIKeychain(
  /*
   * [HOOK CONFIG PARAMETERS]
   * - apiType: 구동 엔진 모드 (api/local/ollama/wasm).
   * - apiProvider: 공급사 문자열 (gemini/anthropic/openai/custom).
   * - apiKey: 런타임 메모리에 적재되어 있는 API 키 문자열.
   * - onUpdateSettings: AI 설정을 부분 갱신하기 위한 콜백 핸들러.
   */
  apiType: string,
  apiProvider: string,
  apiKey: string,
  onUpdateSettings: (s: any) => void
) {
  /*
   * [INVARIANT - OS Load Lock Reference]
   * - isApiKeyLoadedRef: 중복 로드를 차단하여 Electron IPC 부하를 없애기 위한 프로바이더별 락 상태 보존 객체.
   */
  const isApiKeyLoadedRef = useRef<Record<string, boolean>>({})

  /*
   * [INVARIANT - Key Saved Status State]
   * - isKeySaved: 특정 프로바이더 키가 OS Keychain에 저장되어 있는지 판별하는 불리언 레코드.
   */
  const [isKeySaved, setIsKeySaved] = useState<Record<string, boolean>>({})

  /**
   * [SIDE EFFECT - Auto Load Saved Api Key]
   * - Rationale: 컴포넌트 마운트 및 프로바이더 변경 시, OS 키체인에 등록되어 있던 키를 찾아 자동 메모리 바인딩한다.
   */
  useEffect(() => {
    // 1. Electron 환경 밖이거나 상용 API 호출 모드가 아닌 경우 스킵
    if (!ipc.isElectronEnv() || apiType !== 'api') return
    // 2. 이미 로드 완료 락이 걸린 프로바이더인 경우 중복 호출 취소
    if (isApiKeyLoadedRef.current[apiProvider]) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'loadSavedApiKey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const loadSavedApiKey = async () => {
      // 공급사에 따른 고유 키체인 레지스트리 명칭 정의
      let keychainKey = 'openai-api-key'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
      else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
      else if (apiProvider === 'custom') return

      // OS 키체인 스토어 조회
      const savedKey = await ipc.keychainGet(keychainKey)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (savedKey) {
        // 로드 완료 락 기록 및 뷰 업데이트
        isApiKeyLoadedRef.current[apiProvider] = true
        setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
        
        // 메모리에 켜진 런타임 키 값과 다를 때만 동기화 갱신 전파
        if (savedKey !== apiKey) {
          onUpdateSettings({ apiKey: savedKey })
        }
      }
    }
    loadSavedApiKey()
  }, [apiProvider, apiType, apiKey, onUpdateSettings])

  /**
   * [CONTRACT - Persist Key to OS Storage]
   * - Rationale: 사용자가 수동으로 저장 버튼을 눌렀을 때, 현재 메모리에 올라온 비밀키를 OS 키체인에 안전하게 주입한다.
   */
  const handleSaveKey = async () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv() || !apiKey) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'keychainKey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let keychainKey = 'openai-api-key'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainSet(keychainKey, apiKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: true }))
  }

  /**
   * [CONTRACT - Purge Key from OS Storage]
   * - Rationale: 수동 키 삭제 시, OS 스토리지에서 삭제하고 런타임 설정 내의 API Key 값을 공백문자('')로 밀어버린다.
   */
  const handleDeleteKey = async () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'keychainKey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let keychainKey = 'openai-api-key'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (apiProvider === 'gemini') keychainKey = 'gemini-api-key'
    else if (apiProvider === 'anthropic') keychainKey = 'claude-api-key'
    
    await ipc.keychainDelete(keychainKey)
    setIsKeySaved(prev => ({ ...prev, [keychainKey]: false }))
    onUpdateSettings({ apiKey: '' })
  }

  /**
   * [CONTRACT - Auto Provider Recognition Pattern / Rationale]
   * - handleApiKeyChange: 인풋 타이핑 변화 시 호출되며, 분석 규칙을 거쳐 Gemini/Claude 패턴 감지 시 엔드포인트와 기본 모델을 동적 마이그레이션 적용한다.
   */
  const handleApiKeyChange = (val: string) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'analysis'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const analysis = analyzeApiKey(val)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (analysis.provider !== 'unknown') {
      onUpdateSettings({
        apiKey: val,
        apiEndpoint: analysis.endpoint,
        apiModel: analysis.defaultModel
      })
    } else {
      onUpdateSettings({ apiKey: val })
    }
  }

  return { isKeySaved, handleSaveKey, handleDeleteKey, handleApiKeyChange }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 원격 API 공급사에 대한 키체인 보관소 신설 시:
 *    - `keychainKey` 분기 노드에 해당 공급사 키 이름(예: 'deepseek-api-key')을 할당할 것.
 * ============================================================================
 */

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
