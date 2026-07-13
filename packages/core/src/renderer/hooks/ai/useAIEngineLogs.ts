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
import { useEffect } from 'react'

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
 * [GLOBAL REF COUNTING STATE FOR HOOK SINGLETON]
 * - listenerRefReadCount: 현재 활성화되어 있는 useAIEngineLogs 훅의 인스턴스 총합.
 * - globalIpcUnsubscribe: IPC 감청 중단을 위한 해제 콜백 객체.
 * - 순순정 console 백업 참조 변수들.
 */
let listenerRefReadCount = 0;
let globalIpcUnsubscribe: (() => void) | null = null;
let origLog: ((...args: any[]) => void) | null = null;
let origWarn: ((...args: any[]) => void) | null = null;
let origErr: ((...args: any[]) => void) | null = null;

/**
 * @hook useAIEngineLogs
 * @description Llama.cpp 엔진 로그 구독 및 WebGPU 브라우저 그래픽 진단 콘솔 로그를 인터셉트하는 훅.
 *              다중 마운트 및 StrictMode HMR 시 로그가 중복 수집(3회씩 찍힘)되는 현상을 방지하고자,
 *              레퍼런스 카운트 기반의 싱글톤 패턴을 적용하여 단 1개의 감청 리스너와 콘솔 인터셉터만 띄우도록 보증한다.
 */
export function useAIEngineLogs() {
  /*
   * [ZUSTAND STORE MAPPING]
   * - engineLogs: 저장소 내의 원본 수집 로그 정보.
   * - setEngineLogs: 로그 텍스트를 누적 추가하는 세터.
   */
  const { sensorLogs: engineLogs, addSensorLog: setEngineLogs } = useAILogStore()

  /**
   * [SIDE EFFECT - Console Hijack & IPC Subscription]
   * - Rationale: 최초 훅 마운트 시에만 전역 이벤트 채널을 1회 바인딩하고, console 객체를 하이재킹한다.
   *   이후 컴포넌트 추가 마운트 시에는 참조 카운트만 늘리고 리스너는 공유한다.
   */
  useEffect(() => {
    // Electron 웹 뷰 런타임 환경이 아닐 경우 즉시 처리를 취소함
    if (!ipc.isElectronEnv()) return

    // 1. 참조 카운트 증가
    listenerRefReadCount++;

    // 2. 최초 마운트된 훅 인스턴스인 경우에만 실제 바인딩 구동
    if (listenerRefReadCount === 1) {
      // 메인 프로세스 LLM 로그 실시간 수신 리스너 등록
      globalIpcUnsubscribe = ipc.onLLMLog((data) => {
        setEngineLogs(data.text)
      })

      // 렌더러 기동 이전에 발생한 초기 로그 버퍼 정보 일괄 획득 동기화
      ipc.llmGetLogs().then((logs) => {
        if (logs) {
          /*
           * [ALGORITHM BRANCH / DECISION]
           * - 초기 수집된 로그 뭉치가 긴 단일 텍스트 형태이므로, 줄바꿈 단위로 쪼개어 각각 링버퍼에 추가한다.
           * - 그렇지 않고 뭉치째 추가하면 화면 DOM 갱신 시 오작동 및 단일 줄 렌더링 계약이 깨진다.
           */
          const lines = logs.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim()) {
              setEngineLogs(line);
            }
          }
        }
      }).catch((err) => {
        // CONTRACT: 초기 로딩 에러 누락 방지 로깅
        console.error('[useAIEngineLogs] 초기 LLM 로그 불러오기 실패:', err)
      })

      // WebGPU/GPU 관련 브라우저 콘솔 로그 인터셉터 가동을 위한 순정 console 임시 보존
      origLog = console.log
      origWarn = console.warn
      origErr = console.error

      /*
       * [INVARIANT - Intercept Console Logs]
       * - Rationale: 콘솔 스트림에 유입되는 객체/문자열을 조인한 후, WebGPU/WebGL 등 그래픽 관련 로그만 추려 메인 로그 파일로 역전송한다.
       * - Expected Value Flow: args.map -> string (JSON or fallback) -> text.join
       * - Rationale: React 19 가 에러 방출 시 전달하는 순환 참조 객체(React Fiber)를 JSON.stringify 하다가 throw 되는 크래시(Expected static flag was missing)를 방지하기 위해 try-catch 방어막 구축.
       */
      const interceptAndSend = (_type: string, args: any[]) => {
        const text = args
          .map((a) => {
            if (typeof a === 'object' && a !== null) {
              try {
                return JSON.stringify(a)
              } catch {
                return '[Circular/Object]'
              }
            }
            return String(a)
          })
          .join(' ')
        const lower = text.toLowerCase()
        if (
          lower.includes('webgpu') ||
          lower.includes('gpu') ||
          lower.includes('webgl')
        ) {
          ipc.llmAddLog({ text, prefix: 'WGU' })
        }
      }

      // 브라우저 기본 전역 console의 주입 오버라이드
      console.log = (...args) => { if (origLog) origLog(...args); interceptAndSend('log', args) }
      console.warn = (...args) => { if (origWarn) origWarn(...args); interceptAndSend('warn', args) }
      console.error = (...args) => { if (origErr) origErr(...args); interceptAndSend('error', args) }
    }

    /*
     * [CLEANUP CONTRACT - Console & IPC Unbind]
     * - Rationale: 참조 카운트를 낮추고, 마지막 마운트가 해제되었을 때에만
     *   console 객체를 복구하고 메인 스레드 이벤트 채널을 제거한다.
     */
    return () => {
      listenerRefReadCount--;

      if (listenerRefReadCount === 0) {
        // 리스너 바인딩 해제
        if (globalIpcUnsubscribe) {
          globalIpcUnsubscribe()
          globalIpcUnsubscribe = null
        }

        // 전역 콘솔 순정 원상태 복구
        if (origLog) console.log = origLog
        if (origWarn) console.warn = origWarn
        if (origErr) console.error = origErr

        origLog = null
        origWarn = null
        origErr = null
      }
    }
  }, [setEngineLogs])

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

