/**
 * @file useAIEngineLogs.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIEngineLogs.ts
 * @role Local LLM Engine Standard I/O (stdout/stderr) Listener Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Llama.cpp 등 네이티브 AI 프로세스가 터미널 표준 출력(stdout/stderr)으로 뿜어내는 로그 스트림을 감청(`ipc.onLLMLog`)하여 수집한다.
 * - 렌더러 측 브라우저 엔진 콘솔(`console.log`, `console.warn`, `console.error`)을 인터셉트하여,
 *   WebGPU/GPU/WebGL 키워드를 포함한 클라이언트 그래픽 로그를 Electron 메인 프로세스 바이너리 디버그 로그 파일로 리다이렉트(`ipc.llmAddLog`) 전송한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 로그 텍스트를 파싱하여 메시지 마크다운이나 코드 제안을 구성하는 행위 (useAIResponseHandler가 단독 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST RESTORE: 브라우저 콘솔을 탈취한 후, 훅의 언마운트(`cleanup`) 시점에는 반드시 원래의 브라우저 순정 콘솔 메서드(`origLog`, `origWarn`, `origErr`)로 원상 복구해 둘 것.
 *   그렇지 않으면 타 서브시스템 컴포넌트의 일반 렌더 로그 출력이 차단되거나 중복 유출되는 심각한 콘솔 누수가 발생함.
 * - MUST NOT swallow initialization errors: 초기 로그 수집 비동기 호출(`ipc.llmGetLogs`)의 실패 예외는 반드시 `console.error`로 로깅하여 시각화할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useEffect: 최초 마운트 시 브라우저 콘솔 하이재킹 및 메인 프로세스 로그 구독을 개시하기 위한 리액트 라이프사이클 훅.
 * - useRef: 콘솔 언마운트 해제 리스너 핸들러 레퍼런스를 보존하기 위한 Mutable 참조 훅.
 */
import { useEffect, useRef } from 'react'

/* 
 * [ZUSTAND LOG STORE]
 * - useAILogStore: 수집된 로그 어레이(`sensorLogs`) 및 로그 추가 액션(`addSensorLog`) 스토어.
 */
import { useAILogStore } from '../../stores/useAILogStore'

/* 
 * [ELECTRON IPC BRIDGE]
 * - ipc: 메인 프로세스의 LLM 로그 채널 이벤트 리스너 및 렌더러 로그 저장 RPC API.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/**
 * @hook useAIEngineLogs
 * @description Llama.cpp 엔진 로그 구독 및 WebGPU 브라우저 그래픽 진단 콘솔 로그를 인터셉트하는 훅.
 */
export function useAIEngineLogs() {
  /*
   * [ZUSTAND STORE MAPPING]
   * - engineLogs: 저장소 내의 원본 수집 로그 정보.
   * - setEngineLogs: 로그 텍스트를 누적 추가하는 세터.
   */
  const { sensorLogs: engineLogs, addSensorLog: setEngineLogs } = useAILogStore()

  /*
   * [CONTRACT - Unsubscribe Callback Reference]
   * - unsubLogRef: Electron IPC LLM 로그 리스너 해제를 위한 Callback 레퍼런스.
   */
  const unsubLogRef = useRef<(() => void) | null>(null)

  /**
   * [SIDE EFFECT - Console Hijack & IPC Subscription]
   * - Rationale: 컴포넌트 마운트 즉시 메인 프로세스 실시간 로그를 바인딩하고, 브라우저 console 객체를 하이재킹한다.
   */
  useEffect(() => {
    // Electron 웹 뷰 런타임 환경이 아닐 경우 즉시 처리를 취소함
    if (!ipc.isElectronEnv()) return

    // 1. 메인 프로세스 LLM 로그 실시간 수신 리스너 등록
    const unsubLog = ipc.onLLMLog((data) => {
      setEngineLogs(data.text)
    })

    // 2. 렌더러 기동 이전에 발생한 초기 로그 버퍼 정보 일괄 획득 동기화
    ipc.llmGetLogs().then((logs) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (logs) {
        setEngineLogs(logs)
      }
    }).catch((err) => {
      // CONTRACT: 초기 로딩 에러 누락 방지 로깅
      console.error('[useAIEngineLogs] 초기 LLM 로그 불러오기 실패:', err)
    })

    // 3. WebGPU/GPU 관련 브라우저 콘솔 로그 인터셉터 가동을 위한 순정 console 임시 보존
    const origLog = console.log
  // [RUN-TIME STATE / INVARIANT] - 변수 'origWarn'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const origWarn = console.warn
  // [RUN-TIME STATE / INVARIANT] - 변수 'origErr'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const origErr = console.error

    /*
     * [INVARIANT - Intercept Console Logs]
     * - Rationale: 콘솔 스트림에 유입되는 객체/문자열을 조인한 후, WebGPU/WebGL 등 그래픽 관련 로그만 추려 메인 로그 파일로 역전송한다.
     */
    const interceptAndSend = (_type: string, args: any[]) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const text = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')
  // [RUN-TIME STATE / INVARIANT] - 변수 'lower'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lower = text.toLowerCase()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (
        lower.includes('webgpu') ||
        lower.includes('gpu') ||
        lower.includes('webgl')
      ) {
        ipc.llmAddLog({ text, prefix: 'WGU' })
      }
    }

    // 브라우저 기본 전역 console의 주입 오버라이드
    console.log = (...args) => { origLog(...args); interceptAndSend('log', args) }
    console.warn = (...args) => { origWarn(...args); interceptAndSend('warn', args) }
    console.error = (...args) => { origErr(...args); interceptAndSend('error', args) }

    // cleanup 리스너 참조 주입
    unsubLogRef.current = unsubLog

    /*
     * [CLEANUP CONTRACT - Console Restoration]
     * - Rationale: 컴포넌트 소멸 시, console 객체를 순정 메서드로 복구하지 않으면
     *   브라우저가 꼬이거나 무한 호출 루프 데드락이 발생하므로 완벽히 원복(Restore)한다.
     */
    return () => {
      unsubLog()
      console.log = origLog
      console.warn = origWarn
      console.error = origErr
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (unsubLogRef.current) {
        unsubLogRef.current()
        unsubLogRef.current = null
      }
    }
  }, [])

  return {
    engineLogs,
    setEngineLogs
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. AI 렌더 콘솔 외에 특수 시스템 감청 키워드(예: 'wasm error', 'metal')를 확장할 때:
 *    - `interceptAndSend` 내의 `lower.includes(...)` 조건식 배열에 필터 단어를 확충할 것.
 * ============================================================================
 */

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
